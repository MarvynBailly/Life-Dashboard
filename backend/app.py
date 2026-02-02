"""FastAPI application for Life Dashboard."""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import markdown

from .config import get_settings
from .database.crud import init_db
from .routes import dashboard_router, todos_router, notes_router, journal_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup: Initialize database
    init_db()
    yield
    # Shutdown: Cleanup if needed


# Create FastAPI application
app = FastAPI(
    title="Life Dashboard",
    description="Personal life tracking dashboard with WakaTime, ActivityWatch, and Last.fm integration",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")

# Configure templates
templates = Jinja2Templates(directory=str(settings.templates_dir))


# Custom template filters
def markdown_filter(text: str) -> str:
    """Convert markdown to HTML."""
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'codehilite'])


templates.env.filters['markdown'] = markdown_filter


# Include routers
app.include_router(dashboard_router, tags=["Dashboard"])
app.include_router(todos_router, prefix="/api/todos", tags=["Todos"])
app.include_router(notes_router, prefix="/api/notes", tags=["Notes"])
app.include_router(journal_router, prefix="/api/journal", tags=["Journal"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
