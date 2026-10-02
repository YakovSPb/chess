# Архитектура

Тренажёр дебютов со школьной программой. Основной UI — фронтенд; анализ партий chess.com — через API.

```
apps/web/   React + Vite + TypeScript
apps/api/   FastAPI (партии, Stockfish)
docs/       Как устроен продукт
```

## Экраны

| Путь | Что делает |
|------|------------|
| `/` | Школа: уровни → треки → уроки, прогресс и замки |
| `/openings/:id?line=&mode=` | Доска и чат. Слайдер уроков трека. Locked → редирект на `/` |
| `/review` | Линии с подошедшим интервалом SRS |
| `/games` | Отчёт chess.com |
| `/games/drill/:mistakeId` | Тренировка ошибки из партии |

## Данные

Дебюты: `apps/web/src/data/openings.ts` + `extraOpenings.ts` + `gmOpenings.ts` + `familySteps.ts` (промежуточные шаги семей). Anti-линии — в `anti.ts` и внутри пакетов.

Программа школы: `apps/web/src/data/curriculum.ts` — **15 семейных блоков** (внутри каждого база → схемы → фишки). Урок сдан только после всех линий «за тебя» и «против тебя».

Прогресс школы: `apps/web/src/lib/curriculumProgress.ts` читает SRS (`opening-srs-v1`, `step >= 1` = линия сдана) и пишет `opening-curriculum-v1` (последний урок).

Линия — последовательность ходов. У хода ученика есть `say`, `hint`, `why`, `plan`, `alternatives`.

## Проверка хода

`chess.js` сравнивает SAN. Верный ход остаётся. Неверный откатывается.

## Повторение

`localStorage`, ключ `opening-srs-v1`. Чистая линия уходит на 1, 3, 7, 16, 35 дней. Ошибка — на завтра.

## Стек доски

`react-chessboard` + `chess.js`. Анализ партий: `POST /chesscom/sync` + Stockfish. См. [games-analysis.md](games-analysis.md).
