import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=api_key) if api_key else None

def generate_suggestion(transcripts: list[str], language: str = "ru", profile: dict = None) -> str:
    if not groq_client: return "Say: Groq API key not set."
    
    # Take the last 10 lines for context
    context = "\n".join(transcripts[-10:])
    
    context_str = ""
    if profile:
        context_str = f"""
Продажник продаёт: {profile.get('product_name', '')}
Описание продукта: {profile.get('product_description', '')}
Конкуренты: {profile.get('competitors', '')}
Скрипт продаж компании: {profile.get('sales_script', '')}
Средний чек: {profile.get('deal_size', '')}
"""
        if language == "en":
            context_str = f"""
Selling: {profile.get('product_name', '')}
Product Description: {profile.get('product_description', '')}
Competitors: {profile.get('competitors', '')}
Sales Script: {profile.get('sales_script', '')}
Deal Size: {profile.get('deal_size', '')}
"""

    if language == 'ru':
        system_prompt = f"""Ты эксперт по продажам SaaS продуктов.
{context_str}
Продажник на звонке с клиентом. Ниже написано что сказал КЛИЕНТ.
Напиши ТОЛЬКО точную фразу, которую продажник должен произнести прямо сейчас.

ПРАВИЛА:
1. Максимум 1-2 предложения. Точно по скрипту продаж компании (если он указан выше).
2. Строго без предисловий, без объяснений, без кавычек.
3. НЕ ПИШИ слово "Скажи:" или "Say:", просто выдай сам скрипт.
Фокус на: работе с возражениями, создании ценности, закрытии сделки."""
    else:
        system_prompt = f"""You are an expert sales coach for SaaS products. 
{context_str}
A sales rep is on a live call. Below is what the CUSTOMER has said. 
Write EXACTLY the script the rep should say next.

RULES:
1. Maximum 1-2 sentences. Follow the Exact Corporate Sales Script (if provided above).
2. Strictly no introductions, no explanations, no quotes.
3. DO NOT write the word "Say:" or "Скажи:" or "Скажите:", just output the raw script directly.
Focus on: handling objections, building value, closing the deal."""
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
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
