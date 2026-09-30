# Анализ партий chess.com

Пароль не нужен — публичный API по нику. Загрузка и разбор запускаются **из браузера** на странице **Мои партии**.

## Онлайн (основной способ)

1. Поднимите API (нужны Postgres + Stockfish):

```bash
# вариант: локально без Docker API-процесса, если БД уже на :15432
cd apps/api
../api/.venv/bin/uvicorn app.main:app --reload --port 8000
# или из корня:
apps/api/.venv/bin/uvicorn app.main:app --app-dir apps/api --reload --port 8000
```

Удобнее через docker-compose (монтирует `games/`, `tools/`, отчёт):

```bash
docker compose up -d
```

2. Фронт: `cd apps/web && npm run dev`
3. Откройте http://localhost:5173/games  
4. Ники → **Скачать и разобрать** → прогресс → отчёт и тренировка ошибок.

API:

- `POST /chesscom/sync` — старт `{ usernames, depth, max_games }`
- `GET /chesscom/jobs/{id}` — прогресс
- `GET /chesscom/report` — готовый отчёт

Прокси Vite: `/api` → `http://localhost:8000`.

## CLI (если нужно без UI)

```bash
apps/api/.venv/bin/python scripts/chesscom_games.py all Yakov_Msk7 misha5161741
```

PGN: `games/<ник>/`. Отчёт: `apps/web/public/games-report.json`.
