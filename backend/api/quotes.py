"""Quotes API client for inspirational quotes."""
import httpx
import random
from typing import Optional, Dict, List

from ..config import get_settings

settings = get_settings()


class QuotesClient:
    """Client for fetching quotes from various APIs."""

    # Quote API endpoints
    KANYE_API = "https://api.kanye.rest"
    ZENQUOTES_API = "https://zenquotes.io/api/random"
    QUOTABLE_API = "https://api.quotable.io/random"

    def __init__(self):
        """Initialize Quotes client."""
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

    async def get_kanye_quote(self) -> Optional[Dict]:
        """Get a random Kanye West quote."""
        try:
            response = await self.client.get(self.KANYE_API)
            response.raise_for_status()
            data = response.json()
            return {
                "quote": data.get("quote", ""),
                "author": "Kanye West",
                "source": "kanye.rest"
            }
        except httpx.HTTPError as e:
            print(f"Kanye API error: {e}")
            return None

    async def get_zen_quote(self) -> Optional[Dict]:
        """Get a random quote from ZenQuotes."""
        try:
            response = await self.client.get(self.ZENQUOTES_API)
            response.raise_for_status()
            data = response.json()
            if data and len(data) > 0:
                return {
                    "quote": data[0].get("q", ""),
                    "author": data[0].get("a", "Unknown"),
                    "source": "zenquotes.io"
                }
            return None
        except httpx.HTTPError as e:
            print(f"ZenQuotes API error: {e}")
            return None

    async def get_quotable_quote(self) -> Optional[Dict]:
        """Get a random quote from Quotable."""
        try:
            response = await self.client.get(self.QUOTABLE_API)
            response.raise_for_status()
            data = response.json()
            return {
                "quote": data.get("content", ""),
                "author": data.get("author", "Unknown"),
                "tags": data.get("tags", []),
                "source": "quotable.io"
            }
        except httpx.HTTPError as e:
            print(f"Quotable API error: {e}")
            return None

    async def get_random_quote(self) -> Optional[Dict]:
        """Get a random quote from any available source."""
        # Try sources in random order
        sources = [
            self.get_kanye_quote,
            self.get_zen_quote,
            self.get_quotable_quote
        ]
        random.shuffle(sources)

        for source in sources:
            quote = await source()
            if quote:
                return quote

        # Fallback to local quotes
        return self._get_fallback_quote()

    async def get_quotes(self, count: int = 3) -> List[Dict]:
        """
        Get multiple quotes from different sources.

        Args:
            count: Number of quotes to fetch (max 3, one per source)
        """
        quotes = []

        # Try each source
        kanye = await self.get_kanye_quote()
        if kanye:
            quotes.append(kanye)

        if len(quotes) < count:
            zen = await self.get_zen_quote()
            if zen:
                quotes.append(zen)

        if len(quotes) < count:
            quotable = await self.get_quotable_quote()
            if quotable:
                quotes.append(quotable)

        # Fill remaining with fallback
        while len(quotes) < count:
            quotes.append(self._get_fallback_quote())

        return quotes[:count]

    def _get_fallback_quote(self) -> Dict:
        """Get a fallback quote when APIs are unavailable."""
        fallback_quotes = [
            {
                "quote": "The only way to do great work is to love what you do.",
                "author": "Steve Jobs",
                "source": "local"
            },
            {
                "quote": "Innovation distinguishes between a leader and a follower.",
                "author": "Steve Jobs",
                "source": "local"
            },
            {
                "quote": "Stay hungry, stay foolish.",
                "author": "Steve Jobs",
                "source": "local"
            },
            {
                "quote": "The best time to plant a tree was 20 years ago. The second best time is now.",
                "author": "Chinese Proverb",
                "source": "local"
            },
            {
                "quote": "Done is better than perfect.",
                "author": "Sheryl Sandberg",
                "source": "local"
            },
            {
                "quote": "The journey of a thousand miles begins with one step.",
                "author": "Lao Tzu",
                "source": "local"
            },
            {
                "quote": "What you do today can improve all your tomorrows.",
                "author": "Ralph Marston",
                "source": "local"
            },
            {
                "quote": "Believe you can and you're halfway there.",
                "author": "Theodore Roosevelt",
                "source": "local"
            },
            {
                "quote": "The secret of getting ahead is getting started.",
                "author": "Mark Twain",
                "source": "local"
            },
            {
                "quote": "It always seems impossible until it's done.",
                "author": "Nelson Mandela",
                "source": "local"
            }
        ]
        return random.choice(fallback_quotes)
