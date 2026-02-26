import io
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager

VOICES_DIR = Path(__file__).parent / "cloned_voices"

# Import the MLX loader
from mlx_audio.tts.utils import load_model

ml_models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading MLX Qwen3-TTS into Unified Memory...")
    try:
        # Loading the exact model you just downloaded
        ml_models["tts"] = load_model("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16")
        print("MLX Model loaded successfully!")
    except Exception as e:
        print(f"Failed to load model: {e}")
    yield
    ml_models.clear()

app = FastAPI(lifespan=lifespan, title="MLX Qwen3 TTS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/voices")
async def list_voices():
    if not VOICES_DIR.is_dir():
        return []
    return sorted(
        f.stem for f in VOICES_DIR.iterdir()
        if f.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg"}
    )


class TTSRequest(BaseModel):
    text: str
    voice: str                 # Name of a voice in cloned_voices (without extension)
    ref_text: str = None       # Optional but recommended: transcript of ref_audio

@app.post("/generate")
async def generate_audio(req: TTSRequest):
    model = ml_models.get("tts")
    if not model:
        raise HTTPException(status_code=503, detail="Model is currently unavailable.")

    # Resolve voice name to file path
    ref_audio = VOICES_DIR / f"{req.voice}.wav"
    if not ref_audio.is_file():
        raise HTTPException(status_code=400, detail=f"Voice '{req.voice}' not found.")

    try:
        # Run the Apple Silicon optimized MLX generation
        results = list(model.generate(
            text=req.text,
            ref_audio=str(ref_audio),
            ref_text=req.ref_text
        ))

        # Extract MLX array and convert to NumPy
        audio_mx = results[0].audio
        audio_np = np.array(audio_mx)
        sample_rate = 24000 

        # Write to in-memory buffer
        buffer = io.BytesIO()
        sf.write(buffer, audio_np, sample_rate, format='WAV')
        buffer.seek(0)

        return StreamingResponse(buffer, media_type="audio/wav", headers={
            "Content-Disposition": f"attachment; filename=output.wav"
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-voiceover")
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

        # Save uploaded video
        video_ext = Path(video.filename).suffix or ".mp4"
        video_path = tmp / f"input{video_ext}"
        video_path.write_bytes(await video.read())

        # Generate TTS audio
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

        # Merge video + voiceover with ffmpeg
        output_path = tmp / f"output.mp4"
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

        buffer = io.BytesIO(output_path.read_bytes())
        return StreamingResponse(buffer, media_type="video/mp4", headers={
            "Content-Disposition": 'attachment; filename="voiceover.mp4"'
        })