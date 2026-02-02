"""Dashboard routes for main page and API aggregation."""
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from ..config import get_settings
from ..database.crud import (
    get_db, get_active_todos, get_notes, get_journal_streak,
    get_layout, save_layout
)
from ..api import WakaTimeClient, ActivityWatchClient, LastFMClient, QuotesClient
from ..services.cache import get_cached_or_fetch

settings = get_settings()
templates = Jinja2Templates(directory=str(settings.templates_dir))

router = APIRouter()


# =============================================================================
# Main Dashboard Route
# =============================================================================

@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Render the main dashboard page."""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "title": "Life Dashboard"
    })


# =============================================================================
# Stats Summary Endpoint
# =============================================================================

@router.get("/api/stats/summary")
async def get_stats_summary():
    """Get aggregated statistics for the dashboard header."""
    # Get WakaTime stats
    wakatime_client = WakaTimeClient()
    wakatime_stats = await get_cached_or_fetch(
        "wakatime", "stats_7days",
        lambda: wakatime_client.get_stats("last_7_days"),
        ttl_seconds=settings.cache_ttl_seconds
    )
    await wakatime_client.close()

    # Get database stats
    with get_db() as db:
        active_todos = len(get_active_todos(db, limit=500))
        recent_notes = len(get_notes(db, limit=100))
        journal_streak = get_journal_streak(db)

    return {
        "coding": {
            "total_time": wakatime_stats.get("total_time", "0 hrs") if wakatime_stats else "0 hrs",
            "daily_average": wakatime_stats.get("daily_average", "0 hrs") if wakatime_stats else "0 hrs",
            "projects_count": len(wakatime_stats.get("projects", [])) if wakatime_stats else 0,
            "languages_count": len(wakatime_stats.get("languages", [])) if wakatime_stats else 0
        },
        "productivity": {
            "active_todos": active_todos,
            "notes_count": recent_notes,
            "journal_streak": journal_streak
        }
    }


# =============================================================================
# WakaTime Endpoints
# =============================================================================

@router.get("/api/wakatime/stats")
async def get_wakatime_stats(range: str = Query("last_7_days")):
    """Get WakaTime coding statistics."""
    client = WakaTimeClient()
    try:
        stats = await get_cached_or_fetch(
            "wakatime", f"stats_{range}",
            lambda: client.get_stats(range),
            ttl_seconds=settings.cache_ttl_seconds
        )
        return stats or {"error": "Unable to fetch WakaTime stats"}
    finally:
        await client.close()


@router.get("/api/wakatime/summaries")
async def get_wakatime_summaries(days: int = Query(7, ge=1, le=30)):
    """Get WakaTime daily summaries."""
    client = WakaTimeClient()
    try:
        end = datetime.now()
        start = end - timedelta(days=days)

        summaries = await get_cached_or_fetch(
            "wakatime", f"summaries_{days}d",
            lambda: client.get_summaries(start, end),
            ttl_seconds=settings.cache_ttl_seconds
        )
        return summaries or []
    finally:
        await client.close()


# =============================================================================
# ActivityWatch Endpoints
# =============================================================================

@router.get("/api/activitywatch/summary")
async def get_activitywatch_summary(hours: int = Query(24, ge=1, le=168)):
    """Get ActivityWatch activity summary."""
    client = ActivityWatchClient()
    try:
        end = datetime.now()
        start = end - timedelta(hours=hours)

        summary = await get_cached_or_fetch(
            "activitywatch", f"summary_{hours}h",
            lambda: client.get_productivity_summary(start, end),
            ttl_seconds=settings.cache_ttl_seconds
        )
        return summary or {"error": "Unable to fetch ActivityWatch data"}
    finally:
        await client.close()


@router.get("/api/activitywatch/apps")
async def get_activitywatch_apps(hours: int = Query(24, ge=1, le=168)):
    """Get ActivityWatch application usage."""
    client = ActivityWatchClient()
    try:
        end = datetime.now()
        start = end - timedelta(hours=hours)

        activity = await get_cached_or_fetch(
            "activitywatch", f"apps_{hours}h",
            lambda: client.get_window_activity(start, end),
            ttl_seconds=settings.cache_ttl_seconds
        )
        return activity or {"apps": []}
    finally:
        await client.close()


# =============================================================================
# Last.fm Endpoints
# =============================================================================

@router.get("/api/lastfm/nowplaying")
async def get_lastfm_nowplaying():
    """Get currently playing track from Last.fm."""
    client = LastFMClient()
    try:
        # Short cache for now playing
        track = await get_cached_or_fetch(
            "lastfm", "nowplaying",
            client.get_now_playing,
            ttl_seconds=settings.nowplaying_cache_ttl
        )
        return track or {"error": "Unable to fetch now playing"}
    finally:
        await client.close()


@router.get("/api/lastfm/recent")
async def get_lastfm_recent(limit: int = Query(10, ge=1, le=50)):
    """Get recent tracks from Last.fm."""
    client = LastFMClient()
    try:
        tracks = await get_cached_or_fetch(
            "lastfm", f"recent_{limit}",
            lambda: client.get_recent_tracks(limit),
            ttl_seconds=settings.cache_ttl_seconds
        )
        return tracks or []
    finally:
        await client.close()


@router.get("/api/lastfm/top")
async def get_lastfm_top(
    type: str = Query("artists", regex="^(artists|albums|tracks)$"),
    period: str = Query("7day", regex="^(overall|7day|1month|3month|6month|12month)$"),
    limit: int = Query(10, ge=1, le=50)
):
    """Get top artists, albums, or tracks from Last.fm."""
    client = LastFMClient()
    try:
        if type == "artists":
            fetch_func = lambda: client.get_top_artists(period, limit)
        elif type == "albums":
            fetch_func = lambda: client.get_top_albums(period, limit)
        else:
            fetch_func = lambda: client.get_top_tracks(period, limit)

        data = await get_cached_or_fetch(
            "lastfm", f"top_{type}_{period}_{limit}",
            fetch_func,
            ttl_seconds=settings.cache_ttl_seconds
        )
        return data or []
    finally:
        await client.close()


# =============================================================================
# Quotes Endpoint
# =============================================================================

@router.get("/api/quotes")
async def get_quotes(count: int = Query(1, ge=1, le=3)):
    """Get inspirational quotes."""
    client = QuotesClient()
    try:
        quotes = await client.get_quotes(count)
        return quotes
    finally:
        await client.close()


# =============================================================================
# Layout Endpoints
# =============================================================================

@router.get("/api/layout")
async def get_dashboard_layout():
    """Get saved dashboard layout."""
    with get_db() as db:
        layout = get_layout(db)
        return layout or {}


@router.post("/api/layout")
async def save_dashboard_layout(layout_data: dict):
    """Save dashboard layout."""
    with get_db() as db:
        save_layout(db, layout_data)
        return {"status": "saved"}
