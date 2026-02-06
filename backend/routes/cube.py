"""Cube algorithms page and API routes."""
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from ..config import get_settings
from ..database.crud import (
    get_db,
    create_cube_category, get_cube_categories, get_cube_category,
    update_cube_category, delete_cube_category,
    create_cube_algorithm, get_cube_algorithms, get_cube_algorithm,
    update_cube_algorithm, delete_cube_algorithm
)
from ..database.schemas import (
    CubeCategoryCreate, CubeCategoryUpdate, CubeCategoryResponse,
    CubeAlgorithmCreate, CubeAlgorithmUpdate, CubeAlgorithmResponse
)

settings = get_settings()
templates = Jinja2Templates(directory=str(settings.templates_dir))

router = APIRouter()


# =============================================================================
# Page Route
# =============================================================================

@router.get("/cube", response_class=HTMLResponse)
async def cube_page(request: Request):
    """Render the cube algorithms page."""
    return templates.TemplateResponse("cube.html", {
        "request": request,
        "title": "Cube Algorithms"
    })


# =============================================================================
# Category API Routes
# =============================================================================

@router.get("/api/cube/categories")
async def list_categories():
    """List all categories with their algorithms."""
    with get_db() as db:
        categories = get_cube_categories(db)
        result = [CubeCategoryResponse.model_validate(c).model_dump(mode='json') for c in categories]
        return JSONResponse(content=result)


@router.post("/api/cube/categories", status_code=201)
async def create_category(data: CubeCategoryCreate):
    """Create a new category."""
    with get_db() as db:
        category = create_cube_category(db, name=data.name, display_order=data.display_order)
        result = CubeCategoryResponse.model_validate(category).model_dump(mode='json')
        return JSONResponse(content=result, status_code=201)


@router.patch("/api/cube/categories/{category_id}")
async def update_category(category_id: int, data: CubeCategoryUpdate):
    """Update a category."""
    with get_db() as db:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        category = update_cube_category(db, category_id, **update_data)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        result = CubeCategoryResponse.model_validate(category).model_dump(mode='json')
        return JSONResponse(content=result)


@router.delete("/api/cube/categories/{category_id}", status_code=204)
async def remove_category(category_id: int):
    """Delete a category and its algorithms."""
    with get_db() as db:
        if not delete_cube_category(db, category_id):
            raise HTTPException(status_code=404, detail="Category not found")


# =============================================================================
# Algorithm API Routes
# =============================================================================

@router.post("/api/cube/algorithms", status_code=201)
async def create_alg(data: CubeAlgorithmCreate):
    """Create a new algorithm."""
    with get_db() as db:
        # Verify category exists
        if not get_cube_category(db, data.category_id):
            raise HTTPException(status_code=404, detail="Category not found")
        algorithm = create_cube_algorithm(
            db,
            category_id=data.category_id,
            name=data.name,
            notation=data.notation,
            notes=data.notes,
            image_url=data.image_url,
            display_order=data.display_order
        )
        result = CubeAlgorithmResponse.model_validate(algorithm).model_dump(mode='json')
        return JSONResponse(content=result, status_code=201)


@router.patch("/api/cube/algorithms/{algorithm_id}")
async def update_alg(algorithm_id: int, data: CubeAlgorithmUpdate):
    """Update an algorithm."""
    with get_db() as db:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        algorithm = update_cube_algorithm(db, algorithm_id, **update_data)
        if not algorithm:
            raise HTTPException(status_code=404, detail="Algorithm not found")
        result = CubeAlgorithmResponse.model_validate(algorithm).model_dump(mode='json')
        return JSONResponse(content=result)


@router.delete("/api/cube/algorithms/{algorithm_id}", status_code=204)
async def remove_alg(algorithm_id: int):
    """Delete an algorithm."""
    with get_db() as db:
        if not delete_cube_algorithm(db, algorithm_id):
            raise HTTPException(status_code=404, detail="Algorithm not found")
