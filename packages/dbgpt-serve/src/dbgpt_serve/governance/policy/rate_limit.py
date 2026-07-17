"""Request-path rate limiting without scanning audit tables."""

import time
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Hashable


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


class LocalTokenBucketRateLimiter:
    """Small in-process token bucket used until Redis/Valkey is wired."""

    def __init__(self):
        self._buckets: Dict[Hashable, _Bucket] = {}
        self._lock = Lock()

    def allow(self, key: Hashable, limit_per_minute: int) -> bool:
        if limit_per_minute <= 0:
            return False
        now = time.monotonic()
        refill_per_second = limit_per_minute / 60.0
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                self._buckets[key] = _Bucket(
                    tokens=float(limit_per_minute - 1), updated_at=now
                )
                return True

            elapsed = max(now - bucket.updated_at, 0.0)
            bucket.tokens = min(
                float(limit_per_minute),
                bucket.tokens + elapsed * refill_per_second,
            )
            bucket.updated_at = now
            if bucket.tokens < 1.0:
                return False
            bucket.tokens -= 1.0
            return True
