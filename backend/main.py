from fastapi import FastAPI, Depends, HTTPException, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas
from database import SessionLocal, engine
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import List
import datetime

load_dotenv()

app = FastAPI(title="Life RPG API")

@app.on_event("startup")
def startup_event():
    # Initialize DB (In each forked worker reliably)
    print("Startup: Creating database schema if not exists...")
    models.Base.metadata.create_all(bind=engine)
    
    # Configure AI
    api_key = os.getenv("VITE_X_3f92e8a1_c4d5_4b6a_8e7f_9d0c1b2a3a4b") # VITE_GEMINI_API_KEY
    if api_key:
        print("Startup: Configuring Gemini AI...")
        genai.configure(api_key=api_key)
    else:
        print("Startup Warning: VITE_X_3f92e8a1_c4d5_4b6a_8e7f_9d0c1b2a3a4b not found in environment")

# CORS
frontend_url = os.getenv("VITE_X_b9e8d7c6_a5b4_4321_8765_4d3c2b1a0e9f", "*") # FRONTEND_URL
origins = [frontend_url] if frontend_url != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if frontend_url != "*" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Startup logic handles database and AI configuration

def get_system_prompt():
    """Reads the system_prompt.md file from the project root."""
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "system_prompt.md"))
    if not os.path.exists(path):
        return "You are 'The Oracle', an advanced Agentic AI Life Coach."
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

ORACLE_SYSTEM_PROMPT = get_system_prompt()

@app.get("/")
@app.head("/")
def read_root():
    return {"status": "Life RPG Online"}

