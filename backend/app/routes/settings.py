from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..encryption import decrypt_value, encrypt_value
from ..models import Setting
from ..schemas import SettingOut, SettingUpsert

router = APIRouter()


@router.get("/settings", response_model=list[SettingOut])
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).order_by(Setting.key))
    return result.scalars().all()


# --- Encrypted settings (for API keys / secrets) ---
# These must be defined BEFORE /settings/{key} to avoid route conflicts


def _mask(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * (len(value) - 4) + value[-4:]


@router.put("/settings/encrypted/{key}")
async def upsert_encrypted_setting(key: str, body: SettingUpsert, db: AsyncSession = Depends(get_db)):
    db_key = f"secret_{key}"
    encrypted = encrypt_value(body.value) if body.value else None

    result = await db.execute(select(Setting).where(Setting.key == db_key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = encrypted
    else:
        setting = Setting(key=db_key, value=encrypted)
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return {"key": key, "masked": _mask(body.value) if body.value else None}


@router.get("/settings/encrypted/{key}")
async def get_encrypted_setting(key: str, reveal: bool = False, db: AsyncSession = Depends(get_db)):
    db_key = f"secret_{key}"
    result = await db.execute(select(Setting).where(Setting.key == db_key))
    setting = result.scalar_one_or_none()
    if not setting or not setting.value:
        raise HTTPException(status_code=404, detail=f"Secret '{key}' not found")

    decrypted = decrypt_value(setting.value)
    if reveal:
        return {"key": key, "value": decrypted}
    return {"key": key, "masked": _mask(decrypted)}


@router.delete("/settings/encrypted/{key}", status_code=204)
async def delete_encrypted_setting(key: str, db: AsyncSession = Depends(get_db)):
    db_key = f"secret_{key}"
    result = await db.execute(select(Setting).where(Setting.key == db_key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Secret '{key}' not found")
    await db.delete(setting)
    await db.commit()


# --- Regular settings ---


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
