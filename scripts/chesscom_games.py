#!/usr/bin/env python3
"""Скачать партии chess.com и собрать отчёт по дебютам и ошибкам.

Примеры:
  apps/api/.venv/bin/python scripts/chesscom_games.py download Hikaru SonNick
  apps/api/.venv/bin/python scripts/chesscom_games.py analyze --depth 12 --max-games 80
  apps/api/.venv/bin/python scripts/chesscom_games.py all MyNick SonNick --depth 12
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES_DIR = ROOT / "games"
REPORT_PATH = ROOT / "apps" / "web" / "public" / "games-report.json"
STOCKFISH_CANDIDATES = [
    ROOT / "tools" / "stockfish" / "stockfish-ubuntu-x86-64-avx2",
    ROOT / "tools" / "stockfish",
    Path(shutil.which("stockfish") or ""),
]

USER_AGENT = "ChessTrainerLocal/1.0 (personal training; contact: local)"
ARCHIVE_PAUSE_S = 0.35

# Короткий справочник ECO по первым ходам (достаточно для кластеризации).
ECO_BY_MOVES: dict[str, tuple[str, str]] = {
    "1.e4 e5 2.Nf3 Nc6 3.Bc4": ("C50", "Итальянская партия"),
    "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6": ("C55", "Двухконей"),
    "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5": ("C57", "Атака жареной печени"),
    "1.e4 e5 2.Nf3 Nc6 3.Bb5": ("C60", "Испанская партия"),
    "1.e4 e5 2.Nf3 d6": ("C41", "Защита Филидора"),
    "1.e4 e5 2.Nf3 Nf6": ("C42", "Русская партия"),
    "1.e4 c5": ("B20", "Сицилианская защита"),
    "1.e4 c5 2.Nf3 d6": ("B50", "Сицилианская"),
    "1.e4 c5 2.Nf3 Nc6": ("B30", "Сицилианская"),
    "1.e4 c5 2.Nf3 e6": ("B40", "Сицилианская"),
    "1.e4 c6": ("B10", "Каро-Канн"),
    "1.e4 c6 2.d4 d5": ("B12", "Каро-Канн"),
    "1.e4 e6": ("C00", "Французская защита"),
    "1.e4 e6 2.d4 d5": ("C01", "Французская защита"),
    "1.e4 d5": ("B01", "Скандинавская защита"),
    "1.e4 d6": ("B07", "Защита Пирца"),
    "1.e4 g6": ("B06", "Современная защита"),
    "1.e4 Nf6": ("A05", "Алехин"),
    "1.d4 d5 2.c4": ("D06", "Ферзевый гамбит"),
    "1.d4 d5 2.c4 e6": ("D30", "Отказанный ферзевый гамбит"),
    "1.d4 d5 2.c4 c6": ("D10", "Славянская защита"),
    "1.d4 d5 2.Nf3 Nf6 3.Bf4": ("D02", "Лондонская система"),
    "1.d4 d5 2.Bf4": ("D00", "Лондонская система"),
    "1.d4 Nf6 2.c4 e6": ("E00", "Индийская / Нимцович"),
    "1.d4 Nf6 2.c4 g6": ("E60", "Королевско-индийская"),
    "1.d4 Nf6 2.Nf3 e6 3.Bf4": ("A46", "Лондонская против ...e6"),
    "1.d4 Nf6 2.Nf3 g6 3.Bf4": ("A48", "Лондонская против ...g6"),
    "1.d4 e5": ("A40", "Энглунд"),
    "1.c4": ("A10", "Английское начало"),
    "1.Nf3": ("A04", "Рети"),
    "1.e4": ("B00", "1.e4"),
    "1.d4": ("A40", "1.d4"),
}


def _http_get_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip()) or "player"


def find_stockfish() -> Path:
    env = os.environ.get("STOCKFISH_PATH")
    if env and Path(env).is_file():
        return Path(env)
    for candidate in STOCKFISH_CANDIDATES:
        if candidate and candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise FileNotFoundError(
        "Stockfish не найден. Скачайте в tools/ или задайте STOCKFISH_PATH. "
        "См. docs/games-analysis.md"
    )


def download_player(username: str) -> Path:
    import chess.pgn  # noqa: F401 — проверка зависимости

    nick = username.strip().lstrip("@")
    out_dir = GAMES_DIR / _safe_name(nick.lower())
    pgn_dir = out_dir / "pgn"
    out_dir.mkdir(parents=True, exist_ok=True)
    pgn_dir.mkdir(parents=True, exist_ok=True)

    archives_url = f"https://api.chess.com/pub/player/{nick}/games/archives"
    try:
        archives = _http_get_json(archives_url)
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Не удалось получить архивы для {nick}: HTTP {exc.code}") from exc

    if not isinstance(archives, dict) or "archives" not in archives:
        raise SystemExit(f"Неожиданный ответ archives для {nick}")

    archive_urls: list[str] = list(archives["archives"])
    all_games: list[dict] = []
    print(f"[{nick}] архивов: {len(archive_urls)}")

    for index, archive_url in enumerate(archive_urls, start=1):
        try:
            payload = _http_get_json(archive_url)
        except urllib.error.HTTPError as exc:
            print(f"  пропуск {archive_url}: HTTP {exc.code}")
            continue
        games = payload.get("games", []) if isinstance(payload, dict) else []
        print(f"  [{index}/{len(archive_urls)}] {archive_url.rsplit('/', 2)[-2]}/{archive_url.rsplit('/', 1)[-1]} → {len(games)}")
        for game in games:
            pgn = game.get("pgn") or ""
            if not pgn:
                continue
            end_time = game.get("end_time") or 0
            uuid = game.get("uuid") or game.get("url") or f"{end_time}"
            file_stem = _safe_name(str(uuid))[:80]
            pgn_path = pgn_dir / f"{file_stem}.pgn"
            pgn_path.write_text(pgn + ("\n" if not pgn.endswith("\n") else ""), encoding="utf-8")
            white = (game.get("white") or {}).get("username", "")
            black = (game.get("black") or {}).get("username", "")
            side = "white" if white.lower() == nick.lower() else "black" if black.lower() == nick.lower() else "?"
            result_raw = (game.get("white") or {}).get("result") if side == "white" else (game.get("black") or {}).get("result")
            all_games.append(
                {
                    "uuid": str(uuid),
                    "url": game.get("url"),
                    "end_time": end_time,
                    "time_class": game.get("time_class"),
                    "time_control": game.get("time_control"),
                    "rated": game.get("rated"),
                    "white": white,
                    "black": black,
                    "white_rating": (game.get("white") or {}).get("rating"),
                    "black_rating": (game.get("black") or {}).get("rating"),
                    "side": side,
                    "result": result_raw,
                    "pgn_file": str(pgn_path.relative_to(ROOT)),
                }
            )
        time.sleep(ARCHIVE_PAUSE_S)

    all_games.sort(key=lambda item: item.get("end_time") or 0, reverse=True)
    index_path = out_dir / "index.json"
    index_path.write_text(
        json.dumps(
            {
                "username": nick,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "games_count": len(all_games),
                "games": all_games,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[{nick}] сохранено партий: {len(all_games)} → {out_dir}")
    return out_dir


def score_line(moves: list[str], limit: int = 10) -> str:
    parts: list[str] = []
    for index, san in enumerate(moves[:limit]):
        if index % 2 == 0:
            parts.append(f"{index // 2 + 1}.{san}")
        else:
            parts.append(san)
    return " ".join(parts)


def classify_opening(moves: list[str]) -> tuple[str, str, str]:
    """Возвращает (eco, name, key_moves)."""
    best_key = ""
    best = ("A00", "Неизвестный дебют")
    for length in range(min(12, len(moves)), 0, -1):
        key = score_line(moves, length)
        if key in ECO_BY_MOVES:
            best_key = key
            best = ECO_BY_MOVES[key]
            break
        # частичное совпадение по префиксу справочника
        for eco_key, value in ECO_BY_MOVES.items():
            if key.startswith(eco_key) and len(eco_key) > len(best_key):
                best_key = eco_key
                best = value
    if not best_key and moves:
        best_key = score_line(moves, min(6, len(moves)))
        first = moves[0]
        if first == "e4":
            best = ("B00", "1.e4")
        elif first == "d4":
            best = ("A40", "1.d4")
        elif first == "c4":
            best = ("A10", "Английское начало")
        elif first == "Nf3":
            best = ("A04", "Рети")
    return best[0], best[1], best_key or score_line(moves, min(6, len(moves)))


def result_bucket(result: str | None) -> str:
    if not result:
        return "unknown"
    if result in {"win"}:
        return "win"
    if result in {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}:
        return "draw"
    return "loss"


@dataclass
class EngineMove:
    best_uci: str
    best_san: str
    score_cp: int


class Stockfish:
    def __init__(self, path: Path, depth: int = 12):
        self.depth = depth
        self.proc = subprocess.Popen(
            [str(path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self._wait_for("uciok")
        self._send("setoption name Threads value 2")
        self._send("setoption name Hash value 128")
        self._send("isready")
        self._wait_for("readyok")

    def _send(self, line: str) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

    def _wait_for(self, token: str) -> list[str]:
        assert self.proc.stdout is not None
        lines: list[str] = []
        while True:
            line = self.proc.stdout.readline()
            if not line:
                break
            line = line.strip()
            lines.append(line)
            if token in line:
                break
        return lines

    def analyze(self, fen: str) -> EngineMove:
        import chess

        board = chess.Board(fen)
        self._send("ucinewgame")
        self._send(f"position fen {fen}")
        self._send(f"go depth {self.depth}")
        lines = self._wait_for("bestmove")
        best_uci = "0000"
        score_cp = 0
        for line in lines:
            if line.startswith("info") and " score " in line and " pv " in line:
                parts = line.split()
                if "cp" in parts:
                    score_cp = int(parts[parts.index("cp") + 1])
                elif "mate" in parts:
                    mate = int(parts[parts.index("mate") + 1])
                    score_cp = 100000 if mate > 0 else -100000
                if "pv" in parts:
                    best_uci = parts[parts.index("pv") + 1]
            if line.startswith("bestmove"):
                parts = line.split()
                if len(parts) >= 2:
                    best_uci = parts[1]
        try:
            move = chess.Move.from_uci(best_uci)
            best_san = board.san(move) if move in board.legal_moves else best_uci
        except ValueError:
            best_san = best_uci
        return EngineMove(best_uci=best_uci, best_san=best_san, score_cp=score_cp)

    def close(self) -> None:
        try:
            self._send("quit")
        except Exception:
            pass
        try:
            self.proc.kill()
        except Exception:
            pass


def clamp_cp(score_cp: int) -> int:
    """Матовые оценки сжимаем, чтобы средние потери не улетали в ±100000."""
    if score_cp >= 50000:
        return 1000
    if score_cp <= -50000:
        return -1000
    return score_cp


def loss_kind(loss_cp: int) -> str:
    if loss_cp >= 300:
        return "blunder"
    if loss_cp >= 120:
        return "mistake"
    if loss_cp >= 50:
        return "inaccuracy"
    return "ok"


def phase_of(ply: int) -> str:
    if ply < 20:
        return "opening"
    if ply < 50:
        return "middlegame"
    return "endgame"


def analyze_player(player_dir: Path, engine: Stockfish, max_games: int, max_ply: int) -> dict:
    import chess
    import chess.pgn

    index_path = player_dir / "index.json"
    if not index_path.is_file():
        raise FileNotFoundError(f"Нет index.json в {player_dir}")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    username = index["username"]
    games = index.get("games") or []
    selected = games[:max_games]

    openings: dict[str, dict] = {}
    mistake_groups: dict[str, dict] = {}
    totals = Counter()
    analyzed = 0

    for game_meta in selected:
        pgn_rel = game_meta.get("pgn_file")
        if not pgn_rel:
            continue
        pgn_path = ROOT / pgn_rel
        if not pgn_path.is_file():
            continue
        with pgn_path.open(encoding="utf-8") as handle:
            game = chess.pgn.read_game(handle)
        if game is None:
            continue

        side = game_meta.get("side")
        if side not in {"white", "black"}:
            continue
        player_color = chess.WHITE if side == "white" else chess.BLACK
        bucket = result_bucket(game_meta.get("result"))
        totals[bucket] += 1
        analyzed += 1

        board = game.board()
        sans: list[str] = []
        node = game
        skip_game = False
        while node.variations:
            node = node.variation(0)
            move = node.move
            if move not in board.legal_moves:
                skip_game = True
                break
            sans.append(board.san(move))
            board.push(move)
        if skip_game:
            analyzed -= 1
            totals[bucket] -= 1
            continue

        eco, opening_name, key_moves = classify_opening(sans)
        opening_key = f"{eco}|{opening_name}|{side}"
        opening = openings.setdefault(
            opening_key,
            {
                "eco": eco,
                "name": opening_name,
                "side": side,
                "keyMoves": key_moves,
                "count": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "lossCpSum": 0,
                "lossCpSamples": 0,
            },
        )
        opening["count"] += 1
        if bucket == "win":
            opening["wins"] += 1
        elif bucket == "draw":
            opening["draws"] += 1
        else:
            opening["losses"] += 1

        board = game.board()
        node = game
        ply = 0
        while node.variations and ply < max_ply:
            next_node = node.variation(0)
            move = next_node.move
            if move not in board.legal_moves:
                break
            if board.turn == player_color:
                fen_before = board.fen()
                played_san = board.san(move)
                played_uci = move.uci()
                best = engine.analyze(fen_before)
                before_cp = clamp_cp(best.score_cp)
                if played_uci == best.best_uci:
                    loss = 0
                else:
                    board.push(move)
                    after = engine.analyze(board.fen())
                    board.pop()
                    # после нашего хода ход соперника: инвертируем оценку
                    after_cp = -clamp_cp(after.score_cp)
                    loss = max(0, before_cp - after_cp)
                kind = loss_kind(loss)
                opening["lossCpSum"] += loss
                opening["lossCpSamples"] += 1
                if kind in {"inaccuracy", "mistake", "blunder"}:
                    # позиция без счётчиков ходов — для группировки
                    fen_key = " ".join(fen_before.split(" ")[:4])
                    group_key = f"{fen_key}|{played_san}"
                    group = mistake_groups.setdefault(
                        group_key,
                        {
                            "id": f"{_safe_name(username)}-{len(mistake_groups)+1}",
                            "fen": fen_before,
                            "played": played_san,
                            "best": best.best_san,
                            "bestUci": best.best_uci,
                            "lossCp": loss,
                            "kind": kind,
                            "phase": phase_of(ply),
                            "opening": opening_name,
                            "eco": eco,
                            "side": side,
                            "count": 0,
                            "examples": [],
                        },
                    )
                    group["count"] += 1
                    group["lossCp"] = max(group["lossCp"], loss)
                    if kind == "blunder" or (kind == "mistake" and group["kind"] != "blunder"):
                        group["kind"] = kind
                    if len(group["examples"]) < 3:
                        group["examples"].append(
                            {
                                "url": game_meta.get("url"),
                                "played": played_san,
                                "best": best.best_san,
                                "lossCp": loss,
                            }
                        )
            board.push(move)
            node = next_node
            ply += 1

        if analyzed % 10 == 0:
            print(f"  [{username}] проанализировано {analyzed}/{len(selected)}")

    opening_list = []
    for item in openings.values():
        samples = item.pop("lossCpSamples")
        loss_sum = item.pop("lossCpSum")
        item["avgLossCp"] = round(loss_sum / samples) if samples else 0
        opening_list.append(item)
    opening_list.sort(key=lambda row: (-row["count"], -row["avgLossCp"]))

    mistakes = sorted(
        mistake_groups.values(),
        key=lambda row: (-row["count"], -row["lossCp"], row["kind"] != "blunder"),
    )
    # оставляем самые полезные для тренировки
    top_mistakes = mistakes[:40]

    tip_by_kind = {
        "blunder": "Грубая ошибка: сначала найди все шахи, взятия и угрозы, потом сравни с лучшим ходом.",
        "mistake": "Ошибка: позиция ещё держится, но оценка заметно хуже — ищи конкретную тактику или улучшение фигуры.",
        "inaccuracy": "Неточность: ход не проигрывает сразу, но упускает план или активность.",
    }
    for item in top_mistakes:
        item["tip"] = tip_by_kind.get(item["kind"], "")

    return {
        "username": username,
        "analyzedGames": analyzed,
        "downloadedGames": len(games),
        "results": {
            "wins": totals["win"],
            "draws": totals["draw"],
            "losses": totals["loss"],
        },
        "openings": opening_list[:25],
        "mistakes": top_mistakes,
    }


def write_report(players: list[dict], depth: int, max_games: int) -> Path:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engineDepth": depth,
        "maxGamesPerPlayer": max_games,
        "players": players,
    }
    REPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Отчёт: {REPORT_PATH}")
    return REPORT_PATH


def cmd_download(args: argparse.Namespace) -> None:
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    for nick in args.usernames:
        download_player(nick)


def cmd_analyze(args: argparse.Namespace) -> None:
    player_dirs = sorted(path for path in GAMES_DIR.iterdir() if path.is_dir() and (path / "index.json").is_file())
    if args.usernames:
        wanted = {_safe_name(name.lower()) for name in args.usernames}
        player_dirs = [path for path in player_dirs if path.name.lower() in wanted]
    if not player_dirs:
        raise SystemExit("Нет скачанных партий. Сначала: download <ники>")

    engine_path = find_stockfish()
    print(f"Stockfish: {engine_path}")
    engine = Stockfish(engine_path, depth=args.depth)
    try:
        players = [
            analyze_player(path, engine, max_games=args.max_games, max_ply=args.max_ply)
            for path in player_dirs
        ]
    finally:
        engine.close()
    write_report(players, depth=args.depth, max_games=args.max_games)


def cmd_all(args: argparse.Namespace) -> None:
    cmd_download(args)
    cmd_analyze(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Партии chess.com → анализ ошибок")
    sub = parser.add_subparsers(dest="command", required=True)

    p_download = sub.add_parser("download", help="Скачать партии в games/")
    p_download.add_argument("usernames", nargs="+", help="Ники chess.com")
    p_download.set_defaults(func=cmd_download)

    p_analyze = sub.add_parser("analyze", help="Разобрать скачанные партии Stockfish")
    p_analyze.add_argument("usernames", nargs="*", help="Ограничить список игроков")
    p_analyze.add_argument("--depth", type=int, default=12, help="Глубина Stockfish (по умолчанию 12)")
    p_analyze.add_argument("--max-games", type=int, default=60, help="Сколько последних партий на игрока")
    p_analyze.add_argument("--max-ply", type=int, default=40, help="Сколько полуходов анализировать")
    p_analyze.set_defaults(func=cmd_analyze)

    p_all = sub.add_parser("all", help="Скачать и сразу проанализировать")
    p_all.add_argument("usernames", nargs="+", help="Ники chess.com")
    p_all.add_argument("--depth", type=int, default=12)
    p_all.add_argument("--max-games", type=int, default=60)
    p_all.add_argument("--max-ply", type=int, default=40)
    p_all.set_defaults(func=cmd_all)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
