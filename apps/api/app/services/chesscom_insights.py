"""План развития по отчёту партий: узкие места и что тренировать."""

from __future__ import annotations

from collections import Counter


TRAINER_HINTS: dict[str, str] = {
    "итальянская": "Откройте в тренажёре «Итальянскую партию»: сначала режим «Учить», потом «Проверка».",
    "жареной печени": "Откройте в тренажёре «Атаку жареной печени».",
    "лондон": "Откройте в тренажёре «Лондонскую систему».",
    "каро": "Откройте в тренажёре «Каро-Канн».",
    "скандинав": "Запомните правило: если чёрные сыграли …d5 — почти всегда берите пешку на d5, а не сразу выводите коня.",
    "испан": "Повторите простую идею испанской: давление на e5 и спокойное развитие без зевков.",
    "филидор": "Против …d6 сначала закончите развитие, не бросайтесь в атаку.",
    "француз": "Против француза держите центр и не тратьте ходы на пустые шахи.",
    "1.e4": "Выберите 2–3 простых ответа на 1.e4 за чёрных и повторяйте их каждый день по 5 минут.",
    "1.d4": "Выберите один ответ на 1.d4 (например …d5) и выучите первые 8 ходов.",
}

KIND_RU = {
    "blunder": "грубая ошибка",
    "mistake": "ошибка",
    "inaccuracy": "неточность",
}

PHASE_WHERE = {
    "opening": "в начале партии",
    "middlegame": "в середине партии",
    "endgame": "в эндшпиле",
}

PHASE_FOCUS = {
    "opening": "Сейчас важнее всего начало партии: первые ходы без зевков.",
    "middlegame": "Сейчас важнее всего середина партии: сначала смотрите шахи, взятия и угрозы.",
    "endgame": "Сейчас важнее всего эндшпиль: не отдавайте фигуры и спокойно доводите партию.",
}


def _win_rate(results: dict) -> float:
    total = results.get("wins", 0) + results.get("draws", 0) + results.get("losses", 0)
    if total <= 0:
        return 0.0
    return (results.get("wins", 0) + 0.5 * results.get("draws", 0)) / total


def _opening_score(opening: dict) -> float:
    total = opening.get("count") or 0
    if total <= 0:
        return 0.5
    return (opening.get("wins", 0) + 0.5 * opening.get("draws", 0)) / total


def _trainer_hint(name: str) -> str | None:
    lower = name.lower()
    for key, hint in TRAINER_HINTS.items():
        if key in lower:
            return hint
    return None


def _phase_focus(mistakes: list[dict]) -> str:
    weights = Counter()
    for item in mistakes:
        weights[item.get("phase") or "middlegame"] += max(1, int(item.get("count") or 1)) * (
            3 if item.get("kind") == "blunder" else 2 if item.get("kind") == "mistake" else 1
        )
    if not weights:
        return "middlegame"
    return weights.most_common(1)[0][0]


def _opening_label(opening: dict) -> str:
    name = str(opening.get("name") or "дебют")
    if name in {"1.e4", "1.d4"}:
        if opening.get("side") == "black":
            return f"ответы на {name} чёрными"
        return f"начало {name} белыми"
    side = "белыми" if opening.get("side") == "white" else "чёрными"
    return f"{name} {side}"


def _plural(n: int, one: str, few: str, many: str) -> str:
    value = abs(n) % 100
    if 11 <= value <= 14:
        return f"{n} {many}"
    last = value % 10
    if last == 1:
        return f"{n} {one}"
    if 2 <= last <= 4:
        return f"{n} {few}"
    return f"{n} {many}"


def _times_word(count: int) -> str:
    return _plural(count, "раз", "раза", "раз")


