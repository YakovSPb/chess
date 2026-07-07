from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Lesson
from app.routers import auth, coach, games, lessons, openings, puzzles
from app.services.lessons_data import LESSONS
from app.services.seed import seed_test_admin
from app.services.seed_openings import ensure_opening_columns, seed_openings
from app.services.seed_puzzles import ensure_puzzles


def seed_lessons():
    db = SessionLocal()
    try:
        if db.query(Lesson).filter(Lesson.category != "opening").count() == 0:
            for lesson_data in LESSONS:
                db.add(Lesson(**lesson_data))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_opening_columns()
    seed_lessons()
    seed_openings()
    seed_test_admin()
    db = SessionLocal()
    try:
        added = ensure_puzzles(db)
        if added:
            print(f"Seeded {added} puzzles (target: 500+ unique)")
    finally:
        db.close()
    yield


app = FastAPI(title="Chess Training API", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(games.router)
app.include_router(puzzles.router)
app.include_router(coach.router)
app.include_router(lessons.router)
app.include_router(openings.router)


@app.get("/health")
def health():
    return {"status": "ok"}
