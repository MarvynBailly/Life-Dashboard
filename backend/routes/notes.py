"""Notes API routes."""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ..database.crud import (
    get_db, create_note, get_notes, get_note, update_note, delete_note
)
from ..database.schemas import NoteCreate, NoteUpdate, NoteResponse

router = APIRouter()


@router.get("")
async def list_notes(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    search: Optional[str] = Query(None, min_length=2),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """List notes with optional filtering."""
    with get_db() as db:
        notes = get_notes(db, from_date=from_date, to_date=to_date,
                         search=search, limit=limit, offset=offset)
        result = [NoteResponse.model_validate(n).model_dump(mode='json') for n in notes]
        return JSONResponse(content=result)


@router.get("/recent")
async def list_recent_notes(limit: int = Query(10, ge=1, le=50)):
    """Get recent notes for the dashboard."""
    with get_db() as db:
        notes = get_notes(db, limit=limit)
        result = [NoteResponse.model_validate(n).model_dump(mode='json') for n in notes]
        return JSONResponse(content=result)


@router.get("/{note_id}")
async def get_single_note(note_id: int):
    """Get a single note by ID."""
    with get_db() as db:
        note = get_note(db, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        result = NoteResponse.model_validate(note).model_dump(mode='json')
        return JSONResponse(content=result)


@router.post("", status_code=201)
async def create_new_note(note_data: NoteCreate):
    """Create a new note."""
    with get_db() as db:
        note = create_note(
            db,
            content=note_data.content,
            note_date=note_data.note_date,
            title=note_data.title,
            tags=note_data.tags
        )
        result = NoteResponse.model_validate(note).model_dump(mode='json')
        return JSONResponse(content=result, status_code=201)


@router.patch("/{note_id}")
async def update_existing_note(note_id: int, note_data: NoteUpdate):
    """Update an existing note."""
    with get_db() as db:
        update_data = {k: v for k, v in note_data.model_dump().items() if v is not None}
        note = update_note(db, note_id, **update_data)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        result = NoteResponse.model_validate(note).model_dump(mode='json')
        return JSONResponse(content=result)


@router.delete("/{note_id}", status_code=204)
async def delete_existing_note(note_id: int):
    """Delete a note."""
    with get_db() as db:
        if not delete_note(db, note_id):
            raise HTTPException(status_code=404, detail="Note not found")
