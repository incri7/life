"""
Migration: Add duration_minutes column to daily_logs table.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            conn.execute(text("ALTER TABLE daily_logs ADD COLUMN duration_minutes FLOAT NULL"))
            print("[OK] Added duration_minutes column")
        except Exception as e:
            print(f"[Skipped] (may already exist): {e}")
        
        print("\n[OK] Migration complete!")

if __name__ == "__main__":
    migrate()
