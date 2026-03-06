from pydantic import BaseModel
from typing import List, Optional
import datetime

class TaskBase(BaseModel):
    activity: str
    time: str
    task_type: str
    xp: int = 50
    completed: bool = False
    is_custom: bool = False

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    completed: Optional[bool] = None
    activity: Optional[str] = None
    time: Optional[str] = None

class Task(TaskBase):
    id: int
    user_id: int
    date: datetime.datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    level: int
    xp: int
    start_date: datetime.datetime
    last_planned_date: Optional[datetime.date] = None
    tasks: List[Task] = []

    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    sender: str
    text: str

class ChatHistory(ChatBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class OracleResponse(BaseModel):
    message: str
    action: str = "none"
    actionData: Optional[dict] = None
