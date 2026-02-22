from threading import Lock
from time import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


class InMemoryFixedWindowLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._hits: dict[tuple[str, str, int], int] = {}

    def allow(self, client_id: str, group: str, limit: int, window_seconds: int) -> bool:
        now = int(time())
        slot = now // window_seconds
        key = (client_id, group, slot)

        with self._lock:
            count = self._hits.get(key, 0) + 1
            self._hits[key] = count

            # Opportunistic cleanup of old windows.
            old_slots = [k for k in self._hits if k[2] < slot - 2]
            for old_key in old_slots:
                self._hits.pop(old_key, None)

        return count <= limit


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        auth_paths: tuple[str, ...],
        auth_limit: int,
        window_seconds: int,
    ) -> None:
        super().__init__(app)
        self.auth_paths = auth_paths
        self.auth_limit = auth_limit
        self.window_seconds = window_seconds
        self.limiter = InMemoryFixedWindowLimiter()

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if request.method != "OPTIONS" and any(path.startswith(prefix) for prefix in self.auth_paths):
            client_host = request.client.host if request.client else "unknown"
            allowed = self.limiter.allow(
                client_id=client_host,
                group="auth_upload",
                limit=self.auth_limit,
                window_seconds=self.window_seconds,
            )
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please retry later."},
                )

        return await call_next(request)
