"""Most popular opening moves via Lichess Opening Explorer (optional token)."""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

LICHESS_EXPLORER = "https://explorer.lichess.org/lichess"
MASTERS_EXPLORER = "https://explorer.lichess.org/masters"
MIN_GAMES = 8


def _total_games(move: dict) -> int:
    return int(move.get("white", 0)) + int(move.get("draws", 0)) + int(move.get("black", 0))


def _pick_most_common(moves: list[dict]) -> dict | None:
    if not moves:
        return None
    best = max(moves, key=_total_games)
    if _total_games(best) < MIN_GAMES:
        return None
    return best


async def get_most_common_move(fen: str) -> dict | None:
    """
    Самый частый ход в позиции (Lichess / masters).

    Нужен LICHESS_API_TOKEN — без токена explorer недоступен (с 2026).
    """
    token = (settings.lichess_api_token or "").strip()
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}"}
    sources: list[tuple[str, dict[str, str]]] = [
        (
            LICHESS_EXPLORER,
            {
                "variant": "standard",
                "speeds": "blitz,rapid,classical",
                "ratings": "2000,2200,2500",
                "fen": fen,
            },
        ),
        (MASTERS_EXPLORER, {"fen": fen}),
    ]

    for url, params in sources:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
            moves = data.get("moves") or []
            if not isinstance(moves, list):
                continue
            best = _pick_most_common(moves)
            if best and best.get("uci"):
                return {
                    "uci": best["uci"],
                    "san": best.get("san") or "",
                    "games": _total_games(best),
                    "source": "lichess" if url.endswith("/lichess") else "masters",
                }
        except Exception as exc:
            logger.warning("Opening explorer failed for %s: %s", url, exc)
            continue

    return None
