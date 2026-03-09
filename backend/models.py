from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    start_date = Column(DateTime, default=datetime.datetime.utcnow)
    last_planned_date = Column(Date, nullable=True)
    tasks = relationship("Task", back_populates="owner")
    chats = relationship("ChatHistory", back_populates="owner")
    daily_logs = relationship("DailyLog", back_populates="owner")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    activity = Column(String)
    time = Column(String)
    task_type = Column(String)
    xp = Column(Integer, default=50)
    completed = Column(Boolean, default=False)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    is_custom = Column(Boolean, default=False)
    owner = relationship("User", back_populates="tasks")

class DailyLog(Base):
    """Tracks which tasks were completed on which specific date."""
    __tablename__ = "daily_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    task_time = Column(String)       # "05:00"
    task_activity = Column(String)
    task_xp = Column(Integer, default=50)
    xp_earned = Column(Integer, default=0)          # Actual XP earned (fair play calc)
    date = Column(Date, default=datetime.date.today)
    completed = Column(Boolean, default=True)
    status = Column(String, default="pending")      # pending / executing / completed
    executed_at = Column(DateTime, nullable=True)    # When user clicked Execute
    completed_at = Column(DateTime, nullable=True)   # When user clicked Complete
    time_diff_minutes = Column(Float, nullable=True) # Diff from scheduled time (negative=early, positive=late)
    owner = relationship("User", back_populates="daily_logs")

class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    sender = Column(String)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner = relationship("User", back_populates="chats")

class AgentKnowledge(Base):
    __tablename__ = "agent_knowledge"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    key = Column(String, index=True)
    value = Column(Text)
    context_relevance = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
