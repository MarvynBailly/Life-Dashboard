"""GitHub API client for repository and contribution data."""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from collections import defaultdict

from ..config import get_settings

settings = get_settings()


class GitHubClient:
    """Client for GitHub API integration."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str = None, username: str = None):
        """Initialize GitHub client with personal access token."""
        self.token = token or settings.github_token
        self.username = username or settings.github_username
        self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            self._client = httpx.AsyncClient(
                headers=headers,
                timeout=10.0
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Any]:
        """Make an API request."""
        if not self.token:
            print("GitHub API: No token configured")
            return None

        try:
            response = await self.client.get(
                f"{self.BASE_URL}/{endpoint}",
                params=params
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"GitHub API error ({e.response.status_code}): {e.response.text[:200]}")
            return None
        except httpx.HTTPError as e:
            print(f"GitHub API connection error: {e}")
            return None

    async def get_user_repos(self, per_page: int = 10) -> Optional[List[Dict]]:
        """
        Get the authenticated user's repositories sorted by recently updated.

        Returns:
            List of formatted repo data or None
        """
        data = await self._request("user/repos", params={
            "sort": "updated",
            "direction": "desc",
            "per_page": per_page,
            "type": "owner"
        })
        if data:
            return self._format_repos(data)
        return None

    async def get_contributions(self, days: int = 30) -> Optional[Dict]:
        """
        Get contribution activity by fetching commits from recently
        updated repos. The events API redacts commit data for private
        repos, so we query the commits API per-repo instead.

        Returns:
            Dict with daily commit counts and total, or None
        """
        if not self.username:
            return None

        since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")

        # Get recently updated repos to query commits from
        repos = await self._request("user/repos", params={
            "sort": "pushed",
            "direction": "desc",
            "per_page": 10,
            "type": "owner"
        })
        if not repos:
            return None

        # Fetch commits from each repo in parallel-ish (sequential but fast)
        daily_commits = defaultdict(int)
        for repo in repos:
            full_name = repo.get("full_name", "")
            if not full_name:
                continue

            commits = await self._request(f"repos/{full_name}/commits", params={
                "author": self.username,
                "since": since,
                "per_page": 100
            })
            if not commits:
                continue

            for commit in commits:
                date_str = commit.get("commit", {}).get("author", {}).get("date", "")
                if date_str:
                    try:
                        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                        daily_commits[dt.strftime("%Y-%m-%d")] += 1
                    except (ValueError, AttributeError):
                        continue

        # Build complete date range (fill in zero days)
        result = []
        for i in range(days):
            date = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
            result.append({
                "date": date,
                "commits": daily_commits.get(date, 0)
            })

        total_commits = sum(d["commits"] for d in result)

        return {
            "daily": result,
            "total_commits": total_commits,
            "days": days
        }

    def _format_repos(self, data: List[Dict]) -> List[Dict]:
        """Format repository data for dashboard display."""
        return [
            {
                "name": repo.get("name", "Unknown"),
                "full_name": repo.get("full_name", ""),
                "description": repo.get("description") or "",
                "language": repo.get("language") or "Unknown",
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "open_issues": repo.get("open_issues_count", 0),
                "updated_at": repo.get("updated_at", ""),
                "html_url": repo.get("html_url", ""),
                "private": repo.get("private", False),
            }
            for repo in data
        ]

