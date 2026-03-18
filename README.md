# VTU Internship Diary Evaluator 🛡️

An AI-powered system designed to fetch, organize, and evaluate VTU internship diary entries. It uses advanced LLMs to provide structured feedback, identify skills, and track progress over time.

---

## 🛠️ Components

### 1. Chrome Extension (Frontend)
- **Automatic Sync**: Fetches and groups diary entries directly from the VTU portal.
- **Three Views**:
  - **Day View**: A visual calendar with activity density indicators.
  - **Week View**: Grouped by performance across a 7-day window.
  - **Month View**: Broad overview of achievements.
- **Smart Filtering**: Filter by month, week, or specific days.

### 2. FastAPI Backend (AI Core)
- **Dual-Model Logic**:
  - **Daily Evaluation**: Powered by **Groq (Llama-3.1)** for ultra-fast, specific daily feedback.
  - **Bulk Evaluation**: Powered by **Google Gemini-1.5-Pro** for high-reasoning weekly/monthly deep dives.
- **Intelligent Caching**: Uses SHA256 content hashing and SQLite to instantly return previously analyzed entries—saving API costs.
- **Security**: Environment variable-based API key management.

---

## 🚀 Getting Started

### Backend Setup
1. **Navigate to backend**:
   ```bash
   cd backend
   ```
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure API Keys**:
   Create a `.env` file (see `.env.example`) and add your `GROQ_API_KEY` and `GEMINI_API_KEY`.
4. **Run the server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Extension Setup
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `/extension` folder.
