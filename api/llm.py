import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=api_key) if api_key else None

SYSTEM_PROMPT = """Ты эксперт по продажам SaaS продуктов. 
Продажник сейчас на живом звонке с клиентом. 
Ниже написано что сказал КЛИЕНТ.
Твоя задача — сказать продажнику точно что ответить прямо сейчас.

Всегда отвечай ТОЛЬКО в формате: 'Скажи: [точные слова]'
Максимум 2 предложения. Никаких объяснений. Только скрипт.
Фокус на: работе с возражениями, создании ценности, закрытии сделки.

Если разговор на русском — отвечай на русском.
Если на английском — отвечай на английском."""

def generate_suggestion(transcripts: list[str]) -> str:
    if not groq_client: return "Say: Groq API key not set."
    
    # Take the last 10 lines for context
    context = "\n".join(transcripts[-10:])
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Customer recent conversation:\n\n{context}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=150,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Error calling Groq for suggestion: {e}")
        return "Say: Error generating suggestion."

SUMMARY_PROMPT = """You are an expert sales coach. Summarize the following sales call transcript.
Return a JSON object containing EXACTLY these four keys:
{
    "summary": "3-5 sentences summarizing the call",
    "objections": ["objection 1", "objection 2"],
    "next_steps": ["step 1", "step 2"],
    "sentiment": {"value": "Positive/Negative/Neutral", "reason": "One sentence reason"}
}
Output pure JSON only, no markdown blocks or other text.
If the Target Language is Russian, the summary, objections, next_steps, and sentiment value MUST be written in Russian (Позитивное, Негативное, Нейтральное). 
If English, use English.
"""

def generate_summary(transcripts: list[str], language: str = "ru") -> dict:
    default_summary = {
        "summary": "Call ended, but summary could not be generated.",
        "objections": [],
        "next_steps": [],
        "sentiment": {"value": "Unknown", "reason": "Error generating summary"}
    }
    
    if not groq_client or not transcripts: 
        return default_summary
    
    context = "\n".join(transcripts)
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": SUMMARY_PROMPT},
                {"role": "user", "content": f"Target Language: {'Russian' if language == 'ru' else 'English'}\n\nTranscript:\n\n{context}"}
            ],
            model="llama-3.1-8b-instant", # Faster model to avoid Vercel 10s serverless timeout
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        
        content = chat_completion.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Error calling Groq for summary: {e}")
        return default_summary
