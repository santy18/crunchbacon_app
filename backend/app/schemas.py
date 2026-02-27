from datetime import datetime

from pydantic import BaseModel


# --- TTS (existing) ---

class TTSRequest(BaseModel):
    text: str
    voice: str
    ref_text: str | None = None


# --- Voice ---

class VoiceCreate(BaseModel):
    name: str
    file_path: str
    description: str | None = None

class VoiceUpdate(BaseModel):
    name: str | None = None
    file_path: str | None = None
    description: str | None = None

class VoiceOut(BaseModel):
    id: int
    name: str
    file_path: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --- Project ---

class ProjectCreate(BaseModel):
    name: str
    data: str | None = None  # JSON string

class ProjectUpdate(BaseModel):
    name: str | None = None
    data: str | None = None

class ProjectOut(BaseModel):
    id: int
    name: str
    data: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --- Generation ---

class GenerationOut(BaseModel):
    id: int
    text: str
    voice_id: int | None
    ref_text: str | None
    audio_path: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Script ---

class ScriptCreate(BaseModel):
    name: str
    content: str | None = None

class ScriptUpdate(BaseModel):
    name: str | None = None
    content: str | None = None

class ScriptOut(BaseModel):
    id: int
    name: str
    content: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --- Transcription ---

class TranscriptionUpdate(BaseModel):
    text: str

class TranscriptionOut(BaseModel):
    id: int
    text: str
    voice_id: int | None
    source: str | None
    audio_path: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Setting ---

class SettingUpsert(BaseModel):
    value: str | None = None

class SettingOut(BaseModel):
    id: int
    key: str
    value: str | None
    updated_at: datetime
    model_config = {"from_attributes": True}
