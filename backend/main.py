import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# CRITICAL: Load environment variables BEFORE importing routes/services
# so that API keys are available during initialization
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# Now we can safely import routes
from .routes import analyze_routes
from .database.db import init_db

# Initialize Database
init_db()

app = FastAPI(title="VTU Diary AI Evaluator API")

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- Routes ---

@app.get("/health")
def health():
    return {"status": "healthy", "service": "vtu-diary-ai-evaluator"}

# Include the analysis routes
app.include_router(analyze_routes.router)

if __name__ == "__main__":
    import uvicorn
    # Defaulting to 8000 for local development
    uvicorn.run(app, host="0.0.0.0", port=8000)
