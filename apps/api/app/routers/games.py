from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Game, User
from app.schemas import GameCreate, GameResponse, GameUpdate

router = APIRouter(prefix="/games", tags=["games"])


@router.get("", response_model=list[GameResponse])
def list_games(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    return (
        db.query(Game)
        .filter(Game.user_id == user.id)
        .order_by(Game.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("", response_model=GameResponse)
def create_game(
    data: GameCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = Game(
        user_id=user.id,
        mode=data.mode,
        bot_elo=data.bot_elo,
        time_control=data.time_control,
        player_color=data.player_color,
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = db.query(Game).filter(Game.id == game_id, Game.user_id == user.id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.patch("/{game_id}", response_model=GameResponse)
def update_game(
    game_id: int,
    data: GameUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = db.query(Game).filter(Game.id == game_id, Game.user_id == user.id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if data.pgn is not None:
        game.pgn = data.pgn
    if data.result is not None:
        game.result = data.result
    if data.analysis is not None:
        game.analysis = data.analysis
    if data.coach_summary is not None:
        game.coach_summary = data.coach_summary
    db.commit()
    db.refresh(game)
    return game
