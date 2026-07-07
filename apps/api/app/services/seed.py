from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import User


def seed_test_admin() -> None:
    db = SessionLocal()
    try:
        existing = (
            db.query(User)
            .filter(
                (User.username == settings.admin_username)
                | (User.email == f"{settings.admin_username}@admin.com")
            )
            .first()
        )
        if existing:
            existing.username = settings.admin_username
            existing.email = f"{settings.admin_username}@admin.com"
            existing.hashed_password = hash_password(settings.admin_password)
            db.commit()
            return

        db.add(
            User(
                username=settings.admin_username,
                email=f"{settings.admin_username}@admin.com",
                hashed_password=hash_password(settings.admin_password),
            )
        )
        db.commit()
    finally:
        db.close()
