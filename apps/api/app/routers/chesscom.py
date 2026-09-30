from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.chesscom_jobs import get_job, list_jobs, start_sync_job
from app.services.chesscom_sync import load_report

router = APIRouter(prefix="/chesscom", tags=["chesscom"])


class ChesscomSyncRequest(BaseModel):
    usernames: list[str] = Field(min_length=1, max_length=5)
    depth: int = Field(default=12, ge=8, le=18)
    max_games: int = Field(default=60, ge=5, le=200)
    max_ply: int = Field(default=40, ge=10, le=80)
    download: bool = True


class ChesscomJobResponse(BaseModel):
    id: str
    status: str
    stage: str
    progress: float
    message: str
    usernames: list[str]
    error: str | None = None
    started_at: str | None = None
    finished_at: str | None = None


@router.post("/sync", response_model=ChesscomJobResponse)
def sync_chesscom(data: ChesscomSyncRequest):
    nicks = [name.strip().lstrip("@") for name in data.usernames if name.strip()]
    if not nicks:
        raise HTTPException(status_code=400, detail="Укажите ники chess.com")
    try:
        job = start_sync_job(
            nicks,
            depth=data.depth,
            max_games=data.max_games,
            max_ply=data.max_ply,
            download=data.download,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return job


@router.get("/jobs/{job_id}", response_model=ChesscomJobResponse)
def chesscom_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return job


@router.get("/jobs", response_model=list[ChesscomJobResponse])
def chesscom_jobs():
    return list_jobs()


@router.get("/report")
def chesscom_report():
    report = load_report()
    if report is None:
        return {
            "generatedAt": None,
            "engineDepth": 0,
            "maxGamesPerPlayer": 0,
            "players": [],
            "hint": "Введите ники и нажмите «Скачать и разобрать»",
        }
    return report
