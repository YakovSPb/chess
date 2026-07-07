# ChessTrain — шахматная тренировка

Веб-приложение для тренировки в шахматах: задачи, игра с ботом, тренер DeepSeek, обучение, анализ партий.

## Возможности

- **Задачи** — база Lichess (~6M public domain), фильтр по темам, рейтинг, streak
- **Игра с ботом** — 6 уровней (800–2800 ELO) через Stockfish
- **Тренер** — DeepSeek объясняет ходы на русском
- **Обучение** — интерактивные уроки (дебюты, тактика, эндшпиль)
- **Отчёт по партии** — график eval, accuracy, классификация ходов

## Быстрый старт

### 1. PostgreSQL

```bash
docker-compose up -d postgres
```

PostgreSQL доступен на порту **15432** (если 5432 занят локальным Postgres).

### 2. Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../../.env.example ../../.env
# Добавьте OPENAI_API_KEY в .env
uvicorn app.main:app --reload --port 8000
```

### 3. Импорт задач

```bash
python scripts/import_lichess_puzzles.py --seed-only
# Или полный импорт:
# python scripts/import_lichess_puzzles.py --csv lichess_db_puzzle.csv.zst --max 100000
```

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
```

Откройте http://localhost:5173

## Docker (полный стек)

```bash
cp .env.example .env
docker compose up -d
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для JWT токенов |
| `OPENAI_API_KEY` | API ключ OpenAI для тренера |
| `OPENAI_MODEL` | Модель OpenAI (по умолчанию `gpt-4o-mini`) |
| `CORS_ORIGINS` | Разрешённые origins для CORS |

## Стек

- Frontend: React 19, Vite, TypeScript, Tailwind, chess.js, react-chessboard, Stockfish WASM
- Backend: Python FastAPI, SQLAlchemy, PostgreSQL
- AI: OpenAI API (gpt-4o-mini)

## Документация

- [Архитектура](docs/architecture.md)
- [Функции](docs/features.md)