@app.get("/api/v1/user/{username}", response_model=schemas.User)
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        user = models.User(username=username)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@app.get("/api/v1/tasks/{username}", response_model=List[schemas.Task])
def get_tasks(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.tasks

class ToggleTaskRequest(BaseModel):
    time: str
    activity: str
    xp: int = 50
    is_custom: bool = False

@app.post("/api/v1/tasks/{username}/toggle")
def toggle_task(username: str, payload: ToggleTaskRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    
    # Find existing or create dynamically for life.md tasks
    task = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == payload.time).first()
    
    if not task:
        task = models.Task(
            user_id=user.id,
            activity=payload.activity,
            time=payload.time,
            task_type="fixed",
            xp=payload.xp,
            is_custom=payload.is_custom
        )
        db.add(task)
        db.commit()
        db.refresh(task)
    
    task.completed = not task.completed
    if task.completed:
        user.xp += task.xp
    else:
        user.xp = max(0, user.xp - task.xp)
    
    # Level Up Logic
    new_level = int((user.xp / 100)**0.5) + 1
    user.level = new_level
    
    db.commit()
    return {"status": "updated", "completed": task.completed, "xp": user.xp, "level": user.level}

# ── DAILY TRACKING ──────────────────────────────────────────────────────────

@app.get("/api/v1/daily/{username}")
def get_today_completions(username: str, db: Session = Depends(get_db)):
    """Return list of task_times completed today."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    today = datetime.date.today()
    logs = db.query(models.DailyLog).filter(
        models.DailyLog.user_id == user.id,
        models.DailyLog.date == today,
        models.DailyLog.completed == True
    ).all()
    return [{"task_time": l.task_time, "task_activity": l.task_activity, "task_xp": l.task_xp} for l in logs]

@app.post("/api/v1/daily/{username}/toggle")
def toggle_daily_task(username: str, payload: ToggleTaskRequest, db: Session = Depends(get_db)):
    """Toggle a task's completion for today. Adds XP on complete, removes on undo."""
    user = db.query(models.User).filter(models.User.username == username).first()
    today = datetime.date.today()
    
    log = db.query(models.DailyLog).filter(
        models.DailyLog.user_id == user.id,
        models.DailyLog.task_time == payload.time,
        models.DailyLog.date == today
    ).first()
    
    if log:
        # Undo: remove log entry and subtract XP
        db.delete(log)
        user.xp = max(0, user.xp - payload.xp)
        completed = False
    else:
        # Complete: add log entry and add XP
        log = models.DailyLog(
            user_id=user.id,
            task_time=payload.time,
            task_activity=payload.activity,
            task_xp=payload.xp,
            date=today,
            completed=True
        )
        db.add(log)
        user.xp += payload.xp
        completed = True
    
    # Level Up Logic
    new_level = int((user.xp / 100)**0.5) + 1
    user.level = new_level
    db.commit()
    return {"status": "updated", "completed": completed, "xp": user.xp, "level": user.level}

@app.get("/api/v1/progress/{username}")
def get_progress(username: str, db: Session = Depends(get_db)):
    """Returns overall historical progress: days active, streak, per-day completion rates."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    all_logs = db.query(models.DailyLog).filter(models.DailyLog.user_id == user.id).all()
    
    # Group by date
    from collections import defaultdict
    by_date = defaultdict(list)
    for log in all_logs:
        by_date[str(log.date)].append(log)
    
    # Build history list
    history = []
    for date_str, logs in sorted(by_date.items()):
        history.append({
            "date": date_str,
            "completed": len(logs),
            "xp_earned": sum(l.task_xp for l in logs)
        })
    
    # Streak calculation
    streak = 0
    today = datetime.date.today()
    for i in range(1000):
        check = today - datetime.timedelta(days=i)
        if str(check) in by_date:
            streak += 1
        else:
            break
    
    total_days = len(by_date)
    total_completions = len(all_logs)
    
    return {
        "streak": streak,
        "total_days_active": total_days,
        "total_tasks_completed": total_completions,
        "history": history[-30:]  # Last 30 days
    }


class TaskRequest(BaseModel):
    time: str
    activity: str
    xp: int = 50
    is_custom: bool = True

@app.post("/api/v1/tasks/{username}/manual")
def create_manual_task(username: str, payload: TaskRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    task = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == payload.time).first()
    if task:
        task.activity = payload.activity
        task.xp = payload.xp
    else:
        new_task = models.Task(
            user_id=user.id,
            activity=payload.activity,
            time=payload.time,
            task_type="fixed",
            xp=payload.xp,
            is_custom=payload.is_custom
        )
        db.add(new_task)
    db.commit()
    return {"status": "created"}

@app.put("/api/v1/tasks/{username}/manual/{task_time}")
def edit_manual_task(username: str, task_time: str, payload: TaskRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    task = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == task_time).first()
    if not task:
        task = models.Task(
            user_id=user.id,
            activity=payload.activity,
            time=payload.time,
            task_type="fixed",
            xp=payload.xp,
            is_custom=payload.is_custom
        )
        db.add(task)
    else:
        task.time = payload.time
        task.activity = payload.activity
        task.xp = payload.xp
    db.commit()
    return {"status": "updated"}

@app.delete("/api/v1/tasks/{username}/manual/{task_time}")
def delete_manual_task(username: str, task_time: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    task = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == task_time).first()
    if task:
        db.delete(task)
        db.commit()
    return {"status": "deleted"}

# ── AI-MANAGED SCHEDULING ──────────────────────────────────────────────────

def parse_knowledge_base():
    """Parses knowledge_base.md to get the core schedule anchors."""
    import os, re
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "knowledge_base.md"))
    
    if not os.path.exists(path):
        path = os.path.abspath(os.path.join(os.getcwd(), "..", "knowledge_base.md"))
    
    print(f"DEBUG: Attempting to parse knowledge_base.md at: {path}")
    
    if not os.path.exists(path):
        print(f"ERROR: knowledge_base.md not found at {path}")
        return []
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Failed to read knowledge_base.md: {e}")
        return []
    
    lines = content.split("\n")
    anchors = []
    current_section = "none"
    
    for line in lines:
        trimmed = line.strip()
        if not trimmed: continue
        lower = trimmed.lower()
        
        # Match Fixed Anchors header in knowledge_base.md
        if "fixed anchors" in lower: 
            current_section = "anchors"
            continue
        elif trimmed.startswith("##") and current_section == "anchors": 
            current_section = "none"
            continue
        
        if current_section == "none": continue
        
        # Matches "- **05:00**: Activity" or "- **05:00** Activity" or "05:00 Activity"
        # The user updated it to "- **HH:MM**: Activity"
        time_match = re.search(r"(\d{1,2}:\d{2})\*\*?[:\s]+(.+)$", trimmed)
        if time_match:
            time_str, activity = time_match.groups()
            print(f"DEBUG: Found match - Time: {time_str}, Activity: {activity}")
            try:
                parts = time_str.split(":")
                h = int(parts[0])
                m = int(parts[1])
                
                period = "Morning"
                if h >= 12 and h < 17: period = "Afternoon"
                elif h >= 17 or h < 4: period = "Evening"
                
                xp = 50
                act_low = activity.lower()
                if "gym" in act_low or "exercise" in act_low: xp = 75
                elif "productive time" in act_low or "certification" in act_low: xp = 100
                elif "sleep" in act_low: xp = 25
                
                anchors.append({
                    "time": f"{h:02d}:{m:02d}",
                    "activity": activity.strip(),
                    "xp": xp,
                    "period": period
                })
            except Exception as e:
                print(f"DEBUG: Failed to parse time line '{trimmed}': {e}")
                
    print(f"DEBUG: Parsed {len(anchors)} anchors from knowledge_base.md total.")
    return anchors

@app.get("/api/v1/daily/{username}/plan")
def manage_daily_plan(username: str, db: Session = Depends(get_db)):
    """
    AI-Managed Planner:
    1. Clean Reset: Delete all non-custom core anchors to prevent stale data.
    2. Healing/Seed: Re-add all life.md anchors.
    """
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    anchors = parse_knowledge_base()
    
    # 1. Clear old core anchors (to handle healing and stale resets)
    db.query(models.Task).filter(
        models.Task.user_id == user.id,
        models.Task.is_custom == False
    ).delete()
    
    # 2. Re-seed from life.md Constitution
    for anchor in anchors:
        new_task = models.Task(
            user_id=user.id,
            activity=anchor["activity"],
            time=anchor["time"],
            task_type="fixed",
            xp=anchor["xp"],
            is_custom=False # Marks it as a Core Anchor
        )
        db.add(new_task)

    print(f"DEBUG: Seeded {len(anchors)} core anchors for user {username}")

    db.commit()
    all_tasks = db.query(models.Task).filter(models.Task.user_id == user.id).order_by(models.Task.time).all()
    print(f"DEBUG: Returning {len(all_tasks)} total tasks for user {username}")
    return all_tasks


@app.post("/api/v1/chat/{username}")

async def chat_with_oracle(username: str, user_input: str = Body(..., embed=True), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    
    # Save User Message
    user_msg = models.ChatHistory(user_id=user.id, sender="user", text=user_input)
    db.add(user_msg)
    
    # Oracle Reasoning
    state_context = f"Level: {user.level}, XP: {user.xp}, Tasks: {[t.activity for t in user.tasks if not t.completed]}"
    full_prompt = f"{get_system_prompt()}\n\nUSER STATE: {state_context}\nUSER MESSAGE: {user_input}\n\nReturn JSON."
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(full_prompt)
        import json
        text = response.text
        json_match = text[text.find('{'):text.rfind('}')+1]
        oracle_data = json.loads(json_match)
        
        # Save Oracle Message
        oracle_msg = models.ChatHistory(user_id=user.id, sender="oracle", text=oracle_data['message'])
        db.add(oracle_msg)
        
        # Agentic Actions
        action_type = oracle_data.get('action')
        action_data_raw = oracle_data.get('actionData', {})
        actions_list = action_data_raw if isinstance(action_data_raw, list) else [action_data_raw]
        
        if action_type == 'schedule_task':
            for t_data in actions_list:
                new_task = models.Task(
                    user_id=user.id,
                    activity=t_data.get('activity', 'Unknown Custom Task'),
                    time=t_data.get('time', '12:00'),
                    task_type=t_data.get('type', 'fixed'),
                    xp=t_data.get('xp', 50),
                    is_custom=True
                )
                db.add(new_task)
        elif action_type == 'delete_task':
            for t_data in actions_list:
                target_time = t_data.get('time')
                if target_time:
                    db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == target_time).delete()
        elif action_type == 'edit_task':
            for t_data in actions_list:
                target_time = t_data.get('target_time')
                if target_time:
                    task = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.time == target_time).first()
                    if task:
                        if 'new_time' in t_data:
                            task.time = t_data['new_time']
                        if 'new_activity' in t_data:
                            task.activity = t_data['new_activity']
            
        db.commit()
        return oracle_data
    except Exception as e:
        print(f"Oracle Error: {e}")
        # Send a graceful message back to the UI instead of crashing
        error_msg = str(e)
        if "429" in error_msg or "ResourceExhausted" in error_msg or "quota" in error_msg.lower():
            return {"message": "I'm currently recalibrating my neural net (Rate Limited). Please give me about 60 seconds to process your next request.", "action": "none"}
        return {"message": f"Operational error: {error_msg}", "action": "none"}

@app.get("/api/v1/history/{username}", response_model=List[schemas.ChatHistory])
def get_chat_history(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    return user.chats

@app.get("/api/v1/stats/process/{username}")
def get_process_stats(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.datetime.utcnow()
    delta = now - user.start_date
    
    days = delta.days
    weeks = days // 7
    months = days // 30
    years = days // 365
    
    return {
        "days": days,
        "weeks": weeks,
        "months": months,
        "years": years,
        "start_date": user.start_date.isoformat()
    }
