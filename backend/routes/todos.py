"""Todo API routes."""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ..database.crud import (
    get_db, create_todo, get_todos, get_todo, update_todo, delete_todo,
    toggle_todo, get_active_todos
)
from ..database.schemas import TodoCreate, TodoUpdate, TodoResponse

router = APIRouter()


@router.get("")
async def list_todos(
    status: Optional[str] = Query(None, regex="^(incomplete|completed|moved)$"),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """List todos with optional filtering."""
    with get_db() as db:
        todos = get_todos(db, status=status, from_date=from_date,
                         to_date=to_date, limit=limit, offset=offset)
        result = [TodoResponse.model_validate(t).model_dump(mode='json') for t in todos]
        return JSONResponse(content=result)


@router.get("/active")
async def list_active_todos(limit: int = Query(50, ge=1, le=200)):
    """Get active (incomplete) todos for the dashboard."""
    with get_db() as db:
        todos = get_active_todos(db, limit=limit)
        result = [TodoResponse.model_validate(t).model_dump(mode='json') for t in todos]
        return JSONResponse(content=result)


@router.get("/{todo_id}")
async def get_single_todo(todo_id: int):
    """Get a single todo by ID."""
    with get_db() as db:
        todo = get_todo(db, todo_id)
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        result = TodoResponse.model_validate(todo).model_dump(mode='json')
        return JSONResponse(content=result)


@router.post("", status_code=201)
async def create_new_todo(todo_data: TodoCreate):
    """Create a new todo."""
    with get_db() as db:
        todo = create_todo(
            db,
            text=todo_data.text,
            original_date=todo_data.original_date,
            indent_level=todo_data.indent_level,
            parent_id=todo_data.parent_id,
            priority=todo_data.priority,
            due_date=todo_data.due_date,
            tags=todo_data.tags
        )
        result = TodoResponse.model_validate(todo).model_dump(mode='json')
        return JSONResponse(content=result, status_code=201)


@router.patch("/{todo_id}")
async def update_existing_todo(todo_id: int, todo_data: TodoUpdate):
    """Update an existing todo."""
    with get_db() as db:
        update_data = {k: v for k, v in todo_data.model_dump().items() if v is not None}
        todo = update_todo(db, todo_id, **update_data)
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        result = TodoResponse.model_validate(todo).model_dump(mode='json')
        return JSONResponse(content=result)


@router.delete("/{todo_id}", status_code=204)
async def delete_existing_todo(todo_id: int):
    """Delete a todo."""
    with get_db() as db:
        if not delete_todo(db, todo_id):
            raise HTTPException(status_code=404, detail="Todo not found")


@router.post("/{todo_id}/toggle")
async def toggle_todo_status(todo_id: int):
    """Toggle todo completion status."""
    with get_db() as db:
        todo = toggle_todo(db, todo_id)
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        result = TodoResponse.model_validate(todo).model_dump(mode='json')
        return JSONResponse(content=result)
