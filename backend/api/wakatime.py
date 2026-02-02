"""WakaTime API client for coding statistics."""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from base64 import b64encode

from ..config import get_settings

settings = get_settings()


class WakaTimeClient:
    """Client for WakaTime API integration."""

    BASE_URL = "https://wakatime.com/api/v1"

    def __init__(self, api_key: str = None):
        """Initialize WakaTime client with API key."""
        self.api_key = api_key or settings.wakatime_api_key
        self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            # WakaTime uses Basic Auth with API key as username
            auth_string = b64encode(f"{self.api_key}:".encode()).decode()
            self._client = httpx.AsyncClient(
                headers={"Authorization": f"Basic {auth_string}"},
                timeout=10.0
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Make an API request."""
        if not self.api_key:
            return None

        try:
            response = await self.client.get(
                f"{self.BASE_URL}/{endpoint}",
                params=params
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"WakaTime API error: {e}")
            return None

    async def get_stats(self, range: str = "last_7_days") -> Optional[Dict]:
        """
        Get coding statistics for a time range.

        Args:
            range: Time range (last_7_days, last_30_days, last_6_months, last_year, all_time)

        Returns:
            Statistics data or None if request fails
        """
        data = await self._request(f"users/current/stats/{range}")
        if data and "data" in data:
            return self._format_stats(data["data"])
        return None

    async def get_summaries(self, start: datetime = None, end: datetime = None) -> Optional[List[Dict]]:
        """
        Get daily summaries for a date range.

        Args:
            start: Start date (default: 7 days ago)
            end: End date (default: today)

        Returns:
            List of daily summaries or None
        """
        if not start:
            start = datetime.now() - timedelta(days=7)
        if not end:
            end = datetime.now()

        params = {
            "start": start.strftime("%Y-%m-%d"),
            "end": end.strftime("%Y-%m-%d")
        }

        data = await self._request("users/current/summaries", params)
        if data and "data" in data:
            return self._format_summaries(data["data"])
        return None

    async def get_durations(self, date: datetime = None) -> Optional[List[Dict]]:
        """
        Get coding durations for a specific date.

        Args:
            date: Date to get durations for (default: today)

        Returns:
            List of durations or None
        """
        if not date:
            date = datetime.now()

        params = {"date": date.strftime("%Y-%m-%d")}
        data = await self._request("users/current/durations", params)

        if data and "data" in data:
            return data["data"]
        return None

    async def get_projects(self, range: str = "last_7_days") -> Optional[List[Dict]]:
        """Get project breakdown for a time range."""
        stats = await self.get_stats(range)
        if stats:
            return stats.get("projects", [])
        return None

    async def get_languages(self, range: str = "last_7_days") -> Optional[List[Dict]]:
        """Get language breakdown for a time range."""
        stats = await self.get_stats(range)
        if stats:
            return stats.get("languages", [])
        return None

    async def get_editors(self, range: str = "last_7_days") -> Optional[List[Dict]]:
        """Get editor breakdown for a time range."""
        stats = await self.get_stats(range)
        if stats:
            return stats.get("editors", [])
        return None

    def _format_stats(self, data: Dict) -> Dict:
        """Format stats data for dashboard display."""
        return {
            "total_seconds": data.get("total_seconds", 0),
            "total_time": data.get("human_readable_total", "0 hrs 0 mins"),
            "daily_average": data.get("human_readable_daily_average", "0 hrs 0 mins"),
            "daily_average_seconds": data.get("daily_average", 0),
            "projects": [
                {
                    "name": p.get("name", "Unknown"),
                    "total_seconds": p.get("total_seconds", 0),
                    "percent": p.get("percent", 0),
                    "text": p.get("text", "0 hrs 0 mins")
                }
                for p in data.get("projects", [])
            ],
            "languages": [
                {
                    "name": l.get("name", "Unknown"),
                    "total_seconds": l.get("total_seconds", 0),
                    "percent": l.get("percent", 0),
                    "text": l.get("text", "0 hrs 0 mins")
                }
                for l in data.get("languages", [])
            ],
            "editors": [
                {
                    "name": e.get("name", "Unknown"),
                    "total_seconds": e.get("total_seconds", 0),
                    "percent": e.get("percent", 0),
                    "text": e.get("text", "0 hrs 0 mins")
                }
                for e in data.get("editors", [])
            ],
            "operating_systems": [
                {
                    "name": os.get("name", "Unknown"),
                    "total_seconds": os.get("total_seconds", 0),
                    "percent": os.get("percent", 0),
                    "text": os.get("text", "0 hrs 0 mins")
                }
                for os in data.get("operating_systems", [])
            ],
            "range": {
                "start": data.get("start"),
                "end": data.get("end"),
                "text": data.get("human_readable_range", "")
            }
        }

    def _format_summaries(self, data: List[Dict]) -> List[Dict]:
        """Format summaries data for dashboard charts."""
        return [
            {
                "date": d.get("range", {}).get("date", ""),
                "total_seconds": d.get("grand_total", {}).get("total_seconds", 0),
                "total_text": d.get("grand_total", {}).get("text", "0 hrs 0 mins"),
                "projects": [
                    {"name": p.get("name"), "seconds": p.get("total_seconds", 0)}
                    for p in d.get("projects", [])
                ],
                "languages": [
                    {"name": l.get("name"), "seconds": l.get("total_seconds", 0)}
                    for l in d.get("languages", [])
                ]
            }
            for d in data
        ]
