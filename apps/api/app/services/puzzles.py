import math
import random
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Game, Puzzle, PuzzleAttempt, User


def update_puzzle_rating(user: User, puzzle_rating: int, solved: bool) -> float:
    """Glicko-like rating update simplified."""
    expected = 1 / (1 + 10 ** ((puzzle_rating - user.puzzle_rating) / 400))
    score = 1.0 if solved else 0.0
    k = 32 * (user.puzzle_rating_deviation / 350)
    change = k * (score - expected)
    user.puzzle_rating = max(400, user.puzzle_rating + change)
    user.puzzle_rating_deviation = max(50, user.puzzle_rating_deviation * 0.995)
    return change


def get_solved_puzzle_ids(db: Session, user_id: int) -> set[int]:
    rows = (
        db.query(PuzzleAttempt.puzzle_id)
        .filter(PuzzleAttempt.user_id == user_id, PuzzleAttempt.solved.is_(True))
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def get_levels_progress(db: Session, user: User | None) -> list[dict]:
    from app.services.puzzle_levels import PUZZLE_LEVELS

    solved_ids: set[int] = set()
    if user:
        solved_ids = get_solved_puzzle_ids(db, user.id)

    result = []
    for level in PUZZLE_LEVELS:
        puzzles = (
            db.query(Puzzle.id)
            .filter(
                Puzzle.rating >= level["min_rating"],
                Puzzle.rating <= level["max_rating"],
            )
            .all()
        )
        puzzle_ids = [p[0] for p in puzzles]
        solved_count = sum(1 for pid in puzzle_ids if pid in solved_ids)
        result.append(
            {
                "id": level["id"],
                "label": level["label"],
                "min_rating": level["min_rating"],
                "max_rating": level["max_rating"],
                "total": len(puzzle_ids),
                "solved": solved_count,
            }
        )
    return result


def get_puzzles_by_level(db: Session, level_id: str, user: User | None) -> list[dict]:
    from app.services.puzzle_levels import get_level

    level = get_level(level_id)
    if not level:
        return []

    solved_ids: set[int] = set()
    if user:
        solved_ids = get_solved_puzzle_ids(db, user.id)

    puzzles = (
        db.query(Puzzle)
        .filter(
            Puzzle.rating >= level["min_rating"],
            Puzzle.rating <= level["max_rating"],
        )
        .order_by(Puzzle.rating, Puzzle.id)
        .all()
    )

    return [
        {
            "id": p.id,
            "lichess_id": p.lichess_id,
            "rating": p.rating,
            "themes": p.themes,
            "solved": p.id in solved_ids,
            "index": i + 1,
        }
        for i, p in enumerate(puzzles)
    ]


def get_next_puzzle(
    db: Session,
    user: User | None,
    rating: int | None = None,
    theme: str | None = None,
) -> Puzzle | None:
    target_rating = rating or (int(user.puzzle_rating) if user else 1200)
    query = db.query(Puzzle).filter(
        Puzzle.rating.between(target_rating - 200, target_rating + 200)
    )
    if theme:
        query = query.filter(Puzzle.themes.contains(theme))

    if user:
        solved_ids = (
            db.query(PuzzleAttempt.puzzle_id)
            .filter(PuzzleAttempt.user_id == user.id, PuzzleAttempt.solved.is_(True))
            .subquery()
        )
        query = query.filter(~Puzzle.id.in_(solved_ids))

    count = query.count()
    if count == 0:
        query = db.query(Puzzle)
        if theme:
            query = query.filter(Puzzle.themes.contains(theme))
        count = query.count()
    if count == 0:
        return None

    offset = random.randint(0, min(count - 1, 100))
    return query.offset(offset).first()


def get_daily_puzzle(db: Session) -> Puzzle | None:
    """Deterministic daily puzzle based on date."""
    today = date.today().isoformat()
    seed = sum(ord(c) for c in today)
    count = db.query(Puzzle).filter(Puzzle.rating.between(1400, 1800)).count()
    if count == 0:
        count = db.query(Puzzle).count()
        if count == 0:
            return None
        return db.query(Puzzle).offset(seed % count).first()
    return (
        db.query(Puzzle)
        .filter(Puzzle.rating.between(1400, 1800))
        .offset(seed % count)
        .first()
    )


def compute_dashboard_stats(db: Session, user: User) -> dict:
    games = (
        db.query(Game)
        .filter(Game.user_id == user.id)
        .order_by(Game.created_at.desc())
        .limit(10)
        .all()
    )
    games_played = db.query(Game).filter(Game.user_id == user.id).count()

    accuracies = []
    for game in games:
        if game.analysis and "accuracy" in game.analysis:
            accuracies.append(game.analysis["accuracy"])
    avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else None

    weak_themes = _get_weak_themes(db, user)

    recommendation = _build_recommendation(user, weak_themes)

    return {
        "puzzle_rating": user.puzzle_rating,
        "puzzle_streak": user.puzzle_streak,
        "games_played": games_played,
        "avg_accuracy": avg_accuracy,
        "weak_themes": weak_themes,
        "recommendation": recommendation,
        "recent_games": games,
    }


def _get_weak_themes(db: Session, user: User, limit: int = 3) -> list[str]:
    failed = (
        db.query(Puzzle.themes, func.count(PuzzleAttempt.id).label("cnt"))
        .join(PuzzleAttempt, PuzzleAttempt.puzzle_id == Puzzle.id)
        .filter(PuzzleAttempt.user_id == user.id, PuzzleAttempt.solved.is_(False))
        .group_by(Puzzle.themes)
        .order_by(func.count(PuzzleAttempt.id).desc())
        .limit(limit)
        .all()
    )
    themes: list[str] = []
    for theme_str, _ in failed:
        for t in theme_str.split():
            if t not in themes:
                themes.append(t)
            if len(themes) >= limit:
                break
    return themes or ["fork", "pin", "mateIn2"]


def _build_recommendation(user: User, weak_themes: list[str]) -> str:
    theme = weak_themes[0] if weak_themes else "fork"
    theme_ru = {
        "fork": "вилка",
        "pin": "связка",
        "mateIn2": "мат в 2",
        "backRankMate": "мат на последней горизонтали",
        "discoveredAttack": "вскрытое нападение",
        "sacrifice": "жертва",
    }.get(theme, theme)
    return f"Сегодня: 20 задач на тему «{theme_ru}» + 1 партия с тренером"
