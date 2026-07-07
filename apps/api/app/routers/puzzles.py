import chess

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.models import Puzzle, PuzzleAttempt, User
from app.schemas import (
    PuzzleLevelResponse,
    PuzzleListItem,
    PuzzleResponse,
    PuzzleSolveRequest,
    PuzzleSolveResponse,
)
from app.services.puzzles import (
    get_daily_puzzle,
    get_levels_progress,
    get_next_puzzle,
    get_puzzles_by_level,
    get_solved_puzzle_ids,
    update_puzzle_rating,
)

router = APIRouter(prefix="/puzzles", tags=["puzzles"])

THEME_LABELS = {
    "fork": "Вилка",
    "pin": "Связка",
    "mateIn1": "Мат в 1",
    "mateIn2": "Мат в 2",
    "mateIn3": "Мат в 3",
    "backRankMate": "Мат на последней горизонтали",
    "discoveredAttack": "Вскрытое нападение",
    "sacrifice": "Жертва",
    "deflection": "Отвлечение",
    "skewer": "Рентген",
    "hangingPiece": "Незащищённая фигура",
    "trappedPiece": "Запертая фигура",
    "advancedPawn": "Проходная пешка",
    "endgame": "Эндшпиль",
    "opening": "Дебют",
    "middlegame": "Миттельшпиль",
}


@router.get("/themes")
def list_themes():
    return [{"id": k, "label": v} for k, v in THEME_LABELS.items()]


@router.get("/daily", response_model=PuzzleResponse)
def daily_puzzle(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    puzzle = get_daily_puzzle(db)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzles in database. Run import script.")
    return _puzzle_response(puzzle, include_moves=user is not None)


def _puzzle_response(puzzle: Puzzle, include_moves: bool, solved: bool | None = None) -> PuzzleResponse:
    return PuzzleResponse(
        id=puzzle.id,
        lichess_id=puzzle.lichess_id,
        fen=puzzle.fen,
        rating=puzzle.rating,
        themes=puzzle.themes,
        moves=puzzle.moves if include_moves else None,
        solved=solved,
    )


@router.get("/levels", response_model=list[PuzzleLevelResponse])
def list_levels(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return get_levels_progress(db, user)


@router.get("/level/{level_id}", response_model=list[PuzzleListItem])
def puzzles_by_level(
    level_id: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    items = get_puzzles_by_level(db, level_id, user)
    if not items:
        raise HTTPException(status_code=404, detail="Level not found or no puzzles")
    return items


@router.get("/next", response_model=PuzzleResponse)
def next_puzzle(
    rating: int | None = None,
    theme: str | None = None,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    puzzle = get_next_puzzle(db, user, rating, theme)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzles found")
    return _puzzle_response(puzzle, include_moves=user is not None)


@router.get("/{puzzle_id}", response_model=PuzzleResponse)
def get_puzzle(
    puzzle_id: int,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    puzzle = db.get(Puzzle, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    solved = None
    if user:
        solved = puzzle_id in get_solved_puzzle_ids(db, user.id)
    return _puzzle_response(puzzle, include_moves=user is not None, solved=solved)


@router.post("/{puzzle_id}/solve", response_model=PuzzleSolveResponse)
def solve_puzzle(
    puzzle_id: int,
    data: PuzzleSolveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    puzzle = db.get(Puzzle, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    expected_moves = puzzle.moves.split()
    correct = _check_solution(puzzle.fen, expected_moves, data.moves)

    rating_change = update_puzzle_rating(user, puzzle.rating, correct)
    if correct:
        user.puzzle_streak += 1
    else:
        user.puzzle_streak = 0

    attempt = PuzzleAttempt(
        user_id=user.id,
        puzzle_id=puzzle.id,
        solved=correct,
        time_ms=data.time_ms,
    )
    db.add(attempt)
    db.commit()
    db.refresh(user)

    return PuzzleSolveResponse(
        correct=correct,
        puzzle_rating_change=round(rating_change, 1),
        new_rating=round(user.puzzle_rating, 1),
        streak=user.puzzle_streak,
    )


def _check_solution(start_fen: str, expected: list[str], user_moves: list[str]) -> bool:
    """Validate solver moves at even indices (0, 2, 4…); odd indices are opponent replies."""
    board = chess.Board(start_fen)
    user_idx = 0
    for i, uci in enumerate(expected):
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return False
        if i % 2 == 0:
            if user_idx >= len(user_moves):
                return False
            if user_moves[user_idx].lower() != uci.lower():
                return False
            user_idx += 1
        if move not in board.legal_moves:
            return False
        board.push(move)
    return user_idx == len(user_moves)
