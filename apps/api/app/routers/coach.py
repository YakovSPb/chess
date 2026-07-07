from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import CoachChatRequest, CoachExplainRequest, CoachHintRequest, CoachResponse, GameResponse, SummarizeGameRequest
from app.services.deepseek import DeepSeekService
from app.services.puzzles import compute_dashboard_stats

router = APIRouter(tags=["coach"])


@router.post("/coach/hint", response_model=CoachResponse)
async def coach_hint(
    data: CoachHintRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DeepSeekService(db)
    message = await service.get_hint(
        fen=data.fen,
        last_move=data.last_move,
        eval_cp=data.eval_cp,
        best_line=data.best_line,
        hint_level=data.hint_level,
        user_rating=data.user_rating or int(user.puzzle_rating),
    )
    return CoachResponse(message=message)


@router.post("/coach/explain-move", response_model=CoachResponse)
async def coach_explain_move(
    data: CoachExplainRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DeepSeekService(db)
    message = await service.explain_move(
        fen=data.fen,
        move_san=data.move_san,
        eval_before=data.eval_before,
        eval_after=data.eval_after,
        best_move=data.best_move,
        best_line=data.best_line,
        user_rating=data.user_rating or int(user.puzzle_rating),
    )
    return CoachResponse(message=message)


@router.post("/coach/chat", response_model=CoachResponse)
async def coach_chat(
    data: CoachChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DeepSeekService(db)
    message = await service.chat(
        message=data.message,
        page=data.page,
        fen=data.fen,
        details=data.details,
        player_color=data.player_color,
        history=[{"role": m.role, "content": m.content} for m in data.history],
        user_rating=int(user.puzzle_rating),
    )
    return CoachResponse(message=message)


@router.post("/coach/summarize-game", response_model=CoachResponse)
async def coach_summarize_game(
    data: SummarizeGameRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DeepSeekService(db)
    message = await service.summarize_game(
        pgn=data.pgn,
        analysis_summary=data.analysis_summary,
        user_rating=int(user.puzzle_rating),
    )
    return CoachResponse(message=message)


@router.get("/stats/dashboard")
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stats = compute_dashboard_stats(db, user)
    return {
        "puzzle_rating": stats["puzzle_rating"],
        "puzzle_streak": stats["puzzle_streak"],
        "games_played": stats["games_played"],
        "avg_accuracy": stats["avg_accuracy"],
        "weak_themes": stats["weak_themes"],
        "recommendation": stats["recommendation"],
        "recent_games": [GameResponse.model_validate(g) for g in stats["recent_games"]],
    }
