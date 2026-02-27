from .export import router as export_router
from .generate import router as generate_router
from .projects import router as projects_router
from .scripts import router as scripts_router
from .settings import router as settings_router
from .streaming import router as streaming_router
from .transcriptions import router as transcriptions_router
from .voices import router as voices_router

all_routers = [
    voices_router,
    generate_router,
    export_router,
    streaming_router,
    projects_router,
    scripts_router,
    transcriptions_router,
    settings_router,
]
