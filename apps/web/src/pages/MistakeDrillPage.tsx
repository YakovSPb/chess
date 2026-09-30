import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { tryUserMove } from '../lib/line';
import type { BoardArrow } from '../types';
import type { GamesReport, MistakeStat, PlayerReport } from '../types/gamesReport';

const GOLD: CSSProperties = {
  backgroundImage: 'linear-gradient(45deg, rgba(255, 215, 0, 0.6), rgba(255, 215, 0, 0.3))',
};

const GOOD: CSSProperties = {
  backgroundColor: 'rgba(62, 207, 142, 0.45)',
};

const BAD: CSSProperties = {
  backgroundColor: 'rgba(244, 67, 54, 0.4)',
};

export function MistakeDrillPage() {
  const { mistakeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const playerName = params.get('player') ?? '';

  const [report, setReport] = useState<GamesReport | null>(null);
  const [status, setStatus] = useState<'idle' | 'wrong' | 'right'>('idle');
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState('Найди лучший ход. Тот, который стоило сделать в партии.');

  useEffect(() => {
    let cancelled = false;
    fetch('/games-report.json')
      .then(async (response) => {
        const text = await response.text();
        try {
          return JSON.parse(text) as GamesReport;
        } catch {
          throw new Error('no report');
        }
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStatus('idle');
    setHint(false);
    setMessage('Найди лучший ход. Тот, который стоило сделать в партии.');
  }, [mistakeId]);

  const player: PlayerReport | null = useMemo(() => {
    if (!report) return null;
    if (playerName) {
      return report.players.find((item) => item.username.toLowerCase() === playerName.toLowerCase()) ?? report.players[0] ?? null;
    }
    return report.players[0] ?? null;
  }, [report, playerName]);

  const mistake: MistakeStat | null = useMemo(() => {
    if (!player || !mistakeId) return null;
    return player.mistakes.find((item) => item.id === mistakeId) ?? null;
  }, [player, mistakeId]);

  const queue = player?.mistakes ?? [];
  const currentIndex = mistake ? queue.findIndex((item) => item.id === mistake.id) : -1;
  const next = currentIndex >= 0 ? queue[currentIndex + 1] : undefined;

  const orientation = useMemo(() => {
    if (!mistake) return 'white' as const;
    return mistake.fen.includes(' w ') ? 'white' : 'black';
  }, [mistake]);

  const bestSquares = useMemo(() => {
    if (!mistake) return null;
    try {
      const board = new Chess(mistake.fen);
      const played = board.move(mistake.best);
      if (!played) return null;
      return { from: played.from, to: played.to };
    } catch {
      return null;
    }
  }, [mistake]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (!bestSquares) return styles;
    if (hint || status === 'right') {
      styles[bestSquares.from] = GOLD;
      styles[bestSquares.to] = status === 'right' ? GOOD : GOLD;
    }
    if (status === 'wrong' && mistake) {
      try {
        const board = new Chess(mistake.fen);
        const played = board.move(mistake.played);
        if (played) {
          styles[played.from] = BAD;
          styles[played.to] = BAD;
        }
      } catch {
        /* ignore */
      }
    }
    return styles;
  }, [bestSquares, hint, status, mistake]);

  const arrows: BoardArrow[] = useMemo(() => {
    if (!bestSquares || (!hint && status !== 'right')) return [];
    return [{ startSquare: bestSquares.from, endSquare: bestSquares.to, color: '#3ecf8e' }];
  }, [bestSquares, hint, status]);

  function onMove(from: string, to: string, promotion?: string): boolean {
    if (!mistake || status === 'right') return false;
    const played = tryUserMove(mistake.fen, from, to, promotion);
    if (!played) return false;

    if (played.san === mistake.best) {
      setStatus('right');
      setMessage(`Верно: ${mistake.best}. В партии было ${mistake.played} (−${mistake.lossCp} cp). ${mistake.tip}`);
      return true;
    }

    setStatus('wrong');
    setMessage(`Не то. В партии тоже уходили в ${mistake.played}. Попробуй ещё или открой подсказку.`);
    return false;
  }

  if (report && !mistake) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--background)] px-4 text-[var(--foreground)]">
        <p>Задача не найдена. Сначала соберите отчёт.</p>
        <Link to="/games" className="text-[var(--accent)] hover:underline">
          К списку ошибок
        </Link>
      </div>
    );
  }

  if (!mistake) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link to="/games" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              ← Мои партии
            </Link>
            <h1 className="mt-1 text-xl font-semibold">
              Исправь ход · {player?.username}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {mistake.opening} · повторов {mistake.count} · −{mistake.lossCp} cp
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHint(true)}
              className="rounded-lg border border-[var(--chat-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
            >
              Подсказка
            </button>
            {next && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/games/drill/${next.id}?player=${encodeURIComponent(player?.username ?? '')}`)
                }
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Следующая
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ChessBoardView
          fen={mistake.fen}
          orientation={orientation}
          allowMoves={status !== 'right'}
          onMove={onMove}
          squareStyles={squareStyles}
          arrows={arrows}
        />
        <aside className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4 text-sm leading-relaxed">
          <p>{message}</p>
          {hint && (
            <p className="mt-3 text-[var(--muted-foreground)]">
              Цель: <span className="font-mono text-[var(--foreground)]">{mistake.best}</span>. Избегай{' '}
              <span className="font-mono text-[var(--foreground)]">{mistake.played}</span>.
            </p>
          )}
          {mistake.examples[0]?.url && (
            <a
              href={mistake.examples[0].url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-[var(--accent)] hover:underline"
            >
              Партия на chess.com
            </a>
          )}
        </aside>
      </main>
    </div>
  );
}
