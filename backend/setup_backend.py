import os
import sqlite3
from main import app # This will trigger model creation if we run it right
import models
from database import engine

def setup():
    print("=== Life RPG Backend Setup (SQLite Edition) ===")
    
    # 1. Initialize DB Tables
    print("Initializing SQLite database tables...")
    try:
        models.Base.metadata.create_all(bind=engine)
        print("SUCCESS: Database 'life_rpg.db' initialized.")
    except Exception as e:
        print(f"ERROR: Could not initialize database: {e}")
        return

    # 2. Update .env file
    env_content = f"""# Life RPG Backend Configuration
VITE_X_e2f1a0b9_c8d7_4e6f_ac5b_4d3c2b1a0e9f=sqlite:///./life_rpg.db

# Gemini API Key (Copied from local dev)
VITE_X_3f92e8a1_c4d5_4b6a_8e7f_9d0c1b2a3a4b=AIzaSyB1uXY16Jpu37Fh2-PCradoOGexkbpGTW8
"""
    
    with open(".env", "w") as f:
        f.write(env_content)
    print("\nSUCCESS: .env file configured.")
    print("=== Setup Complete! Run 'uvicorn main:app --reload' to start. ===")

if __name__ == "__main__":
    setup()
