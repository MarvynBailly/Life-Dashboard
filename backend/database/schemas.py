"""Pydantic schemas for API request/response validation."""
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# Todo Schemas
# =============================================================================

class TodoBase(BaseModel):
    """Base schema for todo items."""
    text: str = Field(..., min_length=1)
    status: str = Field(default="incomplete", pattern="^(incomplete|completed|moved)$")
    indent_level: int = Field(default=0, ge=0)
    parent_id: Optional[int] = None
    priority: int = Field(default=0, ge=0, le=5)
    due_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)


class TodoCreate(TodoBase):
    """Schema for creating a new todo."""
    original_date: date = Field(default_factory=date.today)


class TodoUpdate(BaseModel):
    """Schema for updating an existing todo."""
    text: Optional[str] = Field(None, min_length=1)
    status: Optional[str] = Field(None, pattern="^(incomplete|completed|moved)$")
    indent_level: Optional[int] = Field(None, ge=0)
    parent_id: Optional[int] = None
    priority: Optional[int] = Field(None, ge=0, le=5)
    due_date: Optional[date] = None
    tags: Optional[List[str]] = None


class TodoResponse(BaseModel):
    """Schema for todo response."""
    id: int
    text: str
    status: str
    indent_level: int
    parent_id: Optional[int] = None
    priority: int
    due_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)
    original_date: date
    migrated_from_id: Optional[int] = None
    migrated_to_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def ensure_tags_list(cls, v):
        """Convert NULL tags to empty list."""
        return v if v is not None else []

    class Config:
        from_attributes = True


# =============================================================================
# Note Schemas
# =============================================================================

class NoteBase(BaseModel):
    """Base schema for notes."""
    title: Optional[str] = Field(None, max_length=255)
    content: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)


class NoteCreate(NoteBase):
    """Schema for creating a new note."""
    note_date: date = Field(default_factory=date.today)


class NoteUpdate(BaseModel):
    """Schema for updating an existing note."""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    tags: Optional[List[str]] = None


class NoteResponse(BaseModel):
    """Schema for note response."""
    id: int
    title: Optional[str] = None
    content: str
    tags: List[str] = Field(default_factory=list)
    note_date: date
    created_at: datetime
    updated_at: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def ensure_tags_list(cls, v):
        """Convert NULL tags to empty list."""
        return v if v is not None else []

    class Config:
        from_attributes = True


# =============================================================================
# Journal Schemas
# =============================================================================

class JournalBase(BaseModel):
    """Base schema for journal entries."""
    content: str = Field(..., min_length=1)
    mood: Optional[int] = Field(None, ge=1, le=5)


class JournalCreate(JournalBase):
    """Schema for creating a new journal entry."""
    entry_date: date = Field(default_factory=date.today)


class JournalUpdate(BaseModel):
    """Schema for updating an existing journal entry."""
    content: Optional[str] = Field(None, min_length=1)
    mood: Optional[int] = Field(None, ge=1, le=5)


class JournalResponse(JournalBase):
    """Schema for journal entry response."""
    id: int
    entry_date: date
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Layout Schema
# =============================================================================

class ModulePosition(BaseModel):
    """Schema for a single module's position and state."""
    top: Optional[str] = None
    left: Optional[str] = None
    right: Optional[str] = None
    bottom: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    collapsed: bool = False


class LayoutData(BaseModel):
    """Schema for dashboard layout data."""
    modules: dict[str, ModulePosition] = Field(default_factory=dict)


# =============================================================================
# API Response Wrappers
# =============================================================================

class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int


class StatsResponse(BaseModel):
    """Dashboard statistics response."""
    total_coding_time: str
    projects_count: int
    languages_count: int
    active_todos: int
    notes_count: int
    journal_streak: int
