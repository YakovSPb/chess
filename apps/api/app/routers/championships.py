from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.models import Lesson, LessonProgress, User
from app.schemas import ChampionshipDetailResponse, ChampionshipResponse, LessonProgressUpdate

router = APIRouter(prefix="/championships", tags=["championships"])


def _meta_from_lesson(opening: Lesson) -> dict:
    pros = opening.pros or []
    if pros and isinstance(pros[0], dict):
        return pros[0]
    return {}


def _to_list_item(lesson: Lesson, completed: bool) -> ChampionshipResponse:
    meta = _meta_from_lesson(lesson)
    return ChampionshipResponse(
        id=lesson.id,
        title=lesson.title,
        event=str(meta.get("event") or ""),
        year=int(meta.get("year") or lesson.eco or 0),
        white=str(meta.get("white") or ""),
        black=str(meta.get("black") or ""),
        result=str(meta.get("result") or "*"),
        winner=str(meta.get("winner") or "draw"),
        winner_name=meta.get("winner_name"),
        loser_name=meta.get("loser_name"),
        description=lesson.description,
        popularity=lesson.popularity,
        player_color=lesson.player_color or "white",
        steps_count=len(lesson.steps or []),
        completed=completed,
    )


@router.get("", response_model=list[ChampionshipResponse])
def list_championships(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    games = (
        db.query(Lesson)
        .filter(Lesson.category == "championship")
        .order_by(Lesson.popularity.desc())
        .all()
    )
    completed_ids: set[int] = set()
    if user:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user.id, LessonProgress.completed.is_(True))
            .all()
        )
        completed_ids = {p.lesson_id for p in progress}

    return [_to_list_item(g, g.id in completed_ids) for g in games]


@router.get("/{game_id}", response_model=ChampionshipDetailResponse)
def get_championship(
    game_id: int,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    lesson = db.get(Lesson, game_id)
    if not lesson or lesson.category != "championship":
        raise HTTPException(status_code=404, detail="Championship game not found")

    completed = False
    if user:
        progress = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == game_id)
            .first()
        )
        completed = bool(progress and progress.completed)

    base = _to_list_item(lesson, completed)
    return ChampionshipDetailResponse(**base.model_dump(), steps=lesson.steps or [])


@router.post("/{game_id}/progress")
def update_progress(
    game_id: int,
    data: LessonProgressUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.get(Lesson, game_id)
    if not lesson or lesson.category != "championship":
        raise HTTPException(status_code=404, detail="Championship game not found")

    progress = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == game_id)
        .first()
    )
    if not progress:
        progress = LessonProgress(user_id=user.id, lesson_id=game_id)
        db.add(progress)
    progress.current_step = data.current_step
    progress.completed = data.completed
    db.commit()
    return {"ok": True}
