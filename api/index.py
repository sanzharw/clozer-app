import os
import sys

# Connect the current 'api/' directory to Python's paths so Vercel Serverless can find local files!
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from database import supabase
from fastapi.responses import StreamingResponse
from models import StartCallRequest, TranscriptRequest, SuggestionRequest, EndCallRequest
from llm import generate_suggestion, generate_script_suggestion, generate_summary, groq_client

app = FastAPI(title="Tyndap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/start-call")
async def start_call(req: StartCallRequest):
    try:
        if not supabase:
            return {"error": "Supabase not configured or invalid credentials."}
        
        res = supabase.table("calls").insert({
            "user_id": req.user_id,
            "customer_name": req.customer_name,
            "status": "active"
        }).execute()
        
        if res.data:
            return {"call_id": res.data[0]["id"]}
        return {"error": "Failed to create call - no row data returned"}
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.post("/api/add-transcript")
async def add_transcript(req: TranscriptRequest):
    if not supabase: return {"success": False}
    
    supabase.table("transcripts").insert({
        "call_id": req.call_id,
        "speaker": req.speaker,
        "text": req.text
    }).execute()
    return {"success": True}

@app.post("/api/get-suggestion")
async def get_suggestion(req: SuggestionRequest):
    try:
        if not groq_client: return {"error": "Groq API key not set."}

        # Fetch user profile for context
        profile_data = {}
        if supabase and req.user_id:
            profile_res = supabase.table("profiles").select("*").eq("user_id", req.user_id).single().execute()
            if profile_res.data:
                profile_data = profile_res.data

        prompt = f"""
Продукт: {profile_data.get('product_name', '')}
Описание: {profile_data.get('product_description', '')}
Скрипт: {profile_data.get('sales_script', '')}
Конкуренты: {profile_data.get('competitors', '')}
Текущий этап: {req.current_stage}

Клиент сказал:
{req.last_transcript}

ВАЖНО: Отвечай на том же языке что и клиент.
Если клиент говорит по-английски — отвечай по-английски.
Если по-русски — отвечай по-русски.

Определи — это возражение или обычный разговор?

Если возражение:
ВОЗРАЖЕНИЕ:[тип] | Скажи: [ответ на возражение]

Если по скрипту:
СКРИПТ: Скажи: [следующая фраза из скрипта]

Максимум 2 предложения. Только скрипт.
"""
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.3,
            stream=True
        )

        def generate():
            full_suggestion = ""
            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_suggestion += delta
                    yield delta
            
            # Optionally save to DB after streaming finishes
            if supabase:
                supabase.table("suggestions").insert({
                    "call_id": req.call_id,
                    "suggestion": full_suggestion
                }).execute()

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.post("/api/end-call")
async def end_call(req: EndCallRequest):
    if not supabase: return {"success": False}
    
    # Complete call
    supabase.table("calls").update({
        "status": "completed",
        "end_time": datetime.now().isoformat()
    }).eq("id", req.call_id).execute()
    
    # Need to update duration, calculate from string timestamps
    call_res = supabase.table("calls").select("start_time, end_time").eq("id", req.call_id).execute()
    if call_res.data:
        st = datetime.fromisoformat(call_res.data[0]["start_time"])
        et = datetime.fromisoformat(call_res.data[0]["end_time"])
        duration = int((et - st).total_seconds())
        supabase.table("calls").update({"duration": duration}).eq("id", req.call_id).execute()
    
    # Get all transcripts
    res = supabase.table("transcripts").select("text").eq("call_id", req.call_id).order("timestamp", desc=False).execute()
    lines = [r["text"] for r in res.data] if res.data else []
    
    summary_data = generate_summary(lines, req.language)
    
    # Update call sentiment
    supabase.table("calls").update({
        "sentiment": summary_data.get("sentiment", {}).get("value", "Unknown")
    }).eq("id", req.call_id).execute()
    
    # Save summary
    supabase.table("summaries").upsert({
        "call_id": req.call_id,
        "summary": summary_data.get("summary", ""),
        "objections": summary_data.get("objections", []),
        "next_steps": summary_data.get("next_steps", []),
        "sentiment": summary_data.get("sentiment", {}).get("reason", "")
    }).execute()
    
    return {"success": True, "summary": summary_data}

@app.get("/api/calls")
async def list_calls(user_id: str = None):
    if not supabase: return []
    query = supabase.table("calls").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    res = query.order("start_time", desc=True).execute()
    return res.data if res.data else []

@app.get("/api/call/{call_id}")
async def get_call(call_id: str):
    if not supabase: return {}
    call_res = supabase.table("calls").select("*").eq("id", call_id).execute()
    if not call_res.data:
        raise HTTPException(status_code=404, detail="Call not found")
        
    call_data = call_res.data[0]
    
    transcripts_res = supabase.table("transcripts").select("*").eq("call_id", call_id).order("timestamp", desc=False).execute()
    suggestions_res = supabase.table("suggestions").select("*").eq("call_id", call_id).order("timestamp", desc=False).execute()
    summary_res = supabase.table("summaries").select("*").eq("call_id", call_id).execute()
    
    return {
        "call": call_data,
        "transcripts": transcripts_res.data if transcripts_res.data else [],
        "suggestions": suggestions_res.data if suggestions_res.data else [],
        "summary": summary_res.data[0] if summary_res.data else None
    }
