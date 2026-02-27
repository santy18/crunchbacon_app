import io
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import VOICES_DIR
from ..database import async_session, get_db
from ..ml import ml_models
from ..models import Generation, Voice
from ..schemas import GenerationOut, TTSRequest

router = APIRouter()


async def _log_generation(text: str, voice_name: str, ref_text: str | None):
    """Log a generation record to the DB."""
    async with async_session() as db:
        result = await db.execute(select(Voice).where(Voice.name == voice_name))
        voice = result.scalar_one_or_none()
        gen = Generation(text=text, voice_id=voice.id if voice else None, ref_text=ref_text)
        db.add(gen)
        await db.commit()


@router.post("/generate")
async def generate_audio(req: TTSRequest):
    model = ml_models.get("tts")
    if not model:
        raise HTTPException(status_code=503, detail="Model is currently unavailable.")

    ref_audio = VOICES_DIR / f"{req.voice}.wav"
    if not ref_audio.is_file():
        raise HTTPException(status_code=400, detail=f"Voice '{req.voice}' not found.")

    try:
        results = list(model.generate(
            text=req.text,
            ref_audio=str(ref_audio),
            ref_text=req.ref_text
        ))

        audio_mx = results[0].audio
        audio_np = np.array(audio_mx)
        sample_rate = 24000

        buffer = io.BytesIO()
        sf.write(buffer, audio_np, sample_rate, format='WAV')
        buffer.seek(0)

        # Log to DB (fire-and-forget style, don't block response)
        try:
            await _log_generation(req.text, req.voice, req.ref_text)
        except Exception as e:
            print(f"[generate] Failed to log generation: {e}")

        return StreamingResponse(buffer, media_type="audio/wav", headers={
            "Content-Disposition": "attachment; filename=output.wav"
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-voiceover")
async def generate_voiceover(
    video: UploadFile = File(...),
    text: str = Form(...),
    voice: str = Form(...),
    ref_text: str = Form(None),
):
    model = ml_models.get("tts")
    if not model:
        raise HTTPException(status_code=503, detail="Model is currently unavailable.")

    ref_audio = VOICES_DIR / f"{voice}.wav"
    if not ref_audio.is_file():
        raise HTTPException(status_code=400, detail=f"Voice '{voice}' not found.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)

        video_ext = Path(video.filename).suffix or ".mp4"
        video_path = tmp / f"input{video_ext}"
        video_path.write_bytes(await video.read())

        try:
            results = list(model.generate(
                text=text,
                ref_audio=str(ref_audio),
                ref_text=ref_text,
            ))
            audio_np = np.array(results[0].audio)
            audio_path = tmp / "voiceover.wav"
            sf.write(str(audio_path), audio_np, 24000, format="WAV")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        output_path = tmp / "output.mp4"
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-c:v", "copy",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {result.stderr.decode()[:500]}",
            )

        # Log to DB
        try:
            await _log_generation(text, voice, ref_text)
        except Exception as e:
            print(f"[generate-voiceover] Failed to log generation: {e}")

        buffer = io.BytesIO(output_path.read_bytes())
        return StreamingResponse(buffer, media_type="video/mp4", headers={
            "Content-Disposition": 'attachment; filename="voiceover.mp4"'
        })


# --- Generation records ---

@router.get("/generations", response_model=list[GenerationOut])
async def list_generations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Generation).order_by(Generation.created_at.desc()))
    return result.scalars().all()


@router.get("/generations/{gen_id}", response_model=GenerationOut)
async def get_generation(gen_id: int, db: AsyncSession = Depends(get_db)):
    gen = await db.get(Generation, gen_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.delete("/generations/{gen_id}", status_code=204)
async def delete_generation(gen_id: int, db: AsyncSession = Depends(get_db)):
    gen = await db.get(Generation, gen_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    await db.delete(gen)
    await db.commit()
