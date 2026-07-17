"""Знаменитые партии чемпионатов и классики для интерактивного прохождения."""

from __future__ import annotations

from typing import Any


def _build_steps(
    moves: list[str],
    player_color: str,
    notes: dict[int, str] | None = None,
) -> list[dict[str, str]]:
    notes = notes or {}
    steps: list[dict[str, str]] = []
    for i, move in enumerate(moves):
        side = "white" if i % 2 == 0 else "black"
        actor = "user" if side == player_color else "bot"
        explanation = notes.get(i) or f"Ход партии: {move}"
        steps.append({"actor": actor, "expected_move": move, "explanation": explanation})
    return steps


def _game(
    *,
    title: str,
    event: str,
    year: int,
    white: str,
    black: str,
    result: str,
    player_color: str,
    description: str,
    popularity: int,
    moves: list[str],
    notes: dict[int, str] | None = None,
) -> dict[str, Any]:
    winner = "draw"
    if result == "1-0":
        winner = "white"
    elif result == "0-1":
        winner = "black"

    winner_name = {"white": white, "black": black, "draw": None}[winner]
    loser_name = None
    if winner == "white":
        loser_name = black
    elif winner == "black":
        loser_name = white

    return {
        "title": title,
        "event": event,
        "year": year,
        "white": white,
        "black": black,
        "result": result,
        "winner": winner,
        "winner_name": winner_name,
        "loser_name": loser_name,
        "player_color": player_color,
        "description": description,
        "popularity": popularity,
        "steps": _build_steps(moves, player_color, notes),
    }


CHAMPIONSHIPS: list[dict[str, Any]] = [
    _game(
        title="Морфи — Союзники (Опера)",
        event="Париж, Опера",
        year=1858,
        white="Морфи",
        black="Герцог и граф",
        result="1-0",
        player_color="white",
        popularity=100,
        description="Легендарная «Оперная партия»: Морфи жертвует ферзя и ставит мат ладьёй.",
        moves="e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#".split(),
        notes={
            18: "Жертва коня — вскрытие линии.",
            30: "Знаменитая жертва ферзя!",
            32: "Мат ладьёй на последней горизонтали.",
        },
    ),
    _game(
        title="Андерсен — Кизерицкий (Бессмертная)",
        event="Лондон",
        year=1851,
        white="Андерсен",
        black="Кизерицкий",
        result="1-0",
        player_color="white",
        popularity=98,
        description="«Бессмертная партия»: серия жертв и мат двумя слонами.",
        moves="e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#".split(),
        notes={
            34: "Жертва слона — король в матовой сети.",
            42: "Жертва ферзя ради мата.",
            44: "Мат слоном.",
        },
    ),
    _game(
        title="Андерсен — Дюфрень (Вечнозелёная)",
        event="Берлин",
        year=1852,
        white="Андерсен",
        black="Дюфрень",
        result="1-0",
        player_color="white",
        popularity=95,
        description="«Вечнозелёная партия»: блестящая комбинация с жертвой ферзя.",
        moves="e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#".split(),
        notes={
            36: "Жертва ладьи — начало финала.",
            38: "Жертва ферзя!",
            44: "Мат слоном.",
        },
    ),
    _game(
        title="Берн — Фишер (Партия века)",
        event="Нью-Йорк",
        year=1956,
        white="Берн",
        black="Фишер",
        result="0-1",
        player_color="black",
        popularity=94,
        description="«Партия века»: 13-летний Фишер жертвует ферзя и выигрывает у Дональда Берна.",
        moves="Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#".split(),
        notes={
            28: "Жертва ферзя — классика Фишера.",
            70: "Мат ладьёй.",
        },
    ),
    _game(
        title="Фишер — Спасский (партия 6)",
        event="Чемпионат мира",
        year=1972,
        white="Фишер",
        black="Спасский",
        result="1-0",
        player_color="white",
        popularity=99,
        description="Финал ЧМ 1972 в Рейкьявике. Фишер белыми разгромил Спасского в «ферзевом гамбите».",
        moves="c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 Nxe6 fxe6 e4 d4 f4 Qe7 e5 Rb8 Bc4 Kh8 Qh3 Nf8 b3 a5 f5 exf5 Rxf5 Nh7 Rcf1 Qd8 Qg3 Re7 h4 Rbb7 e6 Rbc7 Qe5 Qe8 a4 Qd8 R1f2 Qe8 R2f3 Qd8 Bd3 Qe8 Qe4 Nf6 Rxf6 gxf6 Rxf6 Kg8 Bc4 Kh8 Qf4".split(),
        notes={
            0: "Необычный для Фишера 1.c4 — сюрприз для Спасского.",
            72: "Жертва качества — решающий удар.",
            80: "Спасский сдался: позиция безнадёжна.",
        },
    ),
    _game(
        title="Стейниц — Барделебен",
        event="Гастингс",
        year=1895,
        white="Стейниц",
        black="Барделебен",
        result="1-0",
        player_color="white",
        popularity=90,
        description="Знаменитая партия Стейница: серия шахов ладьёй, после которой соперник ушёл, не сдавшись.",
        moves="e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 d5 exd5 Nxd5 O-O Be6 Bg5 Be7 Bxd5 Bxd5 Nxd5 Qxd5 Bxe7 Nxe7 Re1 f6 Qe2 Qd7 Rac1 c6 d5 cxd5 Nd4 Kf7 Ne6 Rhc8 Qg4 g6 Ng5+ Ke8 Rxe7+ Kf8 Rf7+ Kg8 Rg7+ Kh8 Rxh7+".split(),
        notes={
            40: "Начало знаменитой серии шахов ладьёй.",
            48: "Барделебен покинул зал — партия проиграна.",
        },
    ),
]
