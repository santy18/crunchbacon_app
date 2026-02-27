import mimetypes
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import PROJECTS_MEDIA_DIR
from ..database import get_db
from ..models import Project
from ..schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter()


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    return result.scalars().all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=body.name, data=body.data)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/projects/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    # Clean up media files
    media_dir = PROJECTS_MEDIA_DIR / str(project_id)
    if media_dir.exists():
        shutil.rmtree(media_dir)


# --- Project media files ---

@router.post("/projects/{project_id}/media")
async def upload_project_media(
    project_id: int,
    media: UploadFile = File(...),
    media_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    media_dir = PROJECTS_MEDIA_DIR / str(project_id)
    media_dir.mkdir(parents=True, exist_ok=True)

    # Determine extension from uploaded filename
    ext = Path(media.filename).suffix if media.filename else ""
    dest = media_dir / f"{media_id}{ext}"

    content = await media.read()
    dest.write_bytes(content)

    return {"mediaId": media_id, "filename": media.filename, "stored": str(dest.name)}


@router.get("/projects/{project_id}/media/{media_id}")
async def get_project_media(
    project_id: int,
    media_id: str,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    media_dir = PROJECTS_MEDIA_DIR / str(project_id)
    if not media_dir.exists():
        raise HTTPException(status_code=404, detail="No media files for this project")

    # Find file matching the media_id (any extension)
    matches = list(media_dir.glob(f"{media_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Media file not found")

    file_path = matches[0]
    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "application/octet-stream")
