import hashlib
import logging
from typing import Literal

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CoachCache

logger = logging.getLogger(__name__)

LlmError = Literal["no_key", "rate_limit", "network", "invalid", "region"]


def _ai_status_message(error: LlmError | None) -> str:
    if error == "no_key":
        return "AI не настроен: добавьте OPENAI_API_KEY в .env."
    if error == "rate_limit":
        return "Лимит запросов OpenAI (429). Подождите минуту и попробуйте снова."
    if error == "network":
        return "Нет связи с OpenAI. Проверьте интернет и OPENAI_API_URL."
    if error == "region":
        return (
            "OpenAI недоступен в вашем регионе. "
            "Используйте VPN или другой API (например, DeepSeek напрямую)."
        )
    return "AI временно недоступен — показана подсказка от движка."

CHAT_SYSTEM_PROMPT = """Ты шахматный помощник ChessTrain. Игрок задаёт вопросы о текущей странице приложения и позиции на доске.
Отвечай на русском языке, просто и по делу, для игрока рейтинга {user_rating}.
Если передан FEN — опирайся на позицию. Если FEN нет — отвечай по описанию страницы и контекста.
Не выдумывай оценку движка и точные варианты, если их нет в контексте.
Обычно достаточно 2–6 предложений."""

SYSTEM_PROMPT = """Ты шахматный тренер. Получаешь FEN, последний ход, eval от Stockfish, лучшую линию.
Объясняй простым русским языком для игрока рейтинга {user_rating}.
Не придумывай ходы — используй только данные движка.
Подсказки не должны называть точный ход, если уровень подсказки < 3.
Отвечай кратко, 2-4 предложения."""


def _uci_pretty(uci: str) -> str:
    uci = uci.strip().lower()
    if len(uci) >= 4:
        promo = f"={uci[4]}" if len(uci) > 4 else ""
        return f"{uci[:2]}→{uci[2:4]}{promo}"
    return uci


def _fallback_hint(
    eval_cp: float | None,
    best_line: list[str] | None,
    hint_level: int,
    error: LlmError | None = None,
) -> str:
    parts: list[str] = []
    if eval_cp is not None:
        pawn = eval_cp / 100
        if pawn > 1:
            parts.append(f"У вас преимущество около +{pawn:.1f} пешки.")
        elif pawn < -1:
            parts.append(f"Позиция трудная: −{abs(pawn):.1f} пешки.")
        else:
            parts.append("Позиция примерно равная.")

    best = (best_line or [None])[0]
    if hint_level >= 3 and best:
        parts.append(f"Лучший ход по Stockfish: {_uci_pretty(best)}.")
    elif hint_level >= 2 and best_line:
        preview = ", ".join(_uci_pretty(m) for m in best_line[:3])
        parts.append(f"Смотрите линию: {preview}.")
    else:
        parts.append("Оцените угрозы соперника и активность своих фигур.")

    parts.append(_ai_status_message(error))
    return " ".join(parts)


def _fallback_explain(
    move_san: str,
    eval_before: float,
    eval_after: float,
    best_move: str | None,
    error: LlmError | None = None,
) -> str:
    cpl = abs(eval_after - eval_before)
    if cpl < 30:
        quality = "Хороший ход"
    elif cpl < 100:
        quality = "Неточность"
    elif cpl < 300:
        quality = "Ошибка"
    else:
        quality = "Грубая ошибка"

    parts = [f"{quality}: {move_san}. Потеря оценки {cpl:.0f} cp."]
    if best_move and cpl >= 30:
        parts.append(f"Лучше было: {_uci_pretty(best_move)}.")
    parts.append(_ai_status_message(error))
    return " ".join(parts)


