"""ActivityWatch API client for activity tracking."""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from ..config import get_settings

settings = get_settings()


class ActivityWatchClient:
    """Client for ActivityWatch API integration."""

    def __init__(self, host: str = None):
        """Initialize ActivityWatch client."""
        self.host = host or settings.activitywatch_host
        self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(self, endpoint: str, method: str = "GET",
                       params: Dict = None, json: Dict = None) -> Optional[Any]:
        """Make an API request."""
        try:
            url = f"{self.host}/api/0/{endpoint}"
            response = await self.client.request(
                method, url, params=params, json=json
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"ActivityWatch API error: {e}")
            return None

    async def get_buckets(self) -> Optional[Dict]:
        """Get all available buckets."""
        return await self._request("buckets")

    async def get_bucket(self, bucket_id: str) -> Optional[Dict]:
        """Get a specific bucket's info."""
        return await self._request(f"buckets/{bucket_id}")

    async def get_events(self, bucket_id: str, start: datetime = None,
                         end: datetime = None, limit: int = -1) -> Optional[List]:
        """
        Get events from a bucket.

        Args:
            bucket_id: Bucket identifier
            start: Start datetime
            end: End datetime
            limit: Maximum events to return (-1 for all)
        """
        params = {"limit": limit}
        if start:
            params["start"] = start.isoformat()
        if end:
            params["end"] = end.isoformat()

        return await self._request(f"buckets/{bucket_id}/events", params=params)

    async def query(self, timeperiods: List[str], query: List[str]) -> Optional[List]:
        """
        Run an ActivityWatch query.

        Args:
            timeperiods: List of time periods (e.g., ["2024-01-01/2024-01-07"])
            query: Query statements
        """
        data = {
            "timeperiods": timeperiods,
            "query": query
        }
        return await self._request("query", method="POST", json=data)

    async def get_window_activity(self, start: datetime = None,
                                   end: datetime = None) -> Optional[Dict]:
        """
        Get window/application activity summary.

        Args:
            start: Start datetime (default: 24 hours ago)
            end: End datetime (default: now)
        """
        if not start:
            start = datetime.now() - timedelta(days=1)
        if not end:
            end = datetime.now()

        # Find the window watcher bucket
        buckets = await self.get_buckets()
        if not buckets:
            return None

        window_bucket = None
        for bucket_id in buckets:
            if "aw-watcher-window" in bucket_id:
                window_bucket = bucket_id
                break

        if not window_bucket:
            return None

        # Query for app usage
        timeperiod = f"{start.isoformat()}/{end.isoformat()}"
        query = [
            f'events = query_bucket("{window_bucket}");',
            'events = merge_events_by_keys(events, ["app"]);',
            'events = sort_by_duration(events);',
            'RETURN = events;'
        ]

        result = await self.query([timeperiod], query)
        if result and len(result) > 0:
            return self._format_app_activity(result[0])
        return None

    async def get_afk_activity(self, start: datetime = None,
                                end: datetime = None) -> Optional[Dict]:
        """
        Get AFK (Away From Keyboard) activity.

        Args:
            start: Start datetime (default: 24 hours ago)
            end: End datetime (default: now)
        """
        if not start:
            start = datetime.now() - timedelta(days=1)
        if not end:
            end = datetime.now()

        buckets = await self.get_buckets()
        if not buckets:
            return None

        afk_bucket = None
        for bucket_id in buckets:
            if "aw-watcher-afk" in bucket_id:
                afk_bucket = bucket_id
                break

        if not afk_bucket:
            return None

        events = await self.get_events(afk_bucket, start, end)
        if events:
            return self._calculate_afk_stats(events, start, end)
        return None

    async def get_productivity_summary(self, start: datetime = None,
                                        end: datetime = None) -> Optional[Dict]:
        """
        Get productivity summary combining window and AFK data.
        """
        window_activity = await self.get_window_activity(start, end)
        afk_activity = await self.get_afk_activity(start, end)

        if not window_activity:
            return None

        # Use AFK watcher for actual screen time (not the sum of app durations which can overlap)
        active_seconds = afk_activity.get("active_seconds", 0) if afk_activity else 0
        afk_seconds = afk_activity.get("afk_seconds", 0) if afk_activity else 0

        return {
            "apps": window_activity.get("apps", []),
            "total_active_time": active_seconds,
            "total_active_text": self._format_duration(active_seconds),
            "afk_time": afk_seconds,
            "afk_text": self._format_duration(afk_seconds),
            "active_time": active_seconds,
        }

    def _format_app_activity(self, events: List) -> Dict:
        """Format app activity events for display."""
        apps = []
        total_seconds = 0

        for event in events[:20]:  # Top 20 apps
            duration = event.get("duration", 0)
            total_seconds += duration
            apps.append({
                "name": event.get("data", {}).get("app", "Unknown"),
                "title": event.get("data", {}).get("title", ""),
                "seconds": duration,
                "text": self._format_duration(duration)
            })

        return {
            "apps": apps,
            "total_seconds": total_seconds,
            "total_text": self._format_duration(total_seconds)
        }

    def _calculate_afk_stats(self, events: List, start: datetime = None, end: datetime = None) -> Dict:
        """Calculate AFK statistics from events, clipping to time range."""
        afk_seconds = 0
        active_seconds = 0

        # Convert to timestamps for comparison
        start_ts = start.timestamp() if start else None
        end_ts = end.timestamp() if end else None

        for event in events:
            duration = event.get("duration", 0)
            status = event.get("data", {}).get("status", "")

            # Get event timestamp and parse it
            event_time = event.get("timestamp")
            if event_time:
                try:
                    # Parse ISO format timestamp
                    if isinstance(event_time, str):
                        # Handle various ISO formats
                        event_time = event_time.replace("Z", "+00:00")
                        from datetime import timezone
                        event_dt = datetime.fromisoformat(event_time)
                        event_ts = event_dt.timestamp()
                    else:
                        event_ts = event_time

                    event_end_ts = event_ts + duration

                    # Clip event to query time range
                    if start_ts and end_ts:
                        clipped_start = max(event_ts, start_ts)
                        clipped_end = min(event_end_ts, end_ts)
                        duration = max(0, clipped_end - clipped_start)
                except (ValueError, TypeError):
                    pass  # Use original duration if parsing fails

            if status == "afk":
                afk_seconds += duration
            else:
                active_seconds += duration

        return {
            "afk_seconds": afk_seconds,
            "active_seconds": active_seconds,
            "afk_text": self._format_duration(afk_seconds),
            "active_text": self._format_duration(active_seconds)
        }

    def _format_duration(self, seconds: float) -> str:
        """Format seconds as human-readable duration."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours} hrs {minutes} mins"
