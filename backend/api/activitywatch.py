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

    async def get_timeline_events(self, start: datetime = None,
                                    end: datetime = None) -> Optional[List]:
        """
        Get raw window events for timeline visualization.

        Returns events with app name, start timestamp (unix), and duration,
        grouped by app and suitable for the Today's Breakdown timeline.
        """
        if not start:
            start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if not end:
            end = datetime.now()

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

        events = await self.get_events(window_bucket, start, end)
        if not events:
            return None

        # Convert events to timeline format: {app, time (unix), duration (seconds)}
        timeline = []
        for event in events:
            app = event.get("data", {}).get("app", "Unknown")
            duration = event.get("duration", 0)
            timestamp = event.get("timestamp")

            if not timestamp or duration < 1:
                continue

            # Parse ISO timestamp to unix
            try:
                if isinstance(timestamp, str):
                    timestamp = timestamp.replace("Z", "+00:00")
                    from datetime import timezone
                    event_dt = datetime.fromisoformat(timestamp)
                    unix_ts = event_dt.timestamp()
                else:
                    unix_ts = timestamp
            except (ValueError, TypeError):
                continue

            timeline.append({
                "app": app,
                "time": unix_ts,
                "duration": duration
            })

        return timeline

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
        """Calculate AFK statistics from events, merging overlaps and clipping to time range."""
        start_ts = start.timestamp() if start else None
        end_ts = end.timestamp() if end else None

        # Parse events into (start_epoch, end_epoch, status) and clip to range
        afk_intervals = []
        active_intervals = []

        for event in events:
            duration = event.get("duration", 0)
            if duration < 1:
                continue
            status = event.get("data", {}).get("status", "")
            event_time = event.get("timestamp")
            if not event_time:
                continue

            try:
                if isinstance(event_time, str):
                    event_time = event_time.replace("Z", "+00:00")
                    event_dt = datetime.fromisoformat(event_time)
                    event_ts = event_dt.timestamp()
                else:
                    event_ts = event_time
            except (ValueError, TypeError):
                continue

            ev_start = event_ts
            ev_end = event_ts + duration

            # Clip to query range
            if start_ts is not None:
                ev_start = max(ev_start, start_ts)
            if end_ts is not None:
                ev_end = min(ev_end, end_ts)

            if ev_end <= ev_start:
                continue

            if status == "afk":
                afk_intervals.append((ev_start, ev_end))
            else:
                active_intervals.append((ev_start, ev_end))

        merged_active = self._merge_intervals(active_intervals)
        merged_afk = self._merge_intervals(afk_intervals)

        # Treat gaps (computer off/asleep) as AFK
        all_covered = self._merge_intervals(
            [(s, e) for s, e in merged_active] + [(s, e) for s, e in merged_afk]
        )
        now_ts = datetime.now().timestamp()
        range_end = min(end_ts, now_ts) if end_ts else now_ts
        range_start = all_covered[0][0] if all_covered else (start_ts or now_ts)
        gap_intervals = self._find_gaps(all_covered, range_start, range_end)
        merged_afk = self._merge_intervals(merged_afk + gap_intervals)

        afk_seconds = sum(e - s for s, e in merged_afk)
        active_seconds = sum(e - s for s, e in merged_active)

        return {
            "afk_seconds": afk_seconds,
            "active_seconds": active_seconds,
            "afk_text": self._format_duration(afk_seconds),
            "active_text": self._format_duration(active_seconds)
        }

    async def get_afk_timeline(self, start: datetime = None,
                                end: datetime = None) -> Optional[List]:
        """
        Get merged AFK/active intervals for timeline visualization.

        Returns list of {status, time (unix), duration (seconds)} with
        overlapping events already merged.
        """
        if not start:
            start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
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
        if not events:
            return None

        start_ts = start.timestamp()
        end_ts = end.timestamp()

        afk_intervals = []
        active_intervals = []

        for event in events:
            duration = event.get("duration", 0)
            if duration < 1:
                continue
            status = event.get("data", {}).get("status", "")
            event_time = event.get("timestamp")
            if not event_time:
                continue

            try:
                if isinstance(event_time, str):
                    event_time = event_time.replace("Z", "+00:00")
                    event_dt = datetime.fromisoformat(event_time)
                    event_ts = event_dt.timestamp()
                else:
                    event_ts = event_time
            except (ValueError, TypeError):
                continue

            ev_start = max(event_ts, start_ts)
            ev_end = min(event_ts + duration, end_ts)
            if ev_end <= ev_start:
                continue

            if status == "afk":
                afk_intervals.append((ev_start, ev_end))
            else:
                active_intervals.append((ev_start, ev_end))

        merged_active = self._merge_intervals(active_intervals)
        merged_afk = self._merge_intervals(afk_intervals)

        # Treat gaps (computer off/asleep) as AFK by finding time not
        # covered by any event between the first event and now
        all_covered = self._merge_intervals(
            [(s, e) for s, e in merged_active] + [(s, e) for s, e in merged_afk]
        )
        # Clamp the range: from earliest event to min(now, end_ts)
        now_ts = datetime.now().timestamp()
        range_end = min(end_ts, now_ts)
        range_start = all_covered[0][0] if all_covered else start_ts
        gap_intervals = self._find_gaps(all_covered, range_start, range_end)
        merged_afk = self._merge_intervals(merged_afk + gap_intervals)

        timeline = []
        for iv_start, iv_end in merged_active:
            timeline.append({
                "status": "active",
                "time": iv_start,
                "duration": iv_end - iv_start
            })
        for iv_start, iv_end in merged_afk:
            timeline.append({
                "status": "afk",
                "time": iv_start,
                "duration": iv_end - iv_start
            })

        return timeline

    @staticmethod
    def _find_gaps(intervals: List[tuple], range_start: float, range_end: float) -> List[tuple]:
        """Find gaps between merged intervals within a given range."""
        if not intervals:
            if range_end > range_start:
                return [(range_start, range_end)]
            return []
        gaps = []
        sorted_ivs = sorted(intervals, key=lambda x: x[0])
        # Gap before first interval
        if sorted_ivs[0][0] > range_start:
            gaps.append((range_start, sorted_ivs[0][0]))
        # Gaps between intervals
        for i in range(1, len(sorted_ivs)):
            gap_start = sorted_ivs[i - 1][1]
            gap_end = sorted_ivs[i][0]
            if gap_end > gap_start:
                gaps.append((gap_start, gap_end))
        # Gap after last interval
        if sorted_ivs[-1][1] < range_end:
            gaps.append((sorted_ivs[-1][1], range_end))
        return gaps

    @staticmethod
    def _merge_intervals(intervals: List[tuple]) -> List[tuple]:
        """Merge overlapping intervals and return the merged list."""
        if not intervals:
            return []
        intervals.sort(key=lambda x: x[0])
        merged = []
        cur_start, cur_end = intervals[0]
        for start, end in intervals[1:]:
            if start <= cur_end:
                cur_end = max(cur_end, end)
            else:
                merged.append((cur_start, cur_end))
                cur_start, cur_end = start, end
        merged.append((cur_start, cur_end))
        return merged

    @staticmethod
    def _merge_and_sum(intervals: List[tuple]) -> float:
        """Merge overlapping intervals and return total duration in seconds."""
        if not intervals:
            return 0.0
        intervals.sort(key=lambda x: x[0])
        merged_total = 0.0
        cur_start, cur_end = intervals[0]
        for start, end in intervals[1:]:
            if start <= cur_end:
                cur_end = max(cur_end, end)
            else:
                merged_total += cur_end - cur_start
                cur_start, cur_end = start, end
        merged_total += cur_end - cur_start
        return merged_total

    def _format_duration(self, seconds: float) -> str:
        """Format seconds as human-readable duration."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours} hrs {minutes} mins"
