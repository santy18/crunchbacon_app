from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Script
from ..schemas import ScriptCreate, ScriptOut, ScriptUpdate

router = APIRouter()


@router.get("/scripts", response_model=list[ScriptOut])
async def list_scripts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Script).order_by(Script.updated_at.desc()))
    return result.scalars().all()


@router.post("/scripts", response_model=ScriptOut, status_code=201)
async def create_script(body: ScriptCreate, db: AsyncSession = Depends(get_db)):
    script = Script(name=body.name, content=body.content)
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return script


@router.get("/scripts/{script_id}", response_model=ScriptOut)
async def get_script(script_id: int, db: AsyncSession = Depends(get_db)):
    script = await db.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


@router.put("/scripts/{script_id}", response_model=ScriptOut)
async def update_script(script_id: int, body: ScriptUpdate, db: AsyncSession = Depends(get_db)):
    script = await db.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(script, field, value)
    await db.commit()
    await db.refresh(script)
    return script


@router.delete("/scripts/{script_id}", status_code=204)
async def delete_script(script_id: int, db: AsyncSession = Depends(get_db)):
    script = await db.get(Script, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    await db.delete(script)
    await db.commit()
