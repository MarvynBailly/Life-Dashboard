"""Journal API routes."""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ..database.crud import (
    get_db, create_journal_entry, get_journal_entries, get_journal_entry,
    update_journal_entry, get_journal_streak
)
from ..database.schemas import JournalCreate, JournalUpdate, JournalResponse

router = APIRouter()


@router.get("")
async def list_journal_entries(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(30, ge=1, le=365),
    offset: int = Query(0, ge=0)
):
    """List journal entries with optional filtering."""
    with get_db() as db:
        entries = get_journal_entries(db, from_date=from_date, to_date=to_date,
                                      limit=limit, offset=offset)
        result = [JournalResponse.model_validate(e).model_dump(mode='json') for e in entries]
        return JSONResponse(content=result)


@router.get("/streak")
async def get_current_streak():
    """Get the current journaling streak."""
    with get_db() as db:
        streak = get_journal_streak(db)
        return {"streak": streak}


@router.get("/{entry_date}")
async def get_journal_by_date(entry_date: date):
    """Get a journal entry for a specific date."""
    with get_db() as db:
        entry = get_journal_entry(db, entry_date)
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        result = JournalResponse.model_validate(entry).model_dump(mode='json')
        return JSONResponse(content=result)


@router.post("", status_code=201)
async def create_or_update_journal(journal_data: JournalCreate):
    """Create a new journal entry or update existing one for the date."""
    with get_db() as db:
        existing = get_journal_entry(db, journal_data.entry_date)

        if existing:
            entry = update_journal_entry(
                db,
                entry_date=journal_data.entry_date,
                content=journal_data.content,
                mood=journal_data.mood
            )
        else:
            entry = create_journal_entry(
                db,
                content=journal_data.content,
                entry_date=journal_data.entry_date,
                mood=journal_data.mood
            )

        result = JournalResponse.model_validate(entry).model_dump(mode='json')
        return JSONResponse(content=result, status_code=201)


@router.patch("/{entry_date}")
async def update_journal_by_date(entry_date: date, journal_data: JournalUpdate):
    """Update an existing journal entry."""
    with get_db() as db:
        update_data = {k: v for k, v in journal_data.model_dump().items() if v is not None}
        entry = update_journal_entry(db, entry_date, **update_data)
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        result = JournalResponse.model_validate(entry).model_dump(mode='json')
        return JSONResponse(content=result)
