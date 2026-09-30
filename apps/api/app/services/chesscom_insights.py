"""План развития по отчёту партий: узкие места и что тренировать."""

from __future__ import annotations

from collections import Counter


TRAINER_HINTS: dict[str, str] = {
    "итальянская": "В тренажёре: дебют «Итальянская партия» (учить + проверка).",
    "жареной печени": "В тренажёре: «Атака жареной печени».",
    "лондон": "В тренажёре: «Лондонская система».",
    "каро": "В тренажёре: «Каро-Канн».",
    "скандинав": "Добавьте линию против 1…d5: сначала берите на d5, не развивайте коня вслепую.",
    "испан": "Разберите базовые идеи испанской: давление на e5 и развитие без зевков.",
    "филидор": "Против …d6 не бросайтесь в атаку — сначала закончите развитие.",
    "француз": "Против француза держите центр и не отдавайте темпы шахами.",
    "1.e4": "Соберите 2–3 надёжных ответа на 1.e4 за чёрных и повторяйте их.",
    "1.d4": "Выберите один ответ на 1.d4 (например, …d5) и закрепите первые 8 ходов.",
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
    phase_ru = {"opening": "дебюте", "middlegame": "миттельшпиле", "endgame": "эндшпиле"}.get(phase, phase)

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
        priorities.append(
            {
                "title": f"Частая ошибка: {first.get('played')} вместо {first.get('best')}",
                "why": (
                    f"Повторялось {first.get('count')}× в «{first.get('opening')}» "
                    f"({first.get('kind')}, −{first.get('lossCp')} cp)."
                ),
                "action": first.get("tip")
                or "Разберите позицию на доске и закрепите лучший ход в режиме тренировки.",
                "mistakeIds": [first.get("id")] if first.get("id") else [],
                "tag": "mistake",
            }
        )

    for opening in weak_openings[:2]:
        side = "белыми" if opening.get("side") == "white" else "чёрными"
        score = _opening_score(opening)
        hint = _trainer_hint(str(opening.get("name") or ""))
        related = [
            m.get("id")
            for m in top_mistakes
            if m.get("opening") == opening.get("name") and m.get("id")
        ][:3]
        priorities.append(
            {
                "title": f"Подтянуть дебют: {opening.get('name')} ({side})",
                "why": (
                    f"{opening.get('count')} партий, результат "
                    f"{opening.get('wins')}+ {opening.get('draws')}= {opening.get('losses')}− "
                    f"(успех {score:.0%}), средняя потеря {opening.get('avgLossCp')} cp."
                ),
                "action": hint
                or f"Выучите первые 6–8 ходов линии «{opening.get('keyMoves')}» и проверяйте себя без подсказок.",
                "mistakeIds": related,
                "tag": "opening",
            }
        )

    if kind_counts.get("blunder", 0) >= 3 or (kind_counts.get("blunder", 0) and phase == "opening"):
        blunder_ids = [m.get("id") for m in mistakes if m.get("kind") == "blunder" and m.get("id")][:4]
        priorities.append(
            {
                "title": "Антизевок: шах / взятие / угроза перед каждым ходом",
                "why": f"В выборке {kind_counts.get('blunder', 0)} повторов грубых ошибок, чаще в {phase_ru}.",
                "action": "Перед ходом 3 секунды: есть ли шах? что бьётся? что угрожает ферзю/королю?",
                "mistakeIds": blunder_ids,
                "tag": "habit",
            }
        )
    elif phase == "opening" and kind_counts:
        priorities.append(
            {
                "title": "Стабилизировать первые 10 ходов",
                "why": f"Основная масса потерь приходится на {phase_ru}.",
                "action": "Не выводите ферзя рано и завершайте развитие (кони, слоны, рокировка) до атаки.",
                "mistakeIds": [m.get("id") for m in top_mistakes if m.get("phase") == "opening" and m.get("id")][:3],
                "tag": "habit",
            }
        )

    # уникализируем по title, максимум 4
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
            side = "белыми" if opening.get("side") == "white" else "чёрными"
            strengths.append(
                f"{opening.get('name')} {side}: {opening.get('wins')}+ из {opening.get('count')} — оставляйте как основной репертуар."
            )
    if rate >= 0.55 and analyzed >= 10:
        strengths.append(f"Общий результат по выборке уверенный: успех {rate:.0%} в {analyzed} партиях.")
    if not strengths:
        strengths.append("Пока мало устойчивых плюсов в выборке — сначала закройте 1–2 слабых дебюта.")

    if rate >= 0.55:
        headline = f"{username}: база есть, режьте повторяющиеся ошибки"
    elif rate >= 0.4:
        headline = f"{username}: равная борьба — выиграет тот, кто меньше зевает в знакомых схемах"
    else:
        headline = f"{username}: приоритет — стабильный дебют и проверка угроз"

    summary_parts = [
        f"По последним {analyzed} партиям успех ≈ {rate:.0%} "
        f"({results.get('wins', 0)}+ {results.get('draws', 0)}= {results.get('losses', 0)}−).",
    ]
    if weak_openings:
        names = ", ".join(str(o.get("name")) for o in weak_openings[:2])
        summary_parts.append(f"Слабее всего идут: {names}.")
    if top_mistakes:
        m0 = top_mistakes[0]
        summary_parts.append(
            f"Самый частый сбой: {m0.get('played')} вместо {m0.get('best')} в «{m0.get('opening')}»."
        )
    summary_parts.append(f"Главный фокус сейчас — {phase_ru}.")

    weekly: list[str] = []
    if unique_priorities:
        weekly.append(f"3 раза по 10 минут: тренировка ошибки «{unique_priorities[0]['title'].replace('Частая ошибка: ', '')}».")
    if weak_openings:
        weekly.append(
            f"Выучить наизусть 8 ходов за слабую сторону в «{weak_openings[0].get('name')}», затем режим проверки."
        )
    weekly.append("После каждой онлайн-партии: один зевок разобрать на доске (почему лучший ход лучше).")
    if kind_counts.get("blunder", 0) >= 2:
        weekly.append("В блице перед ходом ритуал: шах / взятие / угроза.")

    return {
        "headline": headline,
        "summary": " ".join(summary_parts),
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
