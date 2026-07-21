# Архитектура ChessTrain

## Обзор

ChessTrain — веб-приложение для шахматной тренировки (chess.com-подобное).

```
Frontend (React)  →  API (FastAPI)  →  PostgreSQL
       ↓                    ↓
 Stockfish WASM      OpenAI API
   (анализ/бот)        (тренер)
```

## Принцип разделения

- **Stockfish** — сила бота, оценка позиций, классификация ходов
- **OpenAI** — объяснения на русском (не генерирует ходы)

## Структура monorepo

```
chess/
├── apps/web/          React + Vite + TypeScript
├── apps/api/          FastAPI + SQLAlchemy
├── packages/shared/   Общие типы
├── scripts/           Импорт задач Lichess
└── docs/              Документация
```

## Модули

| Модуль | Описание |
|--------|----------|
| Задачи | Lichess puzzles, рейтинг Glicko, темы |
| Игра с ботом | Stockfish UCI_Elo 800–2800 |
| Тренер | OpenAI + Stockfish подсказки |
| Обучение | Интерактивные уроки (дебюты, тактика, эндшпиль) |
| Учёба | 100 шахматных утверждений с 3 примерами-задачами каждое |
| Чемпионаты | Знаменитые партии ЧМ: прохождение всей линии |
| Отчёт | Eval graph, accuracy, классификация ходов |

## API

- `POST /auth/register`, `/auth/login`
- `GET/POST/PATCH /games`
- `GET /puzzles/next`, `POST /puzzles/{id}/solve`
- `POST /coach/hint`, `/coach/explain-move`, `/coach/summarize-game`
- `GET /openings`, `/openings/{id}`, `POST /openings/{id}/progress`
- `GET /openings/explorer?fen=` — самый частый ход (нужен `LICHESS_API_TOKEN`)
- `GET /championships`, `/championships/{id}`, `POST /championships/{id}/progress`
- `GET /lessons`, `/stats/dashboard`

## База данных

- `users` — аккаунты, puzzle rating, streak
- `games` — PGN, analysis JSON, coach summary
- `puzzles` — Lichess задачи
- `puzzle_attempts` — попытки решения
- `lessons`, `lesson_progress` — обучение
- `coach_cache` — кэш ответов тренера (OpenAI)

## Запуск

```bash
docker-compose up -d postgres
cd apps/api && pip install -r requirements.txt && uvicorn app.main:app --reload
cd apps/web && npm install && npm run dev
python scripts/import_lichess_puzzles.py --seed-only
```
