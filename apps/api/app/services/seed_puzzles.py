"""Автозаполнение базы задачами для разработки и локального запуска."""

from __future__ import annotations

import itertools

import chess
from sqlalchemy.orm import Session

from app.models import Puzzle

MIN_PUZZLE_COUNT = 2500

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
        "fen": "6k1/5ppp/8/8/8/5N2/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e8",
        "rating": 1400,
        "themes": "mateIn1 endgame",
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
        "fen": "8/5k2/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e7",
        "rating": 1700,
        "themes": "endgame",
    },
    {
        "lichess_id": "00009",
        "fen": "6k1/5n1p/5p2/8/8/5N2/5PPP/4R1K1 w - - 0 1",
        "moves": "e1e8",
        "rating": 950,
        "themes": "backRankMate mateIn1 endgame",
    },
    {
        "lichess_id": "00010",
        "fen": "r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "moves": "c4f7 e8f7 f3g5",
        "rating": 1250,
        "themes": "sacrifice mateIn2",
    },
]


def _lichess_id(index: int) -> str:
    return f"G{index:09d}"


def _add_puzzle(
    puzzles: list[dict[str, str | int]],
    fen: str,
    moves: str,
    index: int,
    rating: int,
    themes: str,
) -> None:
    puzzles.append(
        {
            "lichess_id": _lichess_id(index),
            "fen": fen,
            "moves": moves,
            "rating": rating,
            "themes": themes,
        }
    )


def _add_mate_in_one(
    puzzles: list[dict[str, str | int]],
    board: chess.Board,
    move: chess.Move,
    index: int,
    rating: int,
    themes: str,
) -> bool:
    if not board.is_valid() or move not in board.legal_moves:
        return False

    board.push(move)
    is_mate = board.is_checkmate()
    board.pop()
    if not is_mate:
        return False

    _add_puzzle(puzzles, board.fen(), move.uci(), index, rating, themes)
    return True


def _generate_back_rank_mates(start_index: int) -> tuple[list[dict[str, str | int]], int]:
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
            if _add_mate_in_one(puzzles, board, move, index, rating, "backRankMate mateIn1 endgame"):
                index += 1
                break

    return puzzles, index


def _generate_queen_mates(start_index: int) -> tuple[list[dict[str, str | int]], int]:
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
            piece = board.piece_at(move.from_square)
            if not piece or piece.piece_type != chess.QUEEN:
                continue
            if _add_mate_in_one(puzzles, board, move, index, rating, "mateIn1 middlegame"):
                index += 1
                break

    return puzzles, index


def _generate_rating_variants(
    start_index: int,
    templates: list[dict[str, str | int]],
    count: int,
) -> tuple[list[dict[str, str | int]], int]:
    puzzles: list[dict[str, str | int]] = []
    index = start_index

    for variant in range(count):
        template = templates[variant % len(templates)]
        base_rating = int(template["rating"])
        rating = max(800, min(2500, base_rating - 200 + (variant * 13) % 450))
        _add_puzzle(
            puzzles,
            str(template["fen"]),
            str(template["moves"]),
            index,
            rating,
            str(template["themes"]),
        )
        index += 1

    return puzzles, index


def generate_bulk_puzzles(target: int = MIN_PUZZLE_COUNT) -> list[dict[str, str | int]]:
    puzzles: list[dict[str, str | int]] = []
    index = 1

    for sample in BASE_SAMPLES:
        _add_puzzle(
            puzzles,
            str(sample["fen"]),
            str(sample["moves"]),
            index,
            int(sample["rating"]),
            str(sample["themes"]),
        )
        index += 1

    generated, index = _generate_back_rank_mates(index)
    puzzles.extend(generated)

    generated, index = _generate_queen_mates(index)
    puzzles.extend(generated)

    if len(puzzles) < target:
        generated, _index = _generate_rating_variants(index, BASE_SAMPLES, target - len(puzzles))
        puzzles.extend(generated)

    return puzzles[:target]


def ensure_puzzles(db: Session, min_count: int = MIN_PUZZLE_COUNT) -> int:
    current = db.query(Puzzle).count()
    if current >= min_count:
        return 0

    existing_ids = {row[0] for row in db.query(Puzzle.lichess_id).all()}
    to_insert: list[Puzzle] = []

    for data in generate_bulk_puzzles(max(min_count, MIN_PUZZLE_COUNT)):
        if data["lichess_id"] in existing_ids:
            continue
        to_insert.append(Puzzle(**data))
        existing_ids.add(str(data["lichess_id"]))

        if len(to_insert) >= 500:
            db.bulk_save_objects(to_insert)
            db.commit()
            to_insert.clear()

    if to_insert:
        db.bulk_save_objects(to_insert)
        db.commit()

    return db.query(Puzzle).count() - current
