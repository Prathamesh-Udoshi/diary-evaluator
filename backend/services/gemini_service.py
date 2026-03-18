import os
import google.generativeai as genai
from dotenv import load_dotenv
import json
from ..utils.common import validate_json

load_dotenv()

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("❌ GEMINI_API_KEY not found in .env")
            raise ValueError("GEMINI_API_KEY not found in environment.")
        genai.configure(api_key=self.api_key)
        self.model_name = "gemini-3-flash-preview"
        self.model = genai.GenerativeModel(self.model_name)

    async def analyze_weekly(self, entries: list):
        prompt = f"""
        Evaluate the following weekly collection of internship diary entries:
        ENTRIES: {json.dumps(entries, indent=2)}
        
        Note: Each entry includes description, learnings, blockers, hours, and links.
        
        Provide a consolidated professional evaluation for this WEEK in strictly structured JSON format:
        - weekly_score: (1-100 total score)
        - consistency_score: (1-100 score on how regular and uniform the entries and effort (hours) were)
        - growth_trend: (Brief 3-5 word sentiment like 'Steady improvement' or 'Minor dip in performance')
        - top_skills: [List of the 3 most prominent skills developed this week]
        - weak_areas: [What needs focused effort next week based on blockers]
        - summary: (A 2-3 sentence overview of this week's progress)
        - suggestions: (One actionable coaching point for the next week based on learnings and blockers)

        Ensure strictly valid JSON. Do not include extra text.
        """
        try:
            # Using async version to prevent blocking
            response = await self.model.generate_content_async(prompt)
            
            # Check for safety blocks or empty candidates
            if not response.candidates or not response.candidates[0].content.parts:
                print(f"⚠️ Gemini blocked the content or returned empty response. Safety factor suspected.")
                return {"error": "Content blocked by AI safety filters or invalid input."}
                
            text = response.text
            result = validate_json(text)
            
            if not result:
                # Try one more time with stricter retry
                retry_response = await self.model.generate_content_async(prompt + "\nERROR: Previous attempt failed to parse as valid JSON. Reply ONLY with the JSON block.")
                result = validate_json(retry_response.text)

            return result or {"error": "AI returned invalid JSON formatting", "raw": text[:200]}
        except Exception as e:
            print(f"❌ Gemini Service Error: {str(e)}")
            return {"error": f"Gemini API Error: {str(e)}"}

    async def analyze_monthly(self, entries: list):
        prompt = f"""
        Evaluate the following MONTHLY collection of internship diary entries:
        ENTRIES: {json.dumps(entries, indent=2)}
        
        Note: Each entry includes description, learnings, blockers, hours, and links. Analyze the progression of challenges (blockers) and knowledge gain (learnings) across the month.

        Provide a comprehensive professional evaluation for this MONTH in strictly structured JSON format:
        - overall_score: (1-100 total score based on total hours, depth of learning, and consistency)
        - skill_distribution: (An object mapping skills to percentages, e.g., {{"React": 40, "Node.js": 20}})
        - strengths: [Top 3 professional strengths demonstrated this month]
        - weaknesses: [Areas where the intern is struggling based on entry detail or unresolved blockers]
        - progress_trend: (Sentence describing path from week 1 to 4 in terms of difficulty and mastery)
        - recommendations: (Long-term learning advice tailored to the identified skill gaps)

        Ensure strictly valid JSON. Do not include extra text.
        """
        try:
            response = await self.model.generate_content_async(prompt)
            
            if not response.candidates or not response.candidates[0].content.parts:
                return {"error": "Monthly report blocked by AI safety filters."}
                
            text = response.text
            result = validate_json(text)
            
            if not result:
                retry_response = await self.model.generate_content_async(prompt + "\nReply ONLY with the JSON block.")
                result = validate_json(retry_response.text)

            return result or {"error": "AI returned invalid JSON formatting", "raw": text[:200]}
        except Exception as e:
            print(f"❌ Gemini Monthly Error: {str(e)}")
            return {"error": f"Gemini API Error: {str(e)}"}
