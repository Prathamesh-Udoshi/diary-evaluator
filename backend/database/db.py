import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "diary_analysis.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS diary_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            input_hash TEXT NOT NULL UNIQUE,
            result_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_cached_result(input_hash: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT result_json FROM diary_analysis WHERE input_hash = ?", (input_hash,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None

def store_result(type: str, input_hash: str, result: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO diary_analysis (type, input_hash, result_json) VALUES (?, ?, ?)",
            (type, input_hash, json.dumps(result))
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # Already exists, could update or ignore
        pass
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
