"""Автозаполнение базы задачами для разработки и локального запуска."""

from __future__ import annotations

import itertools

import chess
from sqlalchemy.orm import Session

from app.models import Puzzle, PuzzleAttempt

MIN_PUZZLE_COUNT = 500

BASE_SAMPLES: list[dict[str, str | int]] = [
    {
        "lichess_id": "00001",
        "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "moves": "f3g5 d7d5 e4d5 f6d5 g5f7",
        "rating": 1200,
        "themes": "fork mateIn2 opening",
    },
    {
        "lichess_id": "00002",
        "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e8",
        "rating": 900,
        "themes": "backRankMate mateIn1 endgame",
    },
    {
        "lichess_id": "00003",
        "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4",
        "moves": "f8c5 e4e5 c5b6 b1d2",
        "rating": 1300,
        "themes": "pin opening",
    },
    {
        "lichess_id": "00004",
        "fen": "8/8/8/3K4/8/8/3P4/4k3 w - - 0 1",
        "moves": "d5c5 e1d2 c5c4",
        "rating": 1000,
        "themes": "endgame advancedPawn",
    },
    {
        "lichess_id": "00005",
        "fen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
        "moves": "c4f7 e8f7 f3g5 f7g8 g5h7",
        "rating": 1500,
        "themes": "sacrifice fork",
    },
    {
        "lichess_id": "00006",
        "fen": "8/5k2/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e7",
        "rating": 1400,
        "themes": "endgame mateIn1",
    },
    {
        "lichess_id": "00007",
        "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2",
        "moves": "f3e5 b8c6 e5c6",
        "rating": 1100,
        "themes": "fork opening",
    },
    {
        "lichess_id": "00008",
        "fen": "6k1/5n1p/5p2/8/8/5N2/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e8",
        "rating": 950,
        "themes": "backRankMate mateIn1 endgame",
    },
    {
        "lichess_id": "00009",
        "fen": "r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "moves": "c4f7 e8f7 f3g5",
        "rating": 1250,
        "themes": "sacrifice mateIn2",
    },
    {
        "lichess_id": "00010",
        "fen": "5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e8",
        "rating": 1050,
        "themes": "backRankMate mateIn1 endgame",
    },
]


def _position_key(fen: str, moves: str) -> tuple[str, str]:
    return fen, moves.strip()


def _lichess_id(index: int) -> str:
    return f"G{index:09d}"


def _add_puzzle(
    puzzles: list[dict[str, str | int]],
    seen: set[tuple[str, str]],
    fen: str,
    moves: str,
    index: int,
    rating: int,
    themes: str,
) -> bool:
    key = _position_key(fen, moves)
    if key in seen:
        return False
    seen.add(key)
    puzzles.append(
        {
            "lichess_id": _lichess_id(index),
            "fen": fen,
            "moves": moves,
            "rating": rating,
            "themes": themes,
        }
    )
    return True


def _add_mate_in_one(
    puzzles: list[dict[str, str | int]],
    seen: set[tuple[str, str]],
    board: chess.Board,
    move: chess.Move,
    index: int,
    rating: int,
    themes: str,
    attacker_type: chess.PieceType | None = None,
) -> tuple[bool, int]:
    if not board.is_valid() or move not in board.legal_moves:
        return False, index

    piece = board.piece_at(move.from_square)
    if attacker_type and (not piece or piece.piece_type != attacker_type):
        return False, index

    board.push(move)
    is_mate = board.is_checkmate()
    board.pop()
    if not is_mate:
        return False, index

    if _add_puzzle(puzzles, seen, board.fen(), move.uci(), index, rating, themes):
        return True, index + 1
    return False, index


def _generate_back_rank_mates(
    start_index: int,
    seen: set[tuple[str, str]],
) -> tuple[list[dict[str, str | int]], int]:
    puzzles: list[dict[str, str | int]] = []
    index = start_index

    for king_file, rook_file in itertools.product(range(8), range(8)):
        if king_file == rook_file:
            continue

        board = chess.Board.empty()
        board.set_piece_at(chess.square(king_file, 7), chess.Piece(chess.KING, chess.BLACK))
        board.set_piece_at(chess.square(4, 0), chess.Piece(chess.KING, chess.WHITE))
        board.set_piece_at(chess.square(rook_file, 0), chess.Piece(chess.ROOK, chess.WHITE))

        for pawn_file in range(max(0, king_file - 1), min(8, king_file + 2)):
            if board.piece_at(chess.square(pawn_file, 6)) is None:
                board.set_piece_at(chess.square(pawn_file, 6), chess.Piece(chess.PAWN, chess.BLACK))

        board.turn = chess.WHITE
        rating = 850 + (king_file * 35 + rook_file * 15) % 250

        for move in board.legal_moves:
            if move.from_square // 8 != 0:
                continue
            added, index = _add_mate_in_one(
                puzzles,
                seen,
                board,
                move,
                index,
                rating,
                "backRankMate mateIn1 endgame",
                chess.ROOK,
            )
            if added:
                break

    return puzzles, index


