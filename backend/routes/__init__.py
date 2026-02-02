"""Route handlers for Life Dashboard."""
from .dashboard import router as dashboard_router
from .todos import router as todos_router
from .notes import router as notes_router
from .journal import router as journal_router

__all__ = ["dashboard_router", "todos_router", "notes_router", "journal_router"]
