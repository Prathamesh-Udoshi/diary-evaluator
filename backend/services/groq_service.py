import os
from groq import Groq # type: ignore
from dotenv import load_dotenv
import json
from ..utils.common import validate_json

load_dotenv()

class GroqService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment.")
        self.client = Groq(api_key=self.api_key)
        self.model = "llama-3.1-8b-instant"

    async def analyze_daily(self, data: dict):
        # Extract fields for prompt
        date = data.get("date", "N/A")
        desc = data.get("description", "N/A")
        hours = data.get("hours", "N/A")
        learns = data.get("learnings", "N/A")
        blocks = data.get("blockers", "N/A")
        links = data.get("links", "N/A")

        prompt = f"""
        Analyze the following internship diary entry for {date}.
        - Description: {desc}
        - Hours Worked: {hours}
        - Key Learnings: {learns}
        - Blockers/Challenges: {blocks}
        - References: {links}

        Provide a professional evaluation in JSON format with the following keys:
        - clarity: (1-10) Evaluation of how well the tasks were communicated.
        - depth: (1-10) Evaluation of details provided in description and learnings.
        - technical_relevance: (1-10) Evaluation of the complexity and technical nature of the work.
        - productivity: (1-10) Based on output vs hours spent.
        - consistency: (1-10) How the intern handled blockers or followed through on goals.
        - skills: [List specific technical skills demonstrated]
        - summary: (Exactly one sentence summarizing the day's contribution)
        - improvement: (Actionable advice for the next working day based on today's blockers/learnings)

        Return ONLY strictly valid JSON.
        """

        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.1, # Keep it deterministic for JSON
            )
            text = response.choices[0].message.content
            result = validate_json(text)
            
            # Simple retry/correction if parsing failed
            if not result:
                # Ask more strictly
                response = self.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt + " ERROR: Previous output was not valid JSON. Ensure strictly valid JSON only."}],
                    model=self.model,
                )
                result = validate_json(response.choices[0].message.content)

            return result or {
                "error": "Failed to parse JSON from LLM",
                "raw_output": text[:200]
            }
        except Exception as e:
            return {"error": str(e)}
