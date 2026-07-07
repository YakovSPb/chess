#!/usr/bin/env python3
"""Import Lichess puzzles from CSV or seed sample puzzles for development."""

import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Puzzle
from app.services.seed_puzzles import BASE_SAMPLES, deduplicate_puzzles, ensure_puzzles

# Moves in UCI format (as in Lichess database)
SAMPLE_PUZZLES = BASE_SAMPLES


def seed_samples(db: Session, force: bool = False) -> int:
    count = 0
    for p in SAMPLE_PUZZLES:
        existing = db.query(Puzzle).filter(Puzzle.lichess_id == p["lichess_id"]).first()
        if existing:
            if force:
                for key, value in p.items():
                    setattr(existing, key, value)
                count += 1
            continue
        db.add(Puzzle(**p))
        count += 1
    db.commit()
    return count


def import_csv(db: Session, csv_path: Path, max_rows: int = 100000) -> int:
    import zstandard as zstd

    count = 0
    if csv_path.suffix == ".zst":
        dctx = zstd.ZstdDecompressor()
        with open(csv_path, "rb") as f:
            data = dctx.decompress(f.read())
        reader = csv.DictReader(io.StringIO(data.decode("utf-8")))
    else:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

    batch = []
    for row in reader:
        if count >= max_rows:
            break
        rating = int(row.get("Rating", 1200))
        if rating < 800 or rating > 2500:
            continue
        lichess_id = row["PuzzleId"]
        if db.query(Puzzle).filter(Puzzle.lichess_id == lichess_id).first():
            continue
        batch.append(
            Puzzle(
                lichess_id=lichess_id,
                fen=row["FEN"],
                moves=row["Moves"],
                rating=rating,
                rating_deviation=int(row.get("RatingDeviation", 75)),
                popularity=int(row.get("Popularity", 0)),
                themes=row.get("Themes", ""),
                opening_tags=row.get("OpeningTags", ""),
            )
        )
        if len(batch) >= 1000:
            db.bulk_save_objects(batch)
            db.commit()
            count += len(batch)
            batch = []
            print(f"Imported {count} puzzles...")

    if batch:
        db.bulk_save_objects(batch)
        db.commit()
        count += len(batch)
    return count


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Import Lichess puzzles")
    parser.add_argument("--csv", type=Path, help="Path to lichess_db_puzzle.csv or .zst")
    parser.add_argument("--max", type=int, default=100000, help="Max puzzles to import")
    parser.add_argument("--seed-only", action="store_true", help="Only seed sample puzzles")
    parser.add_argument("--force", action="store_true", help="Update existing sample puzzles")
    parser.add_argument("--dedup", action="store_true", help="Remove duplicate puzzles (same fen+moves)")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.dedup:
            removed = deduplicate_puzzles(db)
            print(f"Removed {removed} duplicate puzzles")
        if args.seed_only or args.csv is None:
            n = seed_samples(db, force=args.force)
            print(f"Seeded {n} sample puzzles")
            bulk = ensure_puzzles(db)
            if bulk:
                print(f"Bulk seeded {bulk} puzzles")
        if args.csv and args.csv.exists():
            n = import_csv(db, args.csv, args.max)
            print(f"Imported {n} puzzles from {args.csv}")
        total = db.query(Puzzle).count()
        print(f"Total puzzles in database: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
