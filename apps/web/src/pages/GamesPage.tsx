import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GamesReport, MistakeStat, PlayerReport } from '../types/gamesReport';

const KIND_LABEL: Record<string, string> = {
  blunder: 'Зевок',
  mistake: 'Ошибка',
  inaccuracy: 'Неточность',
};

const PHASE_LABEL: Record<string, string> = {
  opening: 'дебют',
  middlegame: 'миттельшпиль',
  endgame: 'эндшпиль',
};

function kindClass(kind: string): string {
  if (kind === 'blunder') return 'text-red-400';
  if (kind === 'mistake') return 'text-orange-300';
  return 'text-yellow-300';
}

function scoreLine(player: PlayerReport): string {
  const { wins, draws, losses } = player.results;
  return `${wins}+ ${draws}= ${losses}−`;
}

export function GamesPage() {
  const [report, setReport] = useState<GamesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/games-report.json')
      .then(async (response) => {
        const text = await response.text();
        try {
          return JSON.parse(text) as GamesReport;
        } catch {
          throw new Error('Отчёт ещё не собран');
        }
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setError('Нет отчёта. Сначала скачайте партии скриптом.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const player = report?.players[playerIndex] ?? null;

  const openingMistakes = useMemo(() => {
    if (!player) return [] as MistakeStat[];
    return player.mistakes.filter((item) => item.phase === 'opening').slice(0, 12);
  }, [player]);

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">
              <Link to="/" className="hover:text-[var(--foreground)]">
                ← Дебюты
              </Link>
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Мои партии</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
              Импорт с chess.com, частые дебюты, повторяющиеся ошибки и тренировка хода, который следовало сделать.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {error && <EmptyState message={error} />}
        {!error && !report && <p className="text-sm text-[var(--muted-foreground)]">Загрузка отчёта…</p>}
        {report && report.players.length === 0 && (
          <EmptyState message={report.hint ?? 'Отчёт пуст. Запустите скрипт загрузки.'} />
        )}

        {report && report.players.length > 0 && player && (
          <>
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {report.players.map((item, index) => (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => setPlayerIndex(index)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      index === playerIndex
                        ? 'bg-[var(--accent)] font-medium text-white'
                        : 'border border-[var(--chat-border)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {item.username}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Анализ: {player.analyzedGames} из {player.downloadedGames} · глубина {report.engineDepth} ·{' '}
                {scoreLine(player)}
                {report.generatedAt ? ` · ${new Date(report.generatedAt).toLocaleString('ru-RU')}` : ''}
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                Частые дебюты
              </h2>
              <div className="overflow-x-auto rounded-xl border border-[var(--chat-border)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--card-bg)] text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Дебют</th>
                      <th className="px-3 py-2 font-medium">Сторона</th>
                      <th className="px-3 py-2 font-medium">Партий</th>
                      <th className="px-3 py-2 font-medium">Результат</th>
                      <th className="px-3 py-2 font-medium">Ср. потеря</th>
                      <th className="px-3 py-2 font-medium">Ходы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {player.openings.map((opening) => (
                      <tr key={`${opening.eco}-${opening.side}-${opening.keyMoves}`} className="border-t border-[var(--chat-border)]">
                        <td className="px-3 py-2">
                          <span className="font-medium">{opening.name}</span>
                          <span className="ml-2 font-mono text-xs text-[var(--muted-foreground)]">{opening.eco}</span>
                        </td>
                        <td className="px-3 py-2">{opening.side === 'white' ? 'белые' : 'чёрные'}</td>
                        <td className="px-3 py-2">{opening.count}</td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">
                          {opening.wins}+ {opening.draws}= {opening.losses}−
                        </td>
                        <td className="px-3 py-2">{opening.avgLossCp} cp</td>
                        <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">
                          {opening.keyMoves}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                  Повторяющиеся ошибки
                </h2>
                {player.mistakes[0] && (
                  <Link
                    to={`/games/drill/${player.mistakes[0].id}?player=${encodeURIComponent(player.username)}`}
                    className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Тренировать с первой
                  </Link>
                )}
              </div>
              <ul className="flex flex-col gap-3">
                {player.mistakes.map((mistake) => (
                  <MistakeCard key={mistake.id} mistake={mistake} username={player.username} />
                ))}
              </ul>
              {player.mistakes.length === 0 && (
                <p className="text-sm text-[var(--muted-foreground)]">Явных повторов не нашлось на выбранной выборке.</p>
              )}
            </section>

            {openingMistakes.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                  Узкие места в дебюте
                </h2>
                <p className="mb-3 text-sm text-[var(--muted-foreground)]">
                  Эти позиции чаще всего портят ваши первые 10 ходов. Имеет смысл добавить линии в тренажёр.
                </p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {openingMistakes.map((mistake) => (
                    <li
                      key={`open-${mistake.id}`}
                      className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4 text-sm"
                    >
                      <p className="font-medium">
                        {mistake.opening}{' '}
                        <span className={kindClass(mistake.kind)}>
                          {KIND_LABEL[mistake.kind] ?? mistake.kind}
                        </span>
                      </p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        Играли <span className="font-mono text-[var(--foreground)]">{mistake.played}</span>, лучше{' '}
                        <span className="font-mono text-[var(--foreground)]">{mistake.best}</span> · −{mistake.lossCp} cp · ×
                        {mistake.count}
                      </p>
                      <Link
                        to={`/games/drill/${mistake.id}?player=${encodeURIComponent(player.username)}`}
                        className="mt-3 inline-block text-[var(--accent)] hover:underline"
                      >
                        Исправить на доске
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MistakeCard({ mistake, username }: { mistake: MistakeStat; username: string }) {
  return (
    <li className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            <span className={kindClass(mistake.kind)}>{KIND_LABEL[mistake.kind] ?? mistake.kind}</span>
            <span className="text-[var(--muted-foreground)]">
              {' '}
              · {PHASE_LABEL[mistake.phase] ?? mistake.phase} · {mistake.opening}
            </span>
          </p>
          <p className="mt-1 text-sm">
            Сыграно <span className="font-mono">{mistake.played}</span>, лучше{' '}
            <span className="font-mono">{mistake.best}</span>
            <span className="text-[var(--muted-foreground)]">
              {' '}
              · −{mistake.lossCp} cp · повторов {mistake.count}
            </span>
          </p>
          {mistake.tip && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{mistake.tip}</p>}
        </div>
        <Link
          to={`/games/drill/${mistake.id}?player=${encodeURIComponent(username)}`}
          className="shrink-0 rounded-lg border border-[var(--chat-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
        >
          Тренировать
        </Link>
      </div>
    </li>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--chat-border)] bg-[var(--card-bg)] p-6 text-sm leading-relaxed">
      <p className="font-medium">Как подключить аккаунты</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--muted-foreground)]">
        <li>
          Узнайте ники на chess.com (свой и сына). Пароль не нужен — API отдаёт публичные партии.
        </li>
        <li>
          В корне проекта:
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--bot-bubble)] p-3 font-mono text-xs text-[var(--foreground)]">
            apps/api/.venv/bin/python scripts/chesscom_games.py all ВАШ_НИК НИК_СЫНА
          </pre>
        </li>
        <li>
          Обновите эту страницу. Подробности: <code className="text-[var(--foreground)]">docs/games-analysis.md</code>
        </li>
      </ol>
      <p className="mt-4 text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
