"""Загрузка партий chess.com и анализ Stockfish."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

ProgressCb = Callable[[str, float, str], None]

USER_AGENT = "ChessTrainerLocal/1.0 (personal training; contact: local)"
ARCHIVE_PAUSE_S = 0.35

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


def repo_root() -> Path:
    if settings.repo_root.strip():
        return Path(settings.repo_root).expanduser().resolve()
    # apps/api/app/services/this.py → parents[4] = monorepo root
    return Path(__file__).resolve().parents[4]


def games_dir() -> Path:
    return repo_root() / "games"


def report_path() -> Path:
    if settings.games_report_path.strip():
        return Path(settings.games_report_path).expanduser().resolve()
    return repo_root() / "apps" / "web" / "public" / "games-report.json"


def _http_get_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip()) or "player"


def find_stockfish() -> Path:
    if settings.stockfish_path.strip():
        path = Path(settings.stockfish_path).expanduser()
        if path.is_file() and os.access(path, os.X_OK):
            return path
    env = os.environ.get("STOCKFISH_PATH")
    if env and Path(env).is_file():
        return Path(env)
    root = repo_root()
    candidates = [
        root / "tools" / "stockfish" / "stockfish-ubuntu-x86-64-avx2",
        root / "tools" / "stockfish",
        Path(shutil.which("stockfish") or ""),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise FileNotFoundError(
        "Stockfish не найден. Положите бинарник в tools/stockfish/ или задайте STOCKFISH_PATH."
    )


def download_player(username: str, on_progress: ProgressCb | None = None) -> Path:
    nick = username.strip().lstrip("@")
    out_dir = games_dir() / safe_name(nick.lower())
    pgn_dir = out_dir / "pgn"
    out_dir.mkdir(parents=True, exist_ok=True)
    pgn_dir.mkdir(parents=True, exist_ok=True)

    archives_url = f"https://api.chess.com/pub/player/{nick}/games/archives"
    try:
        archives = _http_get_json(archives_url)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Не удалось получить архивы для {nick}: HTTP {exc.code}") from exc

    if not isinstance(archives, dict) or "archives" not in archives:
        raise RuntimeError(f"Неожиданный ответ archives для {nick}")

    archive_urls: list[str] = list(archives["archives"])
    all_games: list[dict] = []
    total = max(len(archive_urls), 1)

    for index, archive_url in enumerate(archive_urls, start=1):
        if on_progress:
            on_progress(
                "download",
                5 + 35 * (index - 1) / total,
                f"{nick}: архив {index}/{len(archive_urls)}",
            )
        try:
            payload = _http_get_json(archive_url)
        except urllib.error.HTTPError:
            continue
        games = payload.get("games", []) if isinstance(payload, dict) else []
        for game in games:
            pgn = game.get("pgn") or ""
            if not pgn:
                continue
            end_time = game.get("end_time") or 0
            uuid = game.get("uuid") or game.get("url") or f"{end_time}"
            file_stem = safe_name(str(uuid))[:80]
            pgn_path = pgn_dir / f"{file_stem}.pgn"
            pgn_path.write_text(pgn + ("\n" if not pgn.endswith("\n") else ""), encoding="utf-8")
            white = (game.get("white") or {}).get("username", "")
            black = (game.get("black") or {}).get("username", "")
            side = (
                "white"
                if white.lower() == nick.lower()
                else "black"
                if black.lower() == nick.lower()
                else "?"
            )
            result_raw = (
                (game.get("white") or {}).get("result")
                if side == "white"
                else (game.get("black") or {}).get("result")
            )
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
                    "pgn_file": str(pgn_path.relative_to(repo_root())),
                }
            )
        time.sleep(ARCHIVE_PAUSE_S)

    all_games.sort(key=lambda item: item.get("end_time") or 0, reverse=True)
    (out_dir / "index.json").write_text(
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
    if on_progress:
        on_progress("download", 40, f"{nick}: скачано {len(all_games)} партий")
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
    best_key = ""
    best = ("A00", "Неизвестный дебют")
    for length in range(min(12, len(moves)), 0, -1):
        key = score_line(moves, length)
        if key in ECO_BY_MOVES:
            best_key = key
            best = ECO_BY_MOVES[key]
            break
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


def analyze_player(
    player_dir: Path,
    engine: Stockfish,
    max_games: int,
    max_ply: int,
    on_progress: ProgressCb | None = None,
    progress_base: float = 40,
    progress_span: float = 55,
) -> dict:
    import chess
    import chess.pgn

    index_path = player_dir / "index.json"
    if not index_path.is_file():
        raise FileNotFoundError(f"Нет index.json в {player_dir}")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    username = index["username"]
    games = index.get("games") or []
    selected = games[:max_games]
    root = repo_root()

    openings: dict[str, dict] = {}
    mistake_groups: dict[str, dict] = {}
    totals = Counter()
    analyzed = 0

    for game_meta in selected:
        pgn_rel = game_meta.get("pgn_file")
        if not pgn_rel:
            continue
        pgn_path = root / pgn_rel
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

        if on_progress and (analyzed == 1 or analyzed % 5 == 0 or analyzed == len(selected)):
            frac = analyzed / max(len(selected), 1)
            on_progress(
                "analyze",
                progress_base + progress_span * frac,
                f"{username}: анализ {analyzed}/{len(selected)}",
            )

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
                    after_cp = -clamp_cp(after.score_cp)
                    loss = max(0, before_cp - after_cp)
                kind = loss_kind(loss)
                opening["lossCpSum"] += loss
                opening["lossCpSamples"] += 1
                if kind in {"inaccuracy", "mistake", "blunder"}:
                    fen_key = " ".join(fen_before.split(" ")[:4])
                    group_key = f"{fen_key}|{played_san}"
                    group = mistake_groups.setdefault(
                        group_key,
                        {
                            "id": f"{safe_name(username)}-{len(mistake_groups) + 1}",
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
    from app.services.chesscom_insights import build_player_plan

    enriched = [dict(player, plan=build_player_plan(player)) for player in players]
    path = report_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engineDepth": depth,
        "maxGamesPerPlayer": max_games,
        "players": enriched,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_report() -> dict | None:
    from app.services.chesscom_insights import attach_plans

    path = report_path()
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return attach_plans(raw)


def sync_players(
    usernames: list[str],
    *,
    depth: int = 12,
    max_games: int = 60,
    max_ply: int = 40,
    download: bool = True,
    on_progress: ProgressCb | None = None,
) -> dict:
    """Скачать (опционально) и проанализировать ники. Возвращает отчёт."""
    nicks = [name.strip().lstrip("@") for name in usernames if name.strip()]
    if not nicks:
        raise ValueError("Укажите хотя бы один ник chess.com")

    games_dir().mkdir(parents=True, exist_ok=True)
    player_dirs: list[Path] = []

    if download:
        for index, nick in enumerate(nicks):
            def make_download_cb(player_index: int) -> ProgressCb | None:
                if not on_progress:
                    return None

                def cb(stage: str, progress: float, message: str) -> None:
                    # download_player отдаёт ~5..40 — растягиваем на долю игрока
                    local = min(max((progress - 5) / 35, 0), 1)
                    overall = 2 + 38 * (player_index + local) / max(len(nicks), 1)
                    on_progress(stage, overall, message)

                return cb

            player_dirs.append(download_player(nick, on_progress=make_download_cb(index)))
    else:
        for nick in nicks:
            path = games_dir() / safe_name(nick.lower())
            if not (path / "index.json").is_file():
                raise FileNotFoundError(f"Нет скачанных партий для {nick}")
            player_dirs.append(path)

    if on_progress:
        on_progress("analyze", 42, "Запуск Stockfish…")
    engine = Stockfish(find_stockfish(), depth=depth)
    try:
        players: list[dict] = []
        span = 55 / max(len(player_dirs), 1)
        for index, path in enumerate(player_dirs):
            base = 42 + span * index
            players.append(
                analyze_player(
                    path,
                    engine,
                    max_games=max_games,
                    max_ply=max_ply,
                    on_progress=on_progress,
                    progress_base=base,
                    progress_span=span,
                )
            )
    finally:
        engine.close()

    write_report(players, depth=depth, max_games=max_games)
    if on_progress:
        on_progress("done", 100, "Готово")
    return load_report() or {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engineDepth": depth,
        "maxGamesPerPlayer": max_games,
        "players": players,
    }
