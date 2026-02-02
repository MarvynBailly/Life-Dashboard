"""Last.fm API client for music tracking."""
import httpx
from typing import Optional, Dict, Any, List

from ..config import get_settings

settings = get_settings()


class LastFMClient:
    """Client for Last.fm API integration."""

    BASE_URL = "https://ws.audioscrobbler.com/2.0/"

    def __init__(self, api_key: str = None, username: str = None):
        """Initialize Last.fm client."""
        self.api_key = api_key or settings.lastfm_api_key
        self.username = username or settings.lastfm_user
        self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=5.0)
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(self, method: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Make an API request."""
        if not self.api_key:
            return None

        request_params = {
            "method": method,
            "api_key": self.api_key,
            "format": "json",
            **(params or {})
        }

        try:
            response = await self.client.get(self.BASE_URL, params=request_params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Last.fm API error: {e}")
            return None

    async def get_now_playing(self) -> Optional[Dict]:
        """
        Get the currently playing or most recently played track.

        Returns:
            Track info or None
        """
        data = await self._request("user.getrecenttracks", {
            "user": self.username,
            "limit": 1
        })

        if not data or "recenttracks" not in data:
            return None

        tracks = data["recenttracks"].get("track", [])

        # Handle single track vs array response
        if isinstance(tracks, dict):
            tracks = [tracks]

        if not tracks:
            return None

        track = tracks[0]
        is_playing = track.get("@attr", {}).get("nowplaying") == "true"

        return {
            "title": track.get("name", "Unknown"),
            "artist": track.get("artist", {}).get("#text", "Unknown"),
            "album": track.get("album", {}).get("#text", ""),
            "album_art": self._get_album_art(track.get("image", [])),
            "url": track.get("url", ""),
            "is_playing": is_playing
        }

    async def get_recent_tracks(self, limit: int = 10) -> Optional[List[Dict]]:
        """
        Get recent tracks.

        Args:
            limit: Number of tracks to return

        Returns:
            List of recent tracks
        """
        data = await self._request("user.getrecenttracks", {
            "user": self.username,
            "limit": limit
        })

        if not data or "recenttracks" not in data:
            return None

        tracks = data["recenttracks"].get("track", [])
        if isinstance(tracks, dict):
            tracks = [tracks]

        return [
            {
                "title": t.get("name", "Unknown"),
                "artist": t.get("artist", {}).get("#text", "Unknown"),
                "album": t.get("album", {}).get("#text", ""),
                "album_art": self._get_album_art(t.get("image", [])),
                "url": t.get("url", ""),
                "played_at": t.get("date", {}).get("#text", ""),
                "is_playing": t.get("@attr", {}).get("nowplaying") == "true"
            }
            for t in tracks
        ]

    async def get_top_artists(self, period: str = "7day", limit: int = 10) -> Optional[List[Dict]]:
        """
        Get top artists for a period.

        Args:
            period: Time period (overall, 7day, 1month, 3month, 6month, 12month)
            limit: Number of artists to return
        """
        data = await self._request("user.gettopartists", {
            "user": self.username,
            "period": period,
            "limit": limit
        })

        if not data or "topartists" not in data:
            return None

        artists = data["topartists"].get("artist", [])
        if isinstance(artists, dict):
            artists = [artists]

        return [
            {
                "name": a.get("name", "Unknown"),
                "playcount": int(a.get("playcount", 0)),
                "url": a.get("url", ""),
                "image": self._get_album_art(a.get("image", []))
            }
            for a in artists
        ]

    async def get_top_albums(self, period: str = "7day", limit: int = 10) -> Optional[List[Dict]]:
        """
        Get top albums for a period.

        Args:
            period: Time period (overall, 7day, 1month, 3month, 6month, 12month)
            limit: Number of albums to return
        """
        data = await self._request("user.gettopalbums", {
            "user": self.username,
            "period": period,
            "limit": limit
        })

        if not data or "topalbums" not in data:
            return None

        albums = data["topalbums"].get("album", [])
        if isinstance(albums, dict):
            albums = [albums]

        return [
            {
                "name": a.get("name", "Unknown"),
                "artist": a.get("artist", {}).get("name", "Unknown"),
                "playcount": int(a.get("playcount", 0)),
                "url": a.get("url", ""),
                "image": self._get_album_art(a.get("image", []))
            }
            for a in albums
        ]

    async def get_top_tracks(self, period: str = "7day", limit: int = 10) -> Optional[List[Dict]]:
        """
        Get top tracks for a period.

        Args:
            period: Time period (overall, 7day, 1month, 3month, 6month, 12month)
            limit: Number of tracks to return
        """
        data = await self._request("user.gettoptracks", {
            "user": self.username,
            "period": period,
            "limit": limit
        })

        if not data or "toptracks" not in data:
            return None

        tracks = data["toptracks"].get("track", [])
        if isinstance(tracks, dict):
            tracks = [tracks]

        return [
            {
                "name": t.get("name", "Unknown"),
                "artist": t.get("artist", {}).get("name", "Unknown"),
                "playcount": int(t.get("playcount", 0)),
                "url": t.get("url", ""),
                "image": self._get_album_art(t.get("image", []))
            }
            for t in tracks
        ]

    async def get_user_info(self) -> Optional[Dict]:
        """Get user profile information."""
        data = await self._request("user.getinfo", {
            "user": self.username
        })

        if not data or "user" not in data:
            return None

        user = data["user"]
        return {
            "name": user.get("name", ""),
            "realname": user.get("realname", ""),
            "playcount": int(user.get("playcount", 0)),
            "registered": user.get("registered", {}).get("#text", ""),
            "url": user.get("url", ""),
            "image": self._get_album_art(user.get("image", []))
        }

    def _get_album_art(self, images: List[Dict]) -> str:
        """Extract the best quality album art URL from image list."""
        if not images:
            return ""

        # Prefer extralarge, then large, then medium
        for size in ["extralarge", "large", "medium", "small"]:
            for img in images:
                if img.get("size") == size and img.get("#text"):
                    return img["#text"]

        # Return first available
        for img in images:
            if img.get("#text"):
                return img["#text"]

        return ""
