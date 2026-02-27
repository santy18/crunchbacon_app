from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Setting
from ..schemas import SettingOut, SettingUpsert

router = APIRouter()


@router.get("/settings", response_model=list[SettingOut])
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).order_by(Setting.key))
    return result.scalars().all()


@router.get("/settings/{key}", response_model=SettingOut)
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return setting


@router.put("/settings/{key}", response_model=SettingOut)
async def upsert_setting(key: str, body: SettingUpsert, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = body.value
    else:
        setting = Setting(key=key, value=body.value)
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


@router.delete("/settings/{key}", status_code=204)
async def delete_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    await db.delete(setting)
    await db.commit()
