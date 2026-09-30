#!/usr/bin/env python3
"""CLI-обёртка над app.services.chesscom_sync."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from app.services.chesscom_sync import (  # noqa: E402
    analyze_player,
    download_player,
    find_stockfish,
    games_dir,
    safe_name,
    sync_players,
    write_report,
    Stockfish,
)


def cmd_download(args: argparse.Namespace) -> None:
    games_dir().mkdir(parents=True, exist_ok=True)
    for nick in args.usernames:
        path = download_player(nick)
        print(f"OK {nick} → {path}")


def cmd_analyze(args: argparse.Namespace) -> None:
    report = sync_players(
        args.usernames
        or [path.name for path in games_dir().iterdir() if path.is_dir() and (path / "index.json").is_file()],
        depth=args.depth,
        max_games=args.max_games,
        max_ply=args.max_ply,
        download=False,
        on_progress=lambda stage, progress, message: print(f"[{progress:5.1f}%] {stage}: {message}"),
    )
    print(f"Игроков в отчёте: {len(report['players'])}")


def cmd_all(args: argparse.Namespace) -> None:
    sync_players(
        args.usernames,
        depth=args.depth,
        max_games=args.max_games,
        max_ply=args.max_ply,
        download=True,
        on_progress=lambda stage, progress, message: print(f"[{progress:5.1f}%] {stage}: {message}"),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Партии chess.com → анализ ошибок")
    sub = parser.add_subparsers(dest="command", required=True)

    p_download = sub.add_parser("download", help="Скачать партии в games/")
    p_download.add_argument("usernames", nargs="+")
    p_download.set_defaults(func=cmd_download)

    p_analyze = sub.add_parser("analyze", help="Разобрать скачанные партии")
    p_analyze.add_argument("usernames", nargs="*")
    p_analyze.add_argument("--depth", type=int, default=12)
    p_analyze.add_argument("--max-games", type=int, default=60)
    p_analyze.add_argument("--max-ply", type=int, default=40)
    p_analyze.set_defaults(func=cmd_analyze)

    p_all = sub.add_parser("all", help="Скачать и проанализировать")
    p_all.add_argument("usernames", nargs="+")
    p_all.add_argument("--depth", type=int, default=12)
    p_all.add_argument("--max-games", type=int, default=60)
    p_all.add_argument("--max-ply", type=int, default=40)
    p_all.set_defaults(func=cmd_all)

    return parser


def main() -> None:
    # тихий импорт-чек stockfish путей не обязателен
    _ = (find_stockfish, safe_name, analyze_player, write_report, Stockfish)
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
