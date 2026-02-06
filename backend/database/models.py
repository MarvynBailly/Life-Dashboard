"""SQLAlchemy database models for Life Dashboard."""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime, Boolean, ForeignKey, JSON,
    CheckConstraint, UniqueConstraint, create_engine
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Todo(Base):
    """Todo task model with hierarchy support."""
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(Text, nullable=False)
    status = Column(
        String(20),
        CheckConstraint("status IN ('incomplete', 'completed', 'moved')"),
        default="incomplete"
    )
    indent_level = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("todos.id"), nullable=True)
    priority = Column(Integer, default=0)
    due_date = Column(Date, nullable=True)
    tags = Column(JSON, default=list)
    original_date = Column(Date, nullable=False)
    migrated_from_id = Column(Integer, ForeignKey("todos.id"), nullable=True)
    migrated_to_id = Column(Integer, ForeignKey("todos.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("Todo", remote_side=[id], foreign_keys=[parent_id], backref="children")
    migrated_from = relationship("Todo", remote_side=[id], foreign_keys=[migrated_from_id])
    migrated_to = relationship("Todo", remote_side=[id], foreign_keys=[migrated_to_id])

    def __repr__(self):
        return f"<Todo(id={self.id}, text='{self.text[:30]}...', status='{self.status}')>"


class Note(Base):
    """Note model for storing markdown notes."""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    tags = Column(JSON, default=list)
    note_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Note(id={self.id}, title='{self.title}', date={self.note_date})>"


class JournalEntry(Base):
    """Journal entry model for daily journaling with mood tracking."""
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(Text, nullable=False)
    mood = Column(
        Integer,
        CheckConstraint("mood BETWEEN 1 AND 5"),
        nullable=True
    )
    entry_date = Column(Date, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<JournalEntry(id={self.id}, date={self.entry_date}, mood={self.mood})>"


class ApiCache(Base):
    """API response cache for reducing external API calls."""
    __tablename__ = "api_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    api_name = Column(String(50), nullable=False)
    endpoint = Column(String(255), nullable=False)
    response_data = Column(JSON, nullable=False)
    cached_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("api_name", "endpoint", name="uix_api_endpoint"),
    )

    def __repr__(self):
        return f"<ApiCache(api={self.api_name}, endpoint='{self.endpoint}')>"

    @property
    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return datetime.utcnow() > self.expires_at


class CubeCategory(Base):
    """Category for cube algorithms (e.g. OLL, PLL, F2L)."""
    __tablename__ = "cube_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    algorithms = relationship("CubeAlgorithm", back_populates="category", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CubeCategory(id={self.id}, name='{self.name}')>"


class CubeAlgorithm(Base):
    """A single cube algorithm within a category."""
    __tablename__ = "cube_algorithms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("cube_categories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    notation = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("CubeCategory", back_populates="algorithms")

    def __repr__(self):
        return f"<CubeAlgorithm(id={self.id}, name='{self.name}')>"


class DashboardLayout(Base):
    """Dashboard layout configuration storage."""
    __tablename__ = "dashboard_layout"

    id = Column(Integer, primary_key=True, autoincrement=True)
    layout_data = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DashboardLayout(id={self.id}, updated_at={self.updated_at})>"
