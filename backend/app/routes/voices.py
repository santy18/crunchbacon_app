from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import VOICES_DIR
from ..database import get_db
from ..models import Voice
from ..schemas import VoiceCreate, VoiceOut, VoiceUpdate

router = APIRouter()


# --- Existing endpoint (backward compat) ---

@router.get("/voices")
async def list_voices():
    if not VOICES_DIR.is_dir():
        return []
    return sorted(
        f.stem for f in VOICES_DIR.iterdir()
        if f.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg"}
    )


# --- Upload / Delete by name ---

@router.post("/voices/create", response_model=VoiceOut, status_code=201)
async def create_voice_upload(
    name: str = Form(...),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    dest = VOICES_DIR / f"{name}.wav"
    data = await audio.read()
    dest.write_bytes(data)

    # upsert: update if exists, else create
    result = await db.execute(select(Voice).where(Voice.name == name))
    voice = result.scalar_one_or_none()
    if voice:
        voice.file_path = str(dest)
    else:
        voice = Voice(name=name, file_path=str(dest))
        db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return voice


@router.delete("/voices/{name}", status_code=204)
async def delete_voice_by_name(name: str, db: AsyncSession = Depends(get_db)):
    # delete file
    wav = VOICES_DIR / f"{name}.wav"
    if wav.exists():
        wav.unlink()

    # delete DB record
    result = await db.execute(select(Voice).where(Voice.name == name))
    voice = result.scalar_one_or_none()
    if voice:
        await db.delete(voice)
        await db.commit()


# --- DB CRUD ---

@router.get("/voices/db", response_model=list[VoiceOut])
async def list_voices_db(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Voice).order_by(Voice.name))
    return result.scalars().all()


@router.post("/voices/db", response_model=VoiceOut, status_code=201)
async def create_voice(body: VoiceCreate, db: AsyncSession = Depends(get_db)):
    voice = Voice(name=body.name, file_path=body.file_path, description=body.description)
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return voice


@router.get("/voices/db/{voice_id}", response_model=VoiceOut)
async def get_voice(voice_id: int, db: AsyncSession = Depends(get_db)):
    voice = await db.get(Voice, voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return voice


@router.put("/voices/db/{voice_id}", response_model=VoiceOut)
async def update_voice(voice_id: int, body: VoiceUpdate, db: AsyncSession = Depends(get_db)):
    voice = await db.get(Voice, voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(voice, field, value)
    await db.commit()
    await db.refresh(voice)
    return voice


@router.delete("/voices/db/{voice_id}", status_code=204)
async def delete_voice(voice_id: int, db: AsyncSession = Depends(get_db)):
    voice = await db.get(Voice, voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    await db.delete(voice)
    await db.commit()
