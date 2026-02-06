"""API clients for external services."""
from .wakatime import WakaTimeClient
from .activitywatch import ActivityWatchClient
from .lastfm import LastFMClient
from .quotes import QuotesClient
from .github import GitHubClient

__all__ = ["WakaTimeClient", "ActivityWatchClient", "LastFMClient", "QuotesClient", "GitHubClient"]
