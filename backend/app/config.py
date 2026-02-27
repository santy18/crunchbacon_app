from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
VOICES_DIR = BACKEND_DIR / "cloned_voices"
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

PROJECTS_MEDIA_DIR = DATA_DIR / "projects_media"
PROJECTS_MEDIA_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR / 'app.db'}"
