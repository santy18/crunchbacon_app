from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import VOICES_DIR
from .database import async_session, init_db
from .ml import clear_models, load_ml_models
from .models import Voice
from .routes import all_routers


async def sync_voices_to_db():
    """Scan cloned_voices/ directory and upsert Voice records."""
    if not VOICES_DIR.is_dir():
        return
    voice_files = sorted(
        f for f in VOICES_DIR.iterdir()
        if f.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg"}
    )
    async with async_session() as db:
        for f in voice_files:
            name = f.stem
            result = await db.execute(select(Voice).where(Voice.name == name))
            existing = result.scalar_one_or_none()
            if existing:
                existing.file_path = str(f)
            else:
                db.add(Voice(name=name, file_path=str(f)))
        await db.commit()
    print(f"[startup] Synced {len(voice_files)} voice(s) to DB")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    load_ml_models()
    await sync_voices_to_db()
    yield
    clear_models()


app = FastAPI(lifespan=lifespan, title="MLX Qwen3 TTS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router)