class DeepSeekService:
    def __init__(self, db: Session):
        self.db = db

    def _cache_key(self, prefix: str, data: str) -> str:
        return hashlib.sha256(f"{prefix}:{data}".encode()).hexdigest()

    def _get_cached(self, key: str) -> str | None:
        cached = self.db.query(CoachCache).filter(CoachCache.cache_key == key).first()
        return cached.response if cached else None

    def _set_cache(self, key: str, response: str) -> None:
        existing = self.db.query(CoachCache).filter(CoachCache.cache_key == key).first()
        if existing:
            existing.response = response
        else:
            self.db.add(CoachCache(cache_key=key, response=response))
        self.db.commit()

    async def _complete(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 500,
    ) -> tuple[str | None, LlmError | None]:
        if not settings.openai_api_key:
            logger.warning("OpenAI API key is not configured")
            return None, "no_key"

        base_url = settings.openai_api_url.rstrip("/")
        model = settings.llm_model
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                logger.info("OpenAI ok: %s", model)
                return content, None
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                body = exc.response.text[:300]
                logger.warning("OpenAI %s HTTP %s: %s", model, status, body)
                if status == 429:
                    return None, "rate_limit"
                if status == 403 and "unsupported_country_region_territory" in body:
                    return None, "region"
                return None, "invalid"
            except httpx.RequestError as exc:
                logger.warning("OpenAI %s request failed: %s", model, exc)
                return None, "network"
            except (KeyError, IndexError, TypeError) as exc:
                logger.warning("OpenAI %s invalid response: %s", model, exc)
                return None, "invalid"

    async def _call_api(self, system: str, user_message: str) -> tuple[str | None, LlmError | None]:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]
        return await self._complete(messages, max_tokens=500)

    async def _call_api_with_history(
        self,
        system: str,
        history: list[dict[str, str]],
        user_message: str,
    ) -> tuple[str | None, LlmError | None]:
        messages: list[dict[str, str]] = [{"role": "system", "content": system}]
        for item in history[-8:]:
            role = item.get("role")
            content = item.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})
        return await self._complete(messages, max_tokens=600)

    async def get_hint(
        self,
        fen: str,
        last_move: str | None,
        eval_cp: float | None,
        best_line: list[str] | None,
        hint_level: int,
        user_rating: int,
    ) -> str:
        cache_data = f"{fen}:{last_move}:{eval_cp}:{hint_level}"
        cache_key = self._cache_key("hint", cache_data)
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        system = SYSTEM_PROMPT.format(user_rating=user_rating)
        user_msg = f"""Позиция FEN: {fen}
Последний ход: {last_move or 'начальная позиция'}
Оценка Stockfish: {eval_cp} centipawns
Лучшая линия: {' '.join(best_line or [])}
Уровень подсказки: {hint_level} (1=общая идея, 2=направление, 3=конкретный ход)
Дай подсказку игроку."""

        result, error = await self._call_api(system, user_msg)
        if result is None:
            return _fallback_hint(eval_cp, best_line, hint_level, error)

        self._set_cache(cache_key, result)
        return result

    async def explain_move(
        self,
        fen: str,
        move_san: str,
        eval_before: float,
        eval_after: float,
        best_move: str | None,
        best_line: list[str] | None,
        user_rating: int,
    ) -> str:
        cache_data = f"{fen}:{move_san}:{eval_before}:{eval_after}"
        cache_key = self._cache_key("explain", cache_data)
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        system = SYSTEM_PROMPT.format(user_rating=user_rating)
        cpl = abs(eval_after - eval_before)
        user_msg = f"""Позиция после хода FEN: {fen}
Сделанный ход: {move_san}
Оценка до хода: {eval_before} cp
Оценка после хода: {eval_after} cp
Потеря: {cpl:.0f} cp
Лучший ход был: {best_move or 'неизвестно'}
Лучшая линия: {' '.join(best_line or [])}
Объясни, почему этот ход хороший или плохой."""

        result, error = await self._call_api(system, user_msg)
        if result is None:
            return _fallback_explain(move_san, eval_before, eval_after, best_move, error)

        self._set_cache(cache_key, result)
        return result

    async def summarize_game(
        self,
        pgn: str,
        analysis_summary: str,
        user_rating: int,
    ) -> str:
        cache_key = self._cache_key("summary", pgn[:500])
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        system = SYSTEM_PROMPT.format(user_rating=user_rating)
        user_msg = f"""Партия PGN:
{pgn}

Анализ Stockfish:
{analysis_summary}

Дай краткое резюме партии: главные проблемы, что улучшить, 3-5 предложений."""

        result, error = await self._call_api(system, user_msg)
        if result is None:
            suffix = _ai_status_message(error)
            if analysis_summary.strip():
                return f"Краткий разбор по движку:\n{analysis_summary}\n\n({suffix})"
            return suffix

        self._set_cache(cache_key, result)
        return result

    async def explain_lesson_step(
        self,
        fen: str,
        expected_move: str,
        explanation: str,
        user_rating: int,
    ) -> str:
        system = SYSTEM_PROMPT.format(user_rating=user_rating)
        user_msg = f"""Урок. Позиция FEN: {fen}
Правильный ход: {expected_move}
Базовое объяснение: {explanation}
Расширь объяснение для ученика, добавь тактическую идею."""

        result, error = await self._call_api(system, user_msg)
        if result is None:
            return f"{explanation}\n\nПравильный ход: {_uci_pretty(expected_move)}. ({_ai_status_message(error)})"
        return result

    async def chat(
        self,
        message: str,
        page: str,
        fen: str | None,
        details: str | None,
        player_color: str | None,
        history: list[dict[str, str]],
        user_rating: int,
    ) -> str:
        system = CHAT_SYSTEM_PROMPT.format(user_rating=user_rating)
        context_parts = [f"Страница: {page or 'неизвестно'}"]
        if player_color in ("white", "black"):
            color_label = "белыми" if player_color == "white" else "чёрными"
            context_parts.append(f"Игрок играет {color_label}")
        if details:
            context_parts.append(f"Детали: {details}")
        if fen:
            context_parts.append(f"Позиция FEN: {fen}")
        else:
            context_parts.append("Позиция на доске сейчас не передана.")

        user_msg = "\n".join(context_parts) + f"\n\nВопрос игрока: {message}"

        result, error = await self._call_api_with_history(system, history, user_msg)
        if result is None:
            return _ai_status_message(error)
        return result
