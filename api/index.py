from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from database import supabase
from models import StartCallRequest, TranscriptRequest, SuggestionRequest, EndCallRequest
from llm import generate_suggestion, generate_summary

app = FastAPI(title="Clozer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/start-call")
async def start_call(req: StartCallRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    res = supabase.table("calls").insert({
        "customer_name": req.customer_name,
        "status": "active"
    }).execute()
    
    if res.data:
        return {"call_id": res.data[0]["id"]}
    raise HTTPException(status_code=500, detail="Failed to create call")

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
        if not supabase:
            # Mock logic if no DB
            suggestion = generate_suggestion([req.transcript])
            return {"suggestion": suggestion}
        
        # Save current transcript first
        supabase.table("transcripts").insert({
            "call_id": req.call_id,
            "speaker": "Customer:",
            "text": req.transcript
        }).execute()
        
        # Get last 10 lines
        res = supabase.table("transcripts").select("text").eq("call_id", req.call_id).order("timestamp", desc=True).limit(10).execute()
        lines = [r["text"] for r in reversed(res.data)] if res.data else [req.transcript]
        
        suggestion = generate_suggestion(lines)
        
        supabase.table("suggestions").insert({
            "call_id": req.call_id,
            "suggestion": suggestion
        }).execute()
        
        return {"suggestion": suggestion}
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
    
    summary_data = generate_summary(lines)
    
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
async def list_calls():
    if not supabase: return []
    res = supabase.table("calls").select("*").order("start_time", desc=True).execute()
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
