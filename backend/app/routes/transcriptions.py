import io

import numpy as np
import soundfile as sf
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import DATA_DIR
from ..database import get_db
from ..ml import ml_models
from ..models import Transcription
from ..schemas import TranscriptionOut, TranscriptionUpdate

router = APIRouter()

TRANSCRIPTIONS_DIR = DATA_DIR / "transcriptions"
TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/transcriptions", response_model=list[TranscriptionOut])
async def list_transcriptions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transcription).order_by(Transcription.created_at.desc()))
    return result.scalars().all()


@router.get("/transcriptions/{trans_id}", response_model=TranscriptionOut)
async def get_transcription(trans_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(Transcription, trans_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return t


@router.patch("/transcriptions/{trans_id}", response_model=TranscriptionOut)
async def update_transcription(trans_id: int, body: TranscriptionUpdate, db: AsyncSession = Depends(get_db)):
    t = await db.get(Transcription, trans_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transcription not found")
    t.text = body.text
    await db.commit()
    await db.refresh(t)
    return t


@router.post("/transcriptions/create", response_model=TranscriptionOut, status_code=201)
async def create_transcription(
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    stt = ml_models.get("stt")
    if not stt:
        raise HTTPException(status_code=503, detail="STT model not loaded")

    raw_bytes = await audio.read()
    audio_data, client_sr = sf.read(io.BytesIO(raw_bytes), dtype="float32")

    # mono if stereo
    if audio_data.ndim > 1:
        audio_data = audio_data.mean(axis=1)

    # resample to 16kHz for Whisper
    whisper_sr = 16000
    if client_sr != whisper_sr:
        from scipy.signal import resample
        num_samples_16k = int(len(audio_data) * whisper_sr / client_sr)
        audio_data = resample(audio_data, num_samples_16k).astype(np.float32)

    segments, _ = stt.transcribe(audio_data, beam_size=5, vad_filter=True)
    text = " ".join(seg.text for seg in segments).strip()
    if not text:
        raise HTTPException(status_code=422, detail="No speech detected in audio")

    t = Transcription(text=text, source="upload")
    db.add(t)
    await db.commit()
    await db.refresh(t)

    # save audio file using the DB id
    dest = TRANSCRIPTIONS_DIR / f"{t.id}.wav"
    sf.write(str(dest), audio_data, whisper_sr, format="WAV")
    t.audio_path = str(dest)
    await db.commit()
    await db.refresh(t)

    return t


@router.delete("/transcriptions/{trans_id}", status_code=204)
async def delete_transcription(trans_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(Transcription, trans_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transcription not found")
    # delete audio file if it exists
    if t.audio_path:
        from pathlib import Path
        p = Path(t.audio_path)
        if p.exists():
            p.unlink()
    await db.delete(t)
    await db.commit()
