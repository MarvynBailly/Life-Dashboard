"""Caching service for API responses."""
from datetime import datetime, timedelta
from typing import Any, Optional, Callable
from functools import wraps

from ..database.crud import get_db, get_cached_response, set_cached_response, clear_expired_cache
from ..config import get_settings

settings = get_settings()


class CacheService:
    """Service for caching API responses in SQLite."""

    def __init__(self):
        """Initialize cache service."""
        pass

    def get(self, api_name: str, endpoint: str) -> Optional[Any]:
        """
        Get cached response.

        Args:
            api_name: Name of the API (e.g., "wakatime", "lastfm")
            endpoint: API endpoint or identifier

        Returns:
            Cached data or None if not found/expired
        """
        with get_db() as db:
            return get_cached_response(db, api_name, endpoint)

    def set(self, api_name: str, endpoint: str, data: Any,
            ttl_seconds: int = None) -> None:
        """
        Cache a response.

        Args:
            api_name: Name of the API
            endpoint: API endpoint or identifier
            data: Data to cache
            ttl_seconds: Time-to-live in seconds (default from settings)
        """
        if ttl_seconds is None:
            ttl_seconds = settings.cache_ttl_seconds

        with get_db() as db:
            set_cached_response(db, api_name, endpoint, data, ttl_seconds)

    def clear_expired(self) -> int:
        """Clear expired cache entries. Returns count of deleted entries."""
        with get_db() as db:
            return clear_expired_cache(db)

    def invalidate(self, api_name: str, endpoint: str = None) -> None:
        """
        Invalidate cached data.

        Args:
            api_name: Name of the API
            endpoint: Specific endpoint to invalidate (None for all API entries)
        """
        from ..database.models import ApiCache
        from ..database.crud import SessionLocal

        db = SessionLocal()
        try:
            query = db.query(ApiCache).filter(ApiCache.api_name == api_name)
            if endpoint:
                query = query.filter(ApiCache.endpoint == endpoint)
            query.delete()
            db.commit()
        finally:
            db.close()


# Global cache instance
cache = CacheService()


def cached(api_name: str, ttl_seconds: int = None):
    """
    Decorator for caching async function results.

    Usage:
        @cached("wakatime", ttl_seconds=900)
        async def get_wakatime_stats(range: str):
            # ... fetch from API
            return data

    Args:
        api_name: Name of the API for cache key
        ttl_seconds: Cache TTL in seconds
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"

            # Try to get from cache
            cached_data = cache.get(api_name, cache_key)
            if cached_data is not None:
                return cached_data

            # Call the actual function
            result = await func(*args, **kwargs)

            # Cache the result if not None
            if result is not None:
                cache.set(api_name, cache_key, result, ttl_seconds)

            return result
        return wrapper
    return decorator


async def get_cached_or_fetch(api_name: str, endpoint: str,
                               fetch_func: Callable,
                               ttl_seconds: int = None) -> Optional[Any]:
    """
    Get data from cache or fetch using provided function.

    Args:
        api_name: Name of the API
        endpoint: Cache key/endpoint
        fetch_func: Async function to call if cache miss
        ttl_seconds: Cache TTL in seconds

    Returns:
        Cached or freshly fetched data
    """
    # Try cache first
    cached_data = cache.get(api_name, endpoint)
    if cached_data is not None:
        return cached_data

    # Fetch fresh data
    data = await fetch_func()

    # Cache if successful
    if data is not None:
        cache.set(api_name, endpoint, data, ttl_seconds)

    return data
