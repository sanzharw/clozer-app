from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class StartCallRequest(BaseModel):
    customer_name: str
    user_id: str | None = None

class TranscriptRequest(BaseModel):
    call_id: str
    speaker: str = "Customer:"
    text: str

class SuggestionRequest(BaseModel):
    call_id: str
    last_transcript: str
    language: str = "ru"
    user_id: str | None = None
    current_stage: int = 0
    has_script: bool = False

class EndCallRequest(BaseModel):
    call_id: str
    language: str = "ru"
    user_id: str | None = None
