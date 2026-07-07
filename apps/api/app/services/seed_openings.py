from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Lesson
from app.services.openings_data import OPENINGS
from app.services.openings_insights import OPENING_INSIGHTS


def ensure_opening_columns() -> None:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS popularity INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS eco VARCHAR(10) NOT NULL DEFAULT ''"))
        conn.execute(
            text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS player_color VARCHAR(5) NOT NULL DEFAULT 'white'")
        )
        conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS pros JSONB NOT NULL DEFAULT '[]'::jsonb"))
        conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS cons JSONB NOT NULL DEFAULT '[]'::jsonb"))


def seed_openings() -> None:
    db = Session(engine)
    try:
        titles = {o["title"] for o in OPENINGS}
        for opening in OPENINGS:
            existing = db.query(Lesson).filter(Lesson.title == opening["title"], Lesson.category == "opening").first()
            insights = OPENING_INSIGHTS.get(opening["title"], {})
            data = {
                "title": opening["title"],
                "category": "opening",
                "description": opening["description"],
                "difficulty": 1,
                "steps": opening["steps"],
                "popularity": opening["popularity"],
                "eco": opening["eco"],
                "player_color": opening["player_color"],
                "pros": insights.get("pros", opening.get("pros", [])),
                "cons": insights.get("cons", opening.get("cons", [])),
            }
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
            else:
                db.add(Lesson(**data))

        stale = db.query(Lesson).filter(Lesson.category == "opening", ~Lesson.title.in_(titles)).all()
        for lesson in stale:
            db.delete(lesson)

        db.commit()
    finally:
        db.close()
