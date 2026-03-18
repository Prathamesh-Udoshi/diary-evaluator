# VTU Diary AI Evaluator - Backend

Production-ready FastAPI backend designed specifically for evaluation of internship diaries using Groq (Daily) and Gemini (Weekly/Monthly).

## 📁 Directory Structure

```text
backend/
  ├── main.py             # Entry point & CORS
  ├── routes/              
  │   └── analyze_routes.py # API endpoints
  ├── services/           
  │   ├── groq_service.py   # Daily evaluation
  │   └── gemini_service.py # Bulk analysis
  ├── database/           
  │   └── db.py             # SQLite caching
  ├── utils/              
  │   └── common.py         # Hash & JSON utilities
  ├── .env                # API keys
  └── requirements.txt
```

## 🚀 Getting Started

### 1. Installation
Install the necessary Python packages:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configuration
Create a `.env` file in the `backend/` directory (use `.env.example` as a template):
```env
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

### 3. Run the Backend
```bash
uvicorn main:app --reload --port 8000
```
The server will be live at `http://localhost:8000`.

## 🌐 Chrome Extension Integration

The Chrome extension can communicate with this backend using standard `fetch()` calls. 

### Example Call: Daily Analysis
```javascript
async function analyzeDay(date, description) {
  const response = await fetch("http://localhost:8000/analyze/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, description })
  });
  
  const data = await response.json();
  console.log("Evaluation:", data);
}
```

### ⚡ Caching
This backend implements **SHA256 Content Hashing**. If the same exact content is submitted multiple times, the backend will return the **cached result** from the SQLite database instead of calling the LLM APIs again. This saves both money and processing time.

## 🛠 Features
- **FastAPI**: High-performance async framework.
- **CORS Support**: Configured to work seamlessly with Chrome extension origins.
- **LLM Selection**: Optimized using `llama-3.1-8b` for speed on daily entries and `gemini-1.5-pro` for reasoning on bulk reports.
- **Robust Parsing**: LLM responses are validated and cleaned to ensure strictly valid JSON output.
