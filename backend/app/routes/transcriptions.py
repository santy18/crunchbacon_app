from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Transcription
from ..schemas import TranscriptionOut

router = APIRouter()


@router.get("/transcriptions", response_model=list[TranscriptionOut])
async def list_transcriptions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transcription).order_by(Transcription.created_at.desc()))
    return result.scalars().all()


@router.get("/transcriptions/{trans_id}", response_model=TranscriptionOut)
async def get_transcription(trans_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(Transcription, trans_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return t


@router.delete("/transcriptions/{trans_id}", status_code=204)
async def delete_transcription(trans_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(Transcription, trans_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transcription not found")
    await db.delete(t)
    await db.commit()
