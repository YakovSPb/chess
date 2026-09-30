# Анализ партий chess.com

Публичный API chess.com отдаёт архивы PGN без пароля — достаточно ника.

## Быстрый старт

```bash
# один раз: Stockfish уже лежит в tools/ после setup, либо:
# curl -L ... → tools/stockfish-ubuntu-x86-64-avx2

apps/api/.venv/bin/python scripts/chesscom_games.py all YOUR_NICK SON_NICK --depth 12 --max-games 60
```

Партии: `games/<ник>/pgn/*.pgn` и `games/<ник>/index.json`.  
Отчёт для UI: `apps/web/public/games-report.json`.

Только скачать:

```bash
apps/api/.venv/bin/python scripts/chesscom_games.py download YOUR_NICK SON_NICK
```

Только пересчитать анализ:

```bash
apps/api/.venv/bin/python scripts/chesscom_games.py analyze --depth 12 --max-games 80
```

Свой путь к движку: `STOCKFISH_PATH=/path/to/stockfish ...`.

## Что получается в приложении

Раздел **Мои партии** (`/games`):

- частые дебюты по сторонам и результат
- перечень повторяющихся неточностей / ошибок / зевков
- тренировка: позиция до хода → найти лучший ход Stockfish

Глубина 12 и 60 партий — разумный старт (минуты на игрока). Для точнее: `--depth 15 --max-games 120`.

Ники и PGN в `games/` в git не коммитятся (см. `.gitignore`). Отчёт `games-report.json` тоже локальный.
