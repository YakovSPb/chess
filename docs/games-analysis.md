# Анализ партий chess.com

Пароль не нужен — публичный API по нику.

## Онлайн

На странице **Мои партии**:

1. Один раз **«Обновить с chess.com»** — партии сохраняются в `games/` на сервере.
2. Дальше жмите **«Разобрать сохранённые»** — повторно ничего не качает.
3. «Обновить…» снова — только когда нужны свежие партии.

Stockfish на VPS ставится сам при деплое (`scripts/deploy.sh`) или при старте API.

API:

- `GET /chesscom/library` — что уже скачано + статус Stockfish
- `POST /chesscom/sync` — `{ usernames, download: false|true, depth, max_games }`
- `GET /chesscom/jobs/{id}` — прогресс
- `GET /chesscom/report` — отчёт

## CLI

```bash
apps/api/.venv/bin/python scripts/chesscom_games.py all Yakov_Msk7 misha5161741
```
