import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .routes import analyze_routes
from .database.db import init_db

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# Initialize Database
init_db()

app = FastAPI(title="VTU Diary AI Evaluator API")

# --- CORS Configuration ---
# Chrome extensions have unique origins like chrome-extension://<id>
# For development, allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
