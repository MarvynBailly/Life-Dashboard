"""Database module for Life Dashboard."""
from .models import Base, Todo, Note, JournalEntry, ApiCache, DashboardLayout
from .schemas import (
    TodoCreate, TodoUpdate, TodoResponse,
    NoteCreate, NoteUpdate, NoteResponse,
    JournalCreate, JournalUpdate, JournalResponse,
    LayoutData
)
from .crud import (
    get_db, init_db,
    create_todo, get_todos, get_todo, update_todo, delete_todo, toggle_todo,
    create_note, get_notes, get_note, update_note, delete_note,
    create_journal_entry, get_journal_entries, get_journal_entry, update_journal_entry,
    get_layout, save_layout,
    get_cached_response, set_cached_response
)

__all__ = [
    "Base", "Todo", "Note", "JournalEntry", "ApiCache", "DashboardLayout",
    "TodoCreate", "TodoUpdate", "TodoResponse",
    "NoteCreate", "NoteUpdate", "NoteResponse",
    "JournalCreate", "JournalUpdate", "JournalResponse",
    "LayoutData",
    "get_db", "init_db",
    "create_todo", "get_todos", "get_todo", "update_todo", "delete_todo", "toggle_todo",
    "create_note", "get_notes", "get_note", "update_note", "delete_note",
    "create_journal_entry", "get_journal_entries", "get_journal_entry", "update_journal_entry",
    "get_layout", "save_layout",
    "get_cached_response", "set_cached_response"
]
