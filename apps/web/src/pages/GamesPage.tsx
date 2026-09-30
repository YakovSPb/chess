import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchChesscomJob,
  fetchGamesReport,
  startChesscomSync,
  type ChesscomJob,
} from '../lib/chesscomApi';
import type { DevelopmentPlan, GamesReport, MistakeStat, PlayerReport } from '../types/gamesReport';

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

const DEFAULT_NICKS = 'Yakov_Msk7, misha5161741';

function kindClass(kind: string): string {
  if (kind === 'blunder') return 'text-red-400';
  if (kind === 'mistake') return 'text-orange-300';
  return 'text-yellow-300';
}

function scoreLine(player: PlayerReport): string {
  const { wins, draws, losses } = player.results;
  return `${wins}+ ${draws}= ${losses}−`;
}

function parseNicks(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().replace(/^@/, ''))
    .filter(Boolean);
}

export function GamesPage() {
  const [report, setReport] = useState<GamesReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);

  const [nicks, setNicks] = useState(DEFAULT_NICKS);
  const [maxGames, setMaxGames] = useState(60);
  const [depth, setDepth] = useState(12);
  const [job, setJob] = useState<ChesscomJob | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncing = job?.status === 'queued' || job?.status === 'running';

  const loadReport = useCallback(async () => {
    try {
      const data = await fetchGamesReport();
      setReport(data);
      setLoadError(null);
      setPlayerIndex(0);
    } catch {
      setLoadError('Не удалось получить отчёт с сервера. Запущен ли API на :8000?');
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return;
    const timer = window.setInterval(() => {
      void fetchChesscomJob(job.id)
        .then((next) => {
          setJob(next);
          if (next.status === 'done') {
            void loadReport();
          }
          if (next.status === 'error') {
            setSyncError(next.error || 'Ошибка синхронизации');
          }
        })
        .catch((err: unknown) => {
          setSyncError(err instanceof Error ? err.message : 'Ошибка статуса задачи');
        });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job, loadReport]);

  async function onSync() {
    const usernames = parseNicks(nicks);
    if (usernames.length === 0) {
      setSyncError('Введите хотя бы один ник chess.com');
      return;
    }
    setSyncError(null);
    try {
      const started = await startChesscomSync({
        usernames,
        maxGames,
        depth,
        download: true,
      });
      setJob(started);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Не удалось запустить sync');
    }
  }

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
              Онлайн-загрузка с chess.com и разбор ошибок Stockfish прямо в браузере.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <section className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            Скачать и разобрать
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Пароль не нужен — только публичные ники. Партии сохраняются в `games/`, отчёт обновляется здесь.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_8rem_8rem_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted-foreground)]">Ники через запятую</span>
              <input
                value={nicks}
                onChange={(event) => setNicks(event.target.value)}
                disabled={syncing}
                className="rounded-lg border border-[var(--chat-border)] bg-[var(--background)] px-3 py-2"
                placeholder="Yakov_Msk7, misha5161741"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted-foreground)]">Партий</span>
              <input
                type="number"
                min={5}
                max={200}
                value={maxGames}
                disabled={syncing}
                onChange={(event) => setMaxGames(Number(event.target.value) || 60)}
                className="rounded-lg border border-[var(--chat-border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted-foreground)]">Глубина</span>
              <input
                type="number"
                min={8}
                max={18}
                value={depth}
                disabled={syncing}
                onChange={(event) => setDepth(Number(event.target.value) || 12)}
                className="rounded-lg border border-[var(--chat-border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void onSync()}
                disabled={syncing}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {syncing ? 'Идёт…' : 'Скачать и разобрать'}
              </button>
            </div>
          </div>

          {(job || syncError) && (
            <div className="mt-4 space-y-2">
              {job && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {job.message}
                      {job.usernames.length > 0 ? ` · ${job.usernames.join(', ')}` : ''}
                    </span>
                    <span className="text-[var(--muted-foreground)]">{Math.round(job.progress)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bot-bubble)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-[width] duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                    />
                  </div>
                </>
              )}
              {syncError && <p className="text-sm text-red-400">{syncError}</p>}
              {job?.status === 'done' && (
                <p className="text-sm text-emerald-400">Готово — отчёт обновлён ниже.</p>
              )}
            </div>
          )}
        </section>

        {loadError && <p className="text-sm text-red-400">{loadError}</p>}
        {!loadError && !report && <p className="text-sm text-[var(--muted-foreground)]">Загрузка отчёта…</p>}
        {report && report.players.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">
            {report.hint ?? 'Отчёт пуст. Нажмите «Скачать и разобрать».'}
          </p>
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

            {player.plan && <DevelopmentPlanCard plan={player.plan} username={player.username} />}

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
                      <tr
                        key={`${opening.eco}-${opening.side}-${opening.keyMoves}`}
                        className="border-t border-[var(--chat-border)]"
                      >
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
                  Эти позиции чаще всего портят первые ходы. Имеет смысл добавить линии в тренажёр.
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
                        <span className="font-mono text-[var(--foreground)]">{mistake.best}</span> · −{mistake.lossCp}{' '}
                        cp · ×{mistake.count}
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

function DevelopmentPlanCard({ plan, username }: { plan: DevelopmentPlan; username: string }) {
  return (
    <section className="rounded-xl border border-[var(--accent)]/40 bg-[var(--card-bg)] p-5">
      <p className="text-xs font-medium tracking-wide text-[var(--accent)] uppercase">План развития</p>
      <h2 className="mt-1 text-xl font-semibold">{plan.headline}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{plan.summary}</p>

      {plan.priorities.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium">На что обратить внимание</h3>
          <ol className="flex flex-col gap-3">
            {plan.priorities.map((item, index) => (
              <li key={item.title} className="rounded-lg border border-[var(--chat-border)] bg-[var(--background)] p-3">
                <p className="text-sm font-medium">
                  {index + 1}. {item.title}
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.why}</p>
                <p className="mt-1 text-sm">
                  <span className="text-[var(--muted-foreground)]">Что делать: </span>
                  {item.action}
                </p>
                {item.mistakeIds[0] && (
                  <Link
                    to={`/games/drill/${item.mistakeIds[0]}?player=${encodeURIComponent(username)}`}
                    className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline"
                  >
                    Потренировать на доске
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium">Что уже получается</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted-foreground)]">
            {plan.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">План на неделю</h3>
          <ul className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted-foreground)]">
            {plan.weeklyPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
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
