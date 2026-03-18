from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.groq_service import GroqService
from services.gemini_service import GeminiService
from database.db import get_cached_result, store_result
from utils.common import generate_hash

router = APIRouter()
groq_service = GroqService()
gemini_service = GeminiService()

# --- Models ---

class DailyEntry(BaseModel):
    date: str
    description: str
    hours: Optional[float] = 0.0
    links: Optional[str] = ""
    blockers: Optional[str] = ""
    learnings: Optional[str] = ""

class WeeklyRequest(BaseModel):
    entries: List[dict]

class MonthlyRequest(BaseModel):
    entries: List[dict]

# --- Endpoints ---

@router.post("/analyze/daily")
async def analyze_daily(request: DailyEntry):
    # Pass entire model to hashing & service
    input_data = request.model_dump()
    input_hash = generate_hash(input_data)
    
    # Check cache
    cached = get_cached_result(input_hash)
    if cached:
        return cached
    
    # Call Groq for daily
    result = await groq_service.analyze_daily(input_data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Store in cache
    store_result("daily", input_hash, result)
    return result

@router.post("/analyze/weekly")
async def analyze_weekly(request: WeeklyRequest):
    input_hash = generate_hash({"type": "weekly", "data": request.entries})
    
    cached = get_cached_result(input_hash)
    if cached:
        return cached
    
    result = await gemini_service.analyze_weekly(request.entries)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    store_result("weekly", input_hash, result)
    return result

@router.post("/analyze/monthly")
async def analyze_monthly(request: MonthlyRequest):
    input_hash = generate_hash({"type": "monthly", "data": request.entries})
    
    cached = get_cached_result(input_hash)
    if cached:
        return cached
    
    result = await gemini_service.analyze_monthly(request.entries)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    store_result("monthly", input_hash, result)
    return result
