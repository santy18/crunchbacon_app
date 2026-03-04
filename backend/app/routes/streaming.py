import io
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from ..config import VOICES_DIR
from ..database import async_session
from ..ml import ml_models
from ..models import Transcription, Voice

router = APIRouter()


@router.websocket("/ws/stream")
async def stream_speech(ws: WebSocket, voice: str = "clone", delay: int = 10, sample_rate: int = 16000):
    await ws.accept()

    # Fetch voice from DB
    async with async_session() as db:
        result = await db.execute(select(Voice).where(Voice.name == voice))
        voice_row = result.scalar_one_or_none()

    if not voice_row or not Path(voice_row.file_path).is_file():
        # Fallback to VOICES_DIR for backward compatibility
        ref_audio = VOICES_DIR / f"{voice}.wav"
        if not ref_audio.is_file():
            await ws.send_json({"type": "error", "detail": f"Voice '{voice}' not found"})
            await ws.close(code=1008, reason="Voice not found")
            return
    else:
        ref_audio = Path(voice_row.file_path)

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

                debug_path = Path(__file__).resolve().parent.parent.parent / "debug_raw.wav"
                sf.write(str(debug_path), audio_data, client_sr, format="WAV")
                print(f"[WS] Saved raw audio: {debug_path} (sr={client_sr}, min={audio_data.min():.4f}, max={audio_data.max():.4f}, len={len(audio_data)})")

                if client_sr != whisper_sr:
                    from scipy.signal import resample
                    num_samples_16k = int(len(audio_data) * whisper_sr / client_sr)
                    audio_data = resample(audio_data, num_samples_16k).astype(np.float32)

                debug_path_16k = Path(__file__).resolve().parent.parent.parent / "debug_16k.wav"
                sf.write(str(debug_path_16k), audio_data, whisper_sr, format="WAV")
                print(f"[WS] Saved resampled audio: {debug_path_16k}")

                print(f"[WS] Running STT on {len(audio_data)} samples at {whisper_sr}Hz ({len(audio_data)/whisper_sr:.1f}s)")
                segments, _ = stt.transcribe(audio_data, beam_size=5, vad_filter=True)
                text = " ".join(seg.text for seg in segments).strip()
                print(f"[WS] STT result: '{text}'")

                if not text:
                    await ws.send_json({"type": "transcription", "text": ""})
                    continue

                await ws.send_json({"type": "transcription", "text": text})

                # Save transcription to DB
                try:
                    async with async_session() as db:
                        result = await db.execute(select(Voice).where(Voice.name == voice))
                        voice_row = result.scalar_one_or_none()
                        t = Transcription(
                            text=text,
                            voice_id=voice_row.id if voice_row else None,
                            source="websocket",
                        )
                        db.add(t)
                        await db.commit()
                except Exception as e:
                    print(f"[WS] Failed to save transcription: {e}")

                print("[WS] Running TTS...")
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
