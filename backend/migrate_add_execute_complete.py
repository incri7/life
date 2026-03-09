"""
Migration: Add execute/complete tracking columns to daily_logs table.
Run once to add new columns for the Execute/Complete dual-button flow.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # Add new columns
        columns = [
            "ALTER TABLE daily_logs ADD COLUMN xp_earned INTEGER DEFAULT 0",
            "ALTER TABLE daily_logs ADD COLUMN status VARCHAR DEFAULT 'pending'",
            "ALTER TABLE daily_logs ADD COLUMN executed_at TIMESTAMP NULL",
            "ALTER TABLE daily_logs ADD COLUMN completed_at TIMESTAMP NULL",
            "ALTER TABLE daily_logs ADD COLUMN time_diff_minutes FLOAT NULL",
        ]
        
        for sql in columns:
            try:
                conn.execute(text(sql))
                print(f"[OK] {sql}")
            except Exception as e:
                print(f"[Skipped] (may already exist): {e}")
        
        try:
            # Update existing completed logs to have 'completed' status
            conn.execute(text("UPDATE daily_logs SET status = 'completed' WHERE completed = true"))
            print("[OK] Updated existing completed logs")
        except Exception as e:
            print(f"Error updating logs: {e}")
        
        print("\n[OK] Migration complete!")

if __name__ == "__main__":
    migrate()
