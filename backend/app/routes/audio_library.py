import io

import soundfile as sf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import DATA_DIR
from ..database import get_db
from ..models import AudioFile
from ..schemas import AudioFileOut, AudioFileUpdate

router = APIRouter()

AUDIO_LIBRARY_DIR = DATA_DIR / "audio_library"
AUDIO_LIBRARY_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/audio-library", response_model=list[AudioFileOut])
async def list_audio_files(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AudioFile).order_by(AudioFile.created_at.desc()))
    return result.scalars().all()


@router.post("/audio-library", response_model=AudioFileOut, status_code=201)
async def save_audio_file(
    audio: UploadFile = File(...),
    name: str = Form(...),
    text: str = Form(None),
    voice_name: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    raw_bytes = await audio.read()

    # probe duration
    duration = None
    try:
        data, sr = sf.read(io.BytesIO(raw_bytes))
        if sr > 0:
            duration = len(data) / sr
    except Exception:
        pass

    record = AudioFile(
        name=name,
        text=text,
        voice_name=voice_name,
        file_path="",
        duration=duration,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    dest = AUDIO_LIBRARY_DIR / f"{record.id}.wav"
    dest.write_bytes(raw_bytes)
    record.file_path = str(dest)
    await db.commit()
    await db.refresh(record)

    return record


@router.get("/audio-library/{file_id}/file")
async def get_audio_file(file_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(AudioFile, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audio file not found")
    p = Path(record.file_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File missing from disk")
    return FileResponse(p, media_type="audio/wav", filename=f"{record.name}.wav")


@router.patch("/audio-library/{file_id}", response_model=AudioFileOut)
async def update_audio_file(file_id: int, body: AudioFileUpdate, db: AsyncSession = Depends(get_db)):
    record = await db.get(AudioFile, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if body.name is not None:
        record.name = body.name
    if body.text is not None:
        record.text = body.text
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/audio-library/{file_id}", status_code=204)
async def delete_audio_file(file_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(AudioFile, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audio file not found")
    if record.file_path:
        p = Path(record.file_path)
        if p.exists():
            p.unlink()
    await db.delete(record)
    await db.commit()
