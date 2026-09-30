"""Фоновые задачи sync chess.com (один активный sync за раз)."""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from app.services.chesscom_sync import sync_players


@dataclass
class ChesscomJob:
    id: str
    status: str  # queued | running | done | error
    stage: str
    progress: float
    message: str
    usernames: list[str]
    error: str | None = None
    started_at: str | None = None
    finished_at: str | None = None


_lock = threading.Lock()
_jobs: dict[str, ChesscomJob] = {}
_active_id: str | None = None


def get_job(job_id: str) -> ChesscomJob | None:
    with _lock:
        job = _jobs.get(job_id)
        return ChesscomJob(**asdict(job)) if job else None


def list_jobs(limit: int = 10) -> list[ChesscomJob]:
    with _lock:
        items = sorted(_jobs.values(), key=lambda item: item.started_at or "", reverse=True)
        return [ChesscomJob(**asdict(item)) for item in items[:limit]]


def start_sync_job(
    usernames: list[str],
    *,
    depth: int = 12,
    max_games: int = 60,
    max_ply: int = 40,
    download: bool = True,
) -> ChesscomJob:
    global _active_id

    with _lock:
        if _active_id and _jobs.get(_active_id) and _jobs[_active_id].status in {"queued", "running"}:
            raise RuntimeError("Уже идёт загрузка/анализ. Дождитесь окончания.")

        job_id = uuid.uuid4().hex[:12]
        job = ChesscomJob(
            id=job_id,
            status="queued",
            stage="queued",
            progress=0,
            message="В очереди",
            usernames=usernames,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        _jobs[job_id] = job
        _active_id = job_id

    def _update(stage: str, progress: float, message: str) -> None:
        with _lock:
            current = _jobs[job_id]
            current.status = "running"
            current.stage = stage
            current.progress = round(min(max(progress, 0), 100), 1)
            current.message = message

    def _run() -> None:
        global _active_id
        try:
            _update("download", 1, "Старт")
            sync_players(
                usernames,
                depth=depth,
                max_games=max_games,
                max_ply=max_ply,
                download=download,
                on_progress=_update,
            )
            with _lock:
                current = _jobs[job_id]
                current.status = "done"
                current.stage = "done"
                current.progress = 100
                current.message = "Готово"
                current.finished_at = datetime.now(timezone.utc).isoformat()
        except Exception as exc:  # noqa: BLE001 — отдаём текст в UI
            with _lock:
                current = _jobs[job_id]
                current.status = "error"
                current.stage = "error"
                current.message = "Ошибка"
                current.error = str(exc)
                current.finished_at = datetime.now(timezone.utc).isoformat()
        finally:
            with _lock:
                if _active_id == job_id:
                    _active_id = None

    threading.Thread(target=_run, name=f"chesscom-{job_id}", daemon=True).start()
    return get_job(job_id)  # type: ignore[return-value]