def _generate_queen_mates(
    start_index: int,
    seen: set[tuple[str, str]],
) -> tuple[list[dict[str, str | int]], int]:
    puzzles: list[dict[str, str | int]] = []
    index = start_index

    for king_file, queen_file in itertools.product(range(8), range(8)):
        if abs(king_file - queen_file) < 2:
            continue

        board = chess.Board.empty()
        board.set_piece_at(chess.square(king_file, 7), chess.Piece(chess.KING, chess.BLACK))
        board.set_piece_at(chess.square(4, 0), chess.Piece(chess.KING, chess.WHITE))
        board.set_piece_at(chess.square(queen_file, 2), chess.Piece(chess.QUEEN, chess.WHITE))

        for pawn_file in range(max(0, king_file - 1), min(8, king_file + 2)):
            if board.piece_at(chess.square(pawn_file, 6)) is None:
                board.set_piece_at(chess.square(pawn_file, 6), chess.Piece(chess.PAWN, chess.BLACK))

        board.turn = chess.WHITE
        rating = 1050 + (king_file * 40 + queen_file * 20) % 300

        for move in board.legal_moves:
            added, index = _add_mate_in_one(
                puzzles,
                seen,
                board,
                move,
                index,
                rating,
                "mateIn1 middlegame",
                chess.QUEEN,
            )
            if added:
                break

    return puzzles, index


def _generate_sliding_mates(
    start_index: int,
    seen: set[tuple[str, str]],
    piece_type: chess.PieceType,
    themes: str,
) -> tuple[list[dict[str, str | int]], int]:
    puzzles: list[dict[str, str | int]] = []
    index = start_index

    for king_file, king_rank in itertools.product(range(8), (5, 6, 7)):
        for piece_file in range(8):
            for piece_rank in range(8):
                board = chess.Board.empty()
                king_sq = chess.square(king_file, king_rank)
                piece_sq = chess.square(piece_file, piece_rank)
                white_king_sq = chess.square((king_file + 4) % 8, 0)

                if piece_sq in {king_sq, white_king_sq}:
                    continue

                board.set_piece_at(king_sq, chess.Piece(chess.KING, chess.BLACK))
                board.set_piece_at(white_king_sq, chess.Piece(chess.KING, chess.WHITE))
                board.set_piece_at(piece_sq, chess.Piece(piece_type, chess.WHITE))

                if king_rank < 7:
                    for pawn_file in range(max(0, king_file - 1), min(8, king_file + 2)):
                        pawn_sq = chess.square(pawn_file, king_rank + 1)
                        if board.piece_at(pawn_sq) is None:
                            board.set_piece_at(pawn_sq, chess.Piece(chess.PAWN, chess.BLACK))

                board.turn = chess.WHITE
                if not board.is_valid():
                    continue

                rating = 900 + (king_file * 31 + piece_file * 17 + piece_rank * 13 + king_rank * 7) % 700

                for move in board.legal_moves:
                    added, index = _add_mate_in_one(
                        puzzles,
                        seen,
                        board,
                        move,
                        index,
                        rating,
                        themes,
                        piece_type,
                    )
                    if added:
                        break

    return puzzles, index


def _generate_knight_mates(
    start_index: int,
    seen: set[tuple[str, str]],
) -> tuple[list[dict[str, str | int]], int]:
    puzzles: list[dict[str, str | int]] = []
    index = start_index

    for king_corner in (chess.A8, chess.H8):
        board = chess.Board.empty()
        board.set_piece_at(king_corner, chess.Piece(chess.KING, chess.BLACK))
        board.set_piece_at(chess.E1, chess.Piece(chess.KING, chess.WHITE))

        corner_file = chess.square_file(king_corner)
        inner_file = corner_file + (1 if corner_file == 0 else -1)
        board.set_piece_at(chess.square(inner_file, 7), chess.Piece(chess.ROOK, chess.BLACK))
        board.set_piece_at(chess.square(corner_file, 6), chess.Piece(chess.QUEEN, chess.BLACK))

        knight_squares = [
            chess.square(inner_file, 5),
            chess.square(corner_file + (1 if corner_file == 0 else -1), 5),
        ]
        for knight_sq in knight_squares:
            if board.piece_at(knight_sq) is not None:
                continue
            test_board = board.copy()
            test_board.set_piece_at(knight_sq, chess.Piece(chess.KNIGHT, chess.WHITE))
            test_board.turn = chess.WHITE
            if not test_board.is_valid():
                continue

            rating = 1150 + (corner_file * 50) % 200
            for move in test_board.legal_moves:
                added, index = _add_mate_in_one(
                    puzzles,
                    seen,
                    test_board,
                    move,
                    index,
                    rating,
                    "smotheredMate mateIn1 middlegame",
                    chess.KNIGHT,
                )
                if added:
                    break

    return puzzles, index


