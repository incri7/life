from database import engine, Base
import models  # Import models to ensure they are registered with Base

def init_db():
    print("Initializing database schema...")
    try:
        # This will create tables if they don't exist
        Base.metadata.create_all(bind=engine)
        print("Database schema initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == "__main__":
    init_db()
