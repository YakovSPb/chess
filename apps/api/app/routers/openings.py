from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.models import Lesson, LessonProgress, User
from app.schemas import (
    LessonProgressUpdate,
    OpeningDetailResponse,
    OpeningExplorerMove,
    OpeningResponse,
)
from app.services.opening_explorer import get_most_common_move

router = APIRouter(prefix="/openings", tags=["openings"])


@router.get("/explorer", response_model=OpeningExplorerMove)
async def opening_explorer(
    fen: str = Query(..., min_length=10, description="FEN позиции"),
):
    """Самый частый ход в позиции (Lichess / masters book)."""
    move = await get_most_common_move(fen)
    if not move:
        raise HTTPException(status_code=404, detail="No book move")
    return OpeningExplorerMove(**move)


@router.get("", response_model=list[OpeningResponse])
def list_openings(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    openings = db.query(Lesson).filter(Lesson.category == "opening").order_by(Lesson.popularity.desc()).all()
    completed_ids: set[int] = set()
    if user:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user.id, LessonProgress.completed.is_(True))
            .all()
        )
        completed_ids = {p.lesson_id for p in progress}

    return [
        OpeningResponse(
            id=o.id,
            title=o.title,
            eco=o.eco or "",
            description=o.description,
            popularity=o.popularity,
            player_color=o.player_color or "white",
            steps_count=len(o.steps or []),
            completed=o.id in completed_ids,
        )
        for o in openings
    ]


@router.get("/{opening_id}", response_model=OpeningDetailResponse)
def get_opening(
    opening_id: int,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    opening = db.get(Lesson, opening_id)
    if not opening or opening.category != "opening":
        raise HTTPException(status_code=404, detail="Opening not found")

    completed = False
    if user:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == opening_id)
            .first()
        )
        completed = bool(progress and progress.completed)

    return OpeningDetailResponse(
        id=opening.id,
        title=opening.title,
        eco=opening.eco or "",
        description=opening.description,
        popularity=opening.popularity,
        player_color=opening.player_color or "white",
        steps_count=len(opening.steps or []),
        steps=opening.steps or [],
        completed=completed,
        pros=(opening.pros or []) if completed else [],
        cons=(opening.cons or []) if completed else [],
    )


@router.post("/{opening_id}/progress")
def update_progress(
    opening_id: int,
    data: LessonProgressUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opening = db.get(Lesson, opening_id)
    if not opening or opening.category != "opening":
        raise HTTPException(status_code=404, detail="Opening not found")

    progress = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == opening_id)
        .first()
    )
    if not progress:
        progress = LessonProgress(user_id=user.id, lesson_id=opening_id)
        db.add(progress)
    progress.current_step = data.current_step
    progress.completed = data.completed
    db.commit()
    return {"ok": True}
