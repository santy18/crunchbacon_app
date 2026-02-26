import io
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from faster_whisper import WhisperModel

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

    print("Loading faster-whisper STT model...")
    try:
        ml_models["stt"] = WhisperModel("base", device="cpu", compute_type="int8")
        print("Whisper model loaded successfully!")
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")

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


@app.websocket("/ws/stream")
async def stream_speech(ws: WebSocket, voice: str = "clone", delay: int = 10, sample_rate: int = 16000):
    await ws.accept()

    ref_audio = VOICES_DIR / f"{voice}.wav"
    if not ref_audio.is_file():
        await ws.send_json({"type": "error", "detail": f"Voice '{voice}' not found"})
        await ws.close(code=1008, reason="Voice not found")
        return

    tts = ml_models.get("tts")
    stt = ml_models.get("stt")
    if not tts or not stt:
        await ws.send_json({"type": "error", "detail": "Models not loaded"})
        await ws.close(code=1011, reason="Models not available")
        return

    delay = max(2, min(30, delay))
    client_sr = max(8000, min(96000, sample_rate))
    whisper_sr = 16000
    samples_needed = delay * client_sr

    audio_chunks = []
    total_samples = 0

    print(f"[WS] Connected: voice={voice}, delay={delay}s, client_sr={client_sr}, samples_needed={samples_needed}")

    try:
        while True:
            data = await ws.receive_bytes()
            chunk = np.frombuffer(data, dtype=np.float32)
            audio_chunks.append(chunk)
            total_samples += len(chunk)

            if total_samples >= samples_needed:
                audio_data = np.concatenate(audio_chunks)
                audio_chunks = []
                total_samples = 0

                # Debug: save raw audio before resample
                debug_path = Path(__file__).parent / "debug_raw.wav"
                sf.write(str(debug_path), audio_data, client_sr, format="WAV")
                print(f"[WS] Saved raw audio: {debug_path} (sr={client_sr}, min={audio_data.min():.4f}, max={audio_data.max():.4f}, len={len(audio_data)})")

                # Resample to 16kHz if needed
                if client_sr != whisper_sr:
                    from scipy.signal import resample
                    num_samples_16k = int(len(audio_data) * whisper_sr / client_sr)
                    audio_data = resample(audio_data, num_samples_16k).astype(np.float32)

                # Debug: save resampled audio
                debug_path_16k = Path(__file__).parent / "debug_16k.wav"
                sf.write(str(debug_path_16k), audio_data, whisper_sr, format="WAV")
                print(f"[WS] Saved resampled audio: {debug_path_16k}")

                print(f"[WS] Running STT on {len(audio_data)} samples at {whisper_sr}Hz ({len(audio_data)/whisper_sr:.1f}s)")
                # STT
                segments, _ = stt.transcribe(audio_data, beam_size=5, vad_filter=True)
                text = " ".join(seg.text for seg in segments).strip()
                print(f"[WS] STT result: '{text}'")

                if not text:
                    await ws.send_json({"type": "transcription", "text": ""})
                    continue

                await ws.send_json({"type": "transcription", "text": text})

                print(f"[WS] Running TTS...")
                # TTS
                results = list(tts.generate(
                    text=text,
                    ref_audio=str(ref_audio),
                ))
                audio_np = np.array(results[0].audio)

                out_buf = io.BytesIO()
                sf.write(out_buf, audio_np, 24000, format="WAV")
                out_buf.seek(0)
                print(f"[WS] Sending {len(out_buf.getvalue())} bytes of audio")
                await ws.send_bytes(out_buf.getvalue())

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await ws.send_json({"type": "error", "detail": str(e)})
        except Exception:
            pass