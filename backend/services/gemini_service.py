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
            raise ValueError("GEMINI_API_KEY not found in environment.")
        genai.configure(api_key=self.api_key)
        self.model_name = "gemini-1.5-pro"
        self.model = genai.GenerativeModel(self.model_name)

    async def analyze_weekly(self, entries: list):
        prompt = f"""
        Evaluate the following weekly collection of internship diary entries:
        ENTRIES: {json.dumps(entries, indent=2)}
        
        Note: Each entry includes description, learnings, blockers, hours, and links.
        
        Provide a consolidated professional evaluation for this WEEK in strictly structured JSON format:
        - weekly_score: (1-100 total score considering technical complexity and consistency)
        - consistency_score: (1-100 score on how regular and uniform the entries and effort (hours) were)
        - growth_trend: (Brief 3-5 word sentiment like 'Steady improvement' or 'Minor dip in performance')
        - top_skills: [List of the 3 most prominent skills developed this week]
        - weak_areas: [What needs focused effort next week based on blockers]
        - summary: (A 2-3 sentence overview of this week's progress)
        - suggestions: (One actionable coaching point for the next week based on learnings and blockers)

        Ensure strictly valid JSON. Do not include extra text.
        """
        try:
            response = self.model.generate_content(prompt)
            result = validate_json(response.text)
            
            # Simple retry/correction if parsing failed
            if not result:
                response = self.model.generate_content(prompt + " ERROR: Return strictly valid JSON only.")
                result = validate_json(response.text)

            return result or {"error": "Failed to parse JSON", "raw": response.text[:200]}
        except Exception as e:
            return {"error": str(e)}

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
            response = self.model.generate_content(prompt)
            result = validate_json(response.text)
            
            # Simple retry/correction if parsing failed
            if not result:
                response = self.model.generate_content(prompt + " ERROR: Return strictly valid JSON only.")
                result = validate_json(response.text)

            return result or {"error": "Failed to parse JSON", "raw": response.text[:200]}
        except Exception as e:
            return {"error": str(e)}
