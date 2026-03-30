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

def detect_language(text: str) -> str:
    russian_chars = len([c for c in text if '\u0400' <= c <= '\u04ff'])
    return 'ru' if russian_chars > 3 else 'en'

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

        lang = detect_language(req.last_transcript)

        if lang == 'en':
            lang_instruction = """
You MUST respond in English only.
Format: Say: [exact words]"""
        else:
            lang_instruction = """
Отвечай ТОЛЬКО на русском.
Формат: Скажи: [точные слова]"""

        prompt = f"""
Role: Tyndap.ai Friendly Sales Expert.
Goal: Act like a supportive, professional human assistant who builds trust and then closes the deal.

Product: {profile_data.get('product_name', '')}
Description: {profile_data.get('product_description', '')}
Sales Script: {profile_data.get('sales_script', '')}
Competitors: {profile_data.get('competitors', '')}
Current Stage: {req.current_stage}

Client said:
{req.last_transcript}

CORE BEHAVIOR:
1. HUMAN START: If it's the beginning of the call, ALWAYS greet warmly and try to learn their name/role.
2. EMPATHY FIRST: Use phrases like "I understand", "That makes sense", "Great question" before arguments.
3. NATURAL FLOW: Be polite but don't be a robot. Be an expert friend who wants to help.
4. BREVITY (Call to Action): Max 20 words so the rep can speak naturally.
5. LANGUAGE: Match the customer's language (RU/EN/Mix) and tone.

{lang_instruction}

STRICT OUTPUT RULES:
- No explanations, no labels, no preamble
- Just output: Say: or Скажи: followed by the script
- Max 20 words after Say:/Скажи:
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
            started = False
            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_suggestion += delta
                    if not started:
                        if lang == 'en':
                            if 'Say:' in full_suggestion:
                                started = True
                                yield 'Say:' + full_suggestion.split('Say:')[-1]
                            elif 'say:' in full_suggestion:
                                started = True
                                yield 'Say:' + full_suggestion.split('say:')[-1]
                            elif len(full_suggestion) > 50:
                                started = True
                                yield 'Say: ' + full_suggestion
                        else:
                            if 'Скажи:' in full_suggestion:
                                started = True
                                yield 'Скажи:' + full_suggestion.split('Скажи:')[-1]
                            elif len(full_suggestion) > 50:
                                started = True
                                yield 'Скажи: ' + full_suggestion
                    else:
                        yield delta
            
            if not started and full_suggestion:
                if lang == 'en':
                    yield 'Say: ' + full_suggestion
                else:
                    yield 'Скажи: ' + full_suggestion
            
            # Optionally save to DB after streaming finishes
            if supabase:
                final_text = full_suggestion
                if lang == 'en':
                    if 'Say:' in final_text: final_text = 'Say:' + final_text.split('Say:')[-1]
                    elif 'say:' in final_text: final_text = 'Say:' + final_text.split('say:')[-1]
                    else: final_text = 'Say: ' + final_text.strip()
                else:
                    if 'Скажи:' in final_text: final_text = 'Скажи:' + final_text.split('Скажи:')[-1]
                    else: final_text = 'Скажи: ' + final_text.strip()

                supabase.table("suggestions").insert({
                    "call_id": req.call_id,
                    "suggestion": final_text.strip()
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
