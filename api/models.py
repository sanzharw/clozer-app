from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class StartCallRequest(BaseModel):
    customer_name: str

class TranscriptRequest(BaseModel):
    call_id: str
    speaker: str = "Customer:"
    text: str

class SuggestionRequest(BaseModel):
    call_id: str
    transcript: str

class EndCallRequest(BaseModel):
    call_id: str
    language: str = "ru"