def _result_sentence(analyzed: int, results: dict) -> str:
    wins = int(results.get("wins", 0))
    draws = int(results.get("draws", 0))
    losses = int(results.get("losses", 0))
    chunks = []
    if wins:
        chunks.append(_plural(wins, "победа", "победы", "побед"))
    if draws:
        chunks.append(_plural(draws, "ничья", "ничьи", "ничьих"))
    if losses:
        chunks.append(_plural(losses, "поражение", "поражения", "поражений"))
    if not chunks:
        return f"Разобрано партий: {analyzed}."
    return f"Разобрано {analyzed} последних партий: " + ", ".join(chunks) + "."


def _opening_in_phrase(name: str) -> str:
    raw = str(name or "дебют")
    if raw in {"1.e4", "1.d4"}:
        return f"после хода {raw}"
    return f"в дебюте «{raw}»"


def _weak_openings_sentence(openings: list[dict]) -> str:
    if not openings:
        return ""
    if len(openings) == 1:
        return f"Хуже всего получается: {_opening_label(openings[0])}."
    return (
        f"Хуже всего два места: {_opening_label(openings[0])} "
        f"и {_opening_label(openings[1])}."
    )


def build_player_plan(player: dict) -> dict:
    results = player.get("results") or {}
    openings = list(player.get("openings") or [])
    mistakes = list(player.get("mistakes") or [])
    analyzed = int(player.get("analyzedGames") or 0)
    username = player.get("username") or "Игрок"
    rate = _win_rate(results)

    kind_counts = Counter()
    for item in mistakes:
        kind_counts[item.get("kind") or "inaccuracy"] += int(item.get("count") or 1)

    phase = _phase_focus(mistakes)

    weak_openings = sorted(
        [o for o in openings if (o.get("count") or 0) >= 3],
        key=lambda o: (_opening_score(o), -o.get("avgLossCp", 0), -o.get("count", 0)),
    )[:3]
    strong_openings = sorted(
        [o for o in openings if (o.get("count") or 0) >= 3],
        key=lambda o: (-_opening_score(o), o.get("avgLossCp", 0)),
    )[:2]

    top_mistakes = sorted(
        mistakes,
        key=lambda m: (-int(m.get("count") or 0), -int(m.get("lossCp") or 0)),
    )[:5]

    priorities: list[dict] = []

    if top_mistakes:
        first = top_mistakes[0]
        count = int(first.get("count") or 1)
        played = first.get("played")
        best = first.get("best")
        opening_name = first.get("opening") or "дебюте"
        priorities.append(
            {
                "title": f"Не ходите {played} — лучше {best}",
                "why": (
                    f"Так вы ошибались {_times_word(count)} {_opening_in_phrase(str(opening_name))}. "
                    f"Это {KIND_RU.get(str(first.get('kind')), 'ошибка')}."
                ),
                "action": (
                    f"Откройте тренировку и запомните: в этой позиции ход {best}, а не {played}."
                ),
                "mistakeIds": [first.get("id")] if first.get("id") else [],
                "tag": "mistake",
            }
        )

    for opening in weak_openings[:2]:
        side = "белыми" if opening.get("side") == "white" else "чёрными"
        wins = int(opening.get("wins") or 0)
        losses = int(opening.get("losses") or 0)
        count = int(opening.get("count") or 0)
        hint = _trainer_hint(str(opening.get("name") or ""))
        related = [
            m.get("id")
            for m in top_mistakes
            if m.get("opening") == opening.get("name") and m.get("id")
        ][:3]
        priorities.append(
            {
                "title": f"Подтянуть {_opening_label(opening)}",
                "why": (
                    f"Из {count} партий {side}: побед {wins}, поражений {losses}. "
                    "Здесь вы сейчас теряете больше всего очков."
                ),
                "action": hint
                or (
                    f"Выучите наизусть первые ходы: {opening.get('keyMoves')}. "
                    "Потом проверьте себя без подсказки."
                ),
                "mistakeIds": related,
                "tag": "opening",
            }
        )

    if kind_counts.get("blunder", 0) >= 3 or (kind_counts.get("blunder", 0) and phase == "opening"):
        blunder_ids = [m.get("id") for m in mistakes if m.get("kind") == "blunder" and m.get("id")][:4]
        priorities.append(
            {
                "title": "Перед каждым ходом: шах, взятие, угроза",
                "why": (
                    f"Грубых ошибок много ({kind_counts.get('blunder', 0)}). "
                    f"Чаще они случаются {PHASE_WHERE.get(phase, 'в партии')}."
                ),
                "action": "Перед ходом остановитесь на 3 секунды и спросите: мне есть шах? что бьётся? что угрожает ферзю и королю?",
                "mistakeIds": blunder_ids,
                "tag": "habit",
            }
        )
    elif phase == "opening" and kind_counts:
        priorities.append(
            {
                "title": "Сначала спокойно развить фигуры",
                "why": "Много ошибок именно в начале партии.",
                "action": "Не выводите ферзя слишком рано. Сначала кони и слоны, потом рокировка — и только затем атака.",
                "mistakeIds": [
                    m.get("id") for m in top_mistakes if m.get("phase") == "opening" and m.get("id")
                ][:3],
                "tag": "habit",
            }
        )

    seen: set[str] = set()
    unique_priorities: list[dict] = []
    for item in priorities:
        title = item["title"]
        if title in seen:
            continue
        seen.add(title)
        unique_priorities.append(item)
        if len(unique_priorities) >= 4:
            break

    strengths: list[str] = []
    for opening in strong_openings:
        if _opening_score(opening) >= 0.55:
            wins = int(opening.get("wins") or 0)
            count = int(opening.get("count") or 0)
            strengths.append(
                f"Хорошо идёт {_opening_label(opening)}: {wins} побед из {count}. Можно оставить как основной вариант."
            )
    if rate >= 0.55 and analyzed >= 10:
        strengths.append("В целом партии идут уверенно — главное не повторять одни и те же ошибки.")
    if not strengths:
        strengths.append("Пока явных сильных сторон мало. Сначала закройте 1–2 слабых места ниже.")

    if rate >= 0.55:
        headline = f"{username}: играете неплохо — уберите повторяющиеся ошибки"
    elif rate >= 0.4:
        headline = f"{username}: почти поровну побед и поражений. Решает внимательность"
    else:
        headline = f"{username}: сначала стабильный дебют и проверка угроз"

    summary_lines = [_result_sentence(analyzed, results)]
    weak_sentence = _weak_openings_sentence(weak_openings[:2])
    if weak_sentence:
        summary_lines.append(weak_sentence)
    if top_mistakes:
        m0 = top_mistakes[0]
        summary_lines.append(
            f"Самая частая ошибка: ходите {m0.get('played')}, а лучше было {m0.get('best')} "
            f"{_opening_in_phrase(str(m0.get('opening')))} ({_times_word(int(m0.get('count') or 1))})."
        )
    summary_lines.append(PHASE_FOCUS.get(phase, "Сейчас важнее всего разбирать свои ошибки на доске."))

    weekly: list[str] = []
    if top_mistakes:
        m0 = top_mistakes[0]
        weekly.append(
            f"3 раза по 10 минут: тренируйте позицию, где лучше ход {m0.get('best')}, а не {m0.get('played')}."
        )
    if weak_openings:
        weekly.append(
            f"Выучите 8 первых ходов для {_opening_label(weak_openings[0])} и проверьте себя без подсказки."
        )
    weekly.append("После каждой партии онлайн разберите один зевок: почему лучший ход был сильнее.")
    if kind_counts.get("blunder", 0) >= 2:
        weekly.append("В каждой партии перед ходом: шах / взятие / угроза.")

    return {
        "headline": headline,
        "summary": " ".join(summary_lines),
        "priorities": unique_priorities,
        "strengths": strengths[:3],
        "weeklyPlan": weekly[:4],
        "focusPhase": phase,
        "winRate": round(rate, 3),
    }


def attach_plans(report: dict | None) -> dict | None:
    if not report:
        return report
    players = []
    for player in report.get("players") or []:
        enriched = dict(player)
        enriched["plan"] = build_player_plan(player)
        players.append(enriched)
    return {**report, "players": players}
