from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("X_e2f1a0b9_c8d7_4e6f_ac5b_4d3c2b1a0e9f") # DATABASE_URL

if not DATABASE_URL:
    print("WARNING: DATABASE_URL (X_e2f1a0b9_c8d7_4e6f_ac5b_4d3c2b1a0e9f) not set. Falling back to local SQLite.")
    DATABASE_URL = "sqlite:///./life_rpg.db"

# Render/Heroku sometimes provide "postgres://" which SQLAlchemy 1.4+ doesn't support.
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
