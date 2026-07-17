from sqlalchemy.orm import Session

from app.database import engine
from app.models import Lesson
from app.services.championships_data import CHAMPIONSHIPS


def seed_championships() -> None:
    db = Session(engine)
    try:
        titles = {g["title"] for g in CHAMPIONSHIPS}
        for game in CHAMPIONSHIPS:
            existing = (
                db.query(Lesson)
                .filter(Lesson.title == game["title"], Lesson.category == "championship")
                .first()
            )
            meta = {
                "event": game["event"],
                "year": game["year"],
                "white": game["white"],
                "black": game["black"],
                "result": game["result"],
                "winner": game["winner"],
                "winner_name": game["winner_name"],
                "loser_name": game["loser_name"],
            }
            data = {
                "title": game["title"],
                "category": "championship",
                "description": game["description"],
                "difficulty": 2,
                "steps": game["steps"],
                "popularity": game["popularity"],
                "eco": str(game["year"]),
                "player_color": game["player_color"],
                "pros": [meta],
                "cons": [],
            }
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
            else:
                db.add(Lesson(**data))

        stale = (
            db.query(Lesson)
            .filter(Lesson.category == "championship", ~Lesson.title.in_(titles))
            .all()
        )
        for lesson in stale:
            db.delete(lesson)

        db.commit()
    finally:
        db.close()
