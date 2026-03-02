import os
from pathlib import Path

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = BACKEND_DIR / "data"

# Configuration from env or defaults
DATA_DIR = Path(os.getenv("DATA_DIR", str(DEFAULT_DATA_DIR)))
DATA_DIR.mkdir(exist_ok=True)

VOICES_DIR = DATA_DIR / "cloned_voices"
VOICES_DIR.mkdir(exist_ok=True)

PROJECTS_MEDIA_DIR = DATA_DIR / "projects_media"
PROJECTS_MEDIA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR / 'app.db'}")
ENCRYPTION_KEY_PATH = DATA_DIR / ".encryption_key"
