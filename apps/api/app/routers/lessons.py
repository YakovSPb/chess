from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.models import Lesson, LessonProgress, User
from app.schemas import LessonDetailResponse, LessonProgressUpdate, LessonResponse
from app.services.deepseek import DeepSeekService

router = APIRouter(prefix="/lessons", tags=["lessons"])


class LessonExplainRequest(BaseModel):
    fen: str
    expected_move: str
    explanation: str


@router.get("", response_model=list[LessonResponse])
def list_lessons(db: Session = Depends(get_db)):
    lessons = (
        db.query(Lesson)
        .filter(Lesson.category != "opening")
        .order_by(Lesson.category, Lesson.difficulty)
        .all()
    )
    return [
        LessonResponse(
            id=l.id,
            title=l.title,
            category=l.category,
            description=l.description,
            difficulty=l.difficulty,
            steps_count=len(l.steps or []),
        )
        for l in lessons
    ]


@router.get("/{lesson_id}", response_model=LessonDetailResponse)
def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonDetailResponse(
        id=lesson.id,
        title=lesson.title,
        category=lesson.category,
        description=lesson.description,
        difficulty=lesson.difficulty,
        steps_count=len(lesson.steps or []),
        steps=lesson.steps or [],
    )


@router.post("/{lesson_id}/progress")
def update_progress(
    lesson_id: int,
    data: LessonProgressUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    progress = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    if not progress:
        progress = LessonProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(progress)
    progress.current_step = data.current_step
    progress.completed = data.completed
    db.commit()
    return {"ok": True}


@router.get("/{lesson_id}/progress")
def get_progress(
    lesson_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    progress = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    if not progress:
        return {"current_step": 0, "completed": False}
    return {"current_step": progress.current_step, "completed": progress.completed}


@router.post("/{lesson_id}/explain", response_model=dict)
async def explain_step(
    lesson_id: int,
    data: LessonExplainRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DeepSeekService(db)
    message = await service.explain_lesson_step(
        fen=data.fen,
        expected_move=data.expected_move,
        explanation=data.explanation,
        user_rating=int(user.puzzle_rating),
    )
    return {"message": message}
