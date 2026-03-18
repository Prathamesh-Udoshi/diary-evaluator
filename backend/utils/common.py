import hashlib
import json

def generate_hash(data: dict or list) -> str:
    """
    Generate SHA256 hash of a JSON-serializable object.
    """
    # Canonical string representation (sorted keys)
    encoded = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()

def validate_json(text: str) -> dict:
    """
    Attempt to extract and parse JSON from LLM response text.
    Sometimes LLMs wrap JSON in backticks (e.g., ```json ... ```)
    """
    try:
        # Simple parse first
        return json.loads(text)
    except json.JSONDecodeError:
        # Look for code blocks if it's text-wrapped
        import re
        match = re.search(r"```json\n(.*?)\n```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Second attempt: strip leading/trailing non-json chars or just raw backticks
        cleaned = text.strip().replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None
