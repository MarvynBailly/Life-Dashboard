"""CRUD operations for Life Dashboard database."""
from datetime import datetime, date, timedelta
from typing import List, Optional, Any
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager

from .models import Base, Todo, Note, JournalEntry, ApiCache, DashboardLayout
from ..config import get_settings

settings = get_settings()

# Create database engine
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}  # SQLite specific
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db():
    """Get database session context manager."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# =============================================================================
# Todo CRUD Operations
# =============================================================================

def create_todo(db: Session, text: str, original_date: date = None,
                indent_level: int = 0, parent_id: int = None,
                priority: int = 0, due_date: date = None,
                tags: List[str] = None) -> Todo:
    """Create a new todo item."""
    todo = Todo(
        text=text,
        original_date=original_date or date.today(),
        indent_level=indent_level,
        parent_id=parent_id,
        priority=priority,
        due_date=due_date,
        tags=tags or []
    )
    db.add(todo)
    db.flush()
    return todo


def get_todos(db: Session, status: str = None,
              from_date: date = None, to_date: date = None,
              limit: int = 100, offset: int = 0) -> List[Todo]:
    """Get todos with optional filtering."""
    query = db.query(Todo)

    if status:
        query = query.filter(Todo.status == status)
    if from_date:
        query = query.filter(Todo.original_date >= from_date)
    if to_date:
        query = query.filter(Todo.original_date <= to_date)

    return query.order_by(desc(Todo.original_date), Todo.id).offset(offset).limit(limit).all()


def get_todo(db: Session, todo_id: int) -> Optional[Todo]:
    """Get a single todo by ID."""
    return db.query(Todo).filter(Todo.id == todo_id).first()


def update_todo(db: Session, todo_id: int, **kwargs) -> Optional[Todo]:
    """Update an existing todo."""
    todo = get_todo(db, todo_id)
    if todo:
        for key, value in kwargs.items():
            if hasattr(todo, key) and value is not None:
                setattr(todo, key, value)
        db.flush()
    return todo


def delete_todo(db: Session, todo_id: int) -> bool:
    """Delete a todo by ID."""
    todo = get_todo(db, todo_id)
    if todo:
        db.delete(todo)
        return True
    return False


def toggle_todo(db: Session, todo_id: int) -> Optional[Todo]:
    """Toggle todo completion status."""
    todo = get_todo(db, todo_id)
    if todo:
        if todo.status == "completed":
            todo.status = "incomplete"
        else:
            todo.status = "completed"
        db.flush()
    return todo


def get_active_todos(db: Session, limit: int = 50) -> List[Todo]:
    """Get active (incomplete) todos."""
    return db.query(Todo).filter(
        Todo.status == "incomplete"
    ).order_by(desc(Todo.original_date), Todo.priority.desc()).limit(limit).all()


# =============================================================================
# Note CRUD Operations
# =============================================================================

def create_note(db: Session, content: str, note_date: date = None,
                title: str = None, tags: List[str] = None) -> Note:
    """Create a new note."""
    note = Note(
        title=title,
        content=content,
        note_date=note_date or date.today(),
        tags=tags or []
    )
    db.add(note)
    db.flush()
    return note


def get_notes(db: Session, from_date: date = None, to_date: date = None,
              search: str = None, limit: int = 100, offset: int = 0) -> List[Note]:
    """Get notes with optional filtering."""
    query = db.query(Note)

    if from_date:
        query = query.filter(Note.note_date >= from_date)
    if to_date:
        query = query.filter(Note.note_date <= to_date)
    if search:
        query = query.filter(
            Note.content.ilike(f"%{search}%") |
            Note.title.ilike(f"%{search}%")
        )

    return query.order_by(desc(Note.note_date), desc(Note.created_at)).offset(offset).limit(limit).all()


def get_note(db: Session, note_id: int) -> Optional[Note]:
    """Get a single note by ID."""
    return db.query(Note).filter(Note.id == note_id).first()


def update_note(db: Session, note_id: int, **kwargs) -> Optional[Note]:
    """Update an existing note."""
    note = get_note(db, note_id)
    if note:
        for key, value in kwargs.items():
            if hasattr(note, key) and value is not None:
                setattr(note, key, value)
        db.flush()
    return note


def delete_note(db: Session, note_id: int) -> bool:
    """Delete a note by ID."""
    note = get_note(db, note_id)
    if note:
        db.delete(note)
        return True
    return False


# =============================================================================
# Journal CRUD Operations
# =============================================================================

def create_journal_entry(db: Session, content: str, entry_date: date = None,
                         mood: int = None) -> JournalEntry:
    """Create a new journal entry."""
    entry = JournalEntry(
        content=content,
        entry_date=entry_date or date.today(),
        mood=mood
    )
    db.add(entry)
    db.flush()
    return entry


def get_journal_entries(db: Session, from_date: date = None, to_date: date = None,
                        limit: int = 30, offset: int = 0) -> List[JournalEntry]:
    """Get journal entries with optional filtering."""
    query = db.query(JournalEntry)

    if from_date:
        query = query.filter(JournalEntry.entry_date >= from_date)
    if to_date:
        query = query.filter(JournalEntry.entry_date <= to_date)

    return query.order_by(desc(JournalEntry.entry_date)).offset(offset).limit(limit).all()


def get_journal_entry(db: Session, entry_date: date) -> Optional[JournalEntry]:
    """Get a journal entry by date."""
    return db.query(JournalEntry).filter(JournalEntry.entry_date == entry_date).first()


def update_journal_entry(db: Session, entry_date: date, **kwargs) -> Optional[JournalEntry]:
    """Update an existing journal entry."""
    entry = get_journal_entry(db, entry_date)
    if entry:
        for key, value in kwargs.items():
            if hasattr(entry, key) and value is not None:
                setattr(entry, key, value)
        db.flush()
    return entry


def get_journal_streak(db: Session) -> int:
    """Calculate current journaling streak."""
    today = date.today()
    streak = 0
    current_date = today

    while True:
        entry = get_journal_entry(db, current_date)
        if entry:
            streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    return streak


# =============================================================================
# Layout Operations
# =============================================================================

def get_layout(db: Session) -> Optional[dict]:
    """Get the saved dashboard layout."""
    layout = db.query(DashboardLayout).order_by(desc(DashboardLayout.id)).first()
    return layout.layout_data if layout else None


def save_layout(db: Session, layout_data: dict) -> DashboardLayout:
    """Save dashboard layout (upsert)."""
    existing = db.query(DashboardLayout).first()
    if existing:
        existing.layout_data = layout_data
        db.flush()
        return existing
    else:
        layout = DashboardLayout(layout_data=layout_data)
        db.add(layout)
        db.flush()
        return layout


# =============================================================================
# Cache Operations
# =============================================================================

def get_cached_response(db: Session, api_name: str, endpoint: str) -> Optional[Any]:
    """Get cached API response if not expired."""
    cache = db.query(ApiCache).filter(
        ApiCache.api_name == api_name,
        ApiCache.endpoint == endpoint
    ).first()

    if cache and not cache.is_expired:
        return cache.response_data
    return None


def set_cached_response(db: Session, api_name: str, endpoint: str,
                        response_data: Any, ttl_seconds: int = 900) -> ApiCache:
    """Cache an API response."""
    expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)

    existing = db.query(ApiCache).filter(
        ApiCache.api_name == api_name,
        ApiCache.endpoint == endpoint
    ).first()

    if existing:
        existing.response_data = response_data
        existing.cached_at = datetime.utcnow()
        existing.expires_at = expires_at
        db.flush()
        return existing
    else:
        cache = ApiCache(
            api_name=api_name,
            endpoint=endpoint,
            response_data=response_data,
            expires_at=expires_at
        )
        db.add(cache)
        db.flush()
        return cache


def clear_expired_cache(db: Session) -> int:
    """Remove expired cache entries and return count deleted."""
    result = db.query(ApiCache).filter(
        ApiCache.expires_at < datetime.utcnow()
    ).delete()
    return result
