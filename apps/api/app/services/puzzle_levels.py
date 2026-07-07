PUZZLE_LEVELS = [
    {"id": "easy", "label": "Лёгкий", "min_rating": 800, "max_rating": 1099},
    {"id": "medium", "label": "Средний", "min_rating": 1100, "max_rating": 1399},
    {"id": "hard", "label": "Сложный", "min_rating": 1400, "max_rating": 1699},
    {"id": "expert", "label": "Эксперт", "min_rating": 1700, "max_rating": 3000},
]


def get_level_for_rating(rating: int) -> str:
    for level in PUZZLE_LEVELS:
        if level["min_rating"] <= rating <= level["max_rating"]:
            return level["id"]
    return PUZZLE_LEVELS[-1]["id"]


def get_level(level_id: str) -> dict | None:
    return next((l for l in PUZZLE_LEVELS if l["id"] == level_id), None)