def generate_bulk_puzzles(target: int = MIN_PUZZLE_COUNT) -> list[dict[str, str | int]]:
    puzzles: list[dict[str, str | int]] = []
    seen: set[tuple[str, str]] = set()
    index = 1

    for sample in BASE_SAMPLES:
        if _add_puzzle(
            puzzles,
            seen,
            str(sample["fen"]),
            str(sample["moves"]),
            index,
            int(sample["rating"]),
            str(sample["themes"]),
        ):
            index += 1

    generators = [
        _generate_back_rank_mates,
        _generate_queen_mates,
        lambda i, s: _generate_sliding_mates(i, s, chess.ROOK, "mateIn1 endgame"),
        lambda i, s: _generate_sliding_mates(i, s, chess.BISHOP, "mateIn1 middlegame"),
        _generate_knight_mates,
    ]

    for generator in generators:
        if len(puzzles) >= target:
            break
        generated, index = generator(index, seen)
        puzzles.extend(generated)

    return puzzles[:target]


def deduplicate_puzzles(db: Session) -> int:
    """Удаляет дубликаты (fen + moves), оставляя запись с минимальным id."""
    rows = db.query(Puzzle.id, Puzzle.fen, Puzzle.moves).order_by(Puzzle.id).all()
    keep_by_position: dict[tuple[str, str], int] = {}
    redirect: dict[int, int] = {}

    for puzzle_id, fen, moves in rows:
        key = _position_key(fen, moves)
        kept_id = keep_by_position.get(key)
        if kept_id is None:
            keep_by_position[key] = puzzle_id
            continue
        redirect[puzzle_id] = kept_id

    if not redirect:
        return 0

    for duplicate_id, kept_id in redirect.items():
        attempts = db.query(PuzzleAttempt).filter(PuzzleAttempt.puzzle_id == duplicate_id).all()
        for attempt in attempts:
            existing = (
                db.query(PuzzleAttempt)
                .filter(
                    PuzzleAttempt.user_id == attempt.user_id,
                    PuzzleAttempt.puzzle_id == kept_id,
                )
                .first()
            )
            if existing:
                if attempt.solved and not existing.solved:
                    existing.solved = True
                if attempt.time_ms and not existing.time_ms:
                    existing.time_ms = attempt.time_ms
                db.delete(attempt)
            else:
                attempt.puzzle_id = kept_id

    db.flush()

    duplicate_ids = list(redirect.keys())
    db.query(Puzzle).filter(Puzzle.id.in_(duplicate_ids)).delete(synchronize_session=False)
    db.commit()
    return len(duplicate_ids)


def ensure_puzzles(db: Session, min_count: int = MIN_PUZZLE_COUNT) -> int:
    removed = deduplicate_puzzles(db)
    if removed:
        print(f"Removed {removed} duplicate puzzles")

    current = db.query(Puzzle).count()
    if current >= min_count:
        return 0

    existing_ids = {row[0] for row in db.query(Puzzle.lichess_id).all()}
    existing_positions = {
        _position_key(fen, moves)
        for fen, moves in db.query(Puzzle.fen, Puzzle.moves).all()
    }
    to_insert: list[Puzzle] = []

    for data in generate_bulk_puzzles(max(min_count, MIN_PUZZLE_COUNT)):
        position = _position_key(str(data["fen"]), str(data["moves"]))
        if data["lichess_id"] in existing_ids or position in existing_positions:
            continue
        to_insert.append(Puzzle(**data))
        existing_ids.add(str(data["lichess_id"]))
        existing_positions.add(position)

        if len(to_insert) >= 500:
            db.bulk_save_objects(to_insert)
            db.commit()
            to_insert.clear()

    if to_insert:
        db.bulk_save_objects(to_insert)
        db.commit()

    return db.query(Puzzle).count() - current
