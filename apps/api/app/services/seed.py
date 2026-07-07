from app.auth import hash_password
from app.database import SessionLocal
from app.models import User

TEST_ADMIN_USERNAME = "admin"
TEST_ADMIN_EMAIL = "admin@admin.com"
TEST_ADMIN_PASSWORD = "admin"


def seed_test_admin() -> None:
    db = SessionLocal()
    try:
        existing = (
            db.query(User)
            .filter((User.username == TEST_ADMIN_USERNAME) | (User.email == TEST_ADMIN_EMAIL))
            .first()
        )
        if existing:
            existing.username = TEST_ADMIN_USERNAME
            existing.email = TEST_ADMIN_EMAIL
            existing.hashed_password = hash_password(TEST_ADMIN_PASSWORD)
            db.commit()
            return

        db.add(
            User(
                username=TEST_ADMIN_USERNAME,
                email=TEST_ADMIN_EMAIL,
                hashed_password=hash_password(TEST_ADMIN_PASSWORD),
            )
        )
        db.commit()
    finally:
        db.close()
