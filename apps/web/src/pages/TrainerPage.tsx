import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '../components/ChatPanel';
import { ChessBoardView } from '../components/ChessBoardView';
import { getOpening } from '../data/openings';
import { coversOf } from '../lib/commentArrows';
import { commentBoard, expectedSquares, positionAt, squaresOfPly, tryUserMove } from '../lib/line';
import { recordAttempt } from '../lib/srs';
import type { BoardArrow, ChatMessage, Opening, OpeningLine, TrainMode } from '../types';

let messageSeq = 0;

function nextMessageId() {
  messageSeq += 1;
  return `msg-${messageSeq}`;
}

const PREVIEW_MS = 1800;

const GOLD: CSSProperties = {
  backgroundImage: 'linear-gradient(45deg, rgba(255, 215, 0, 0.6), rgba(255, 215, 0, 0.3))',
};

export function TrainerPage() {
  const { openingId } = useParams();
  const opening = getOpening(openingId);
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);

  if (!opening) return <Navigate to="/" replace />;

  const requested = params.get('line');
  const line = opening.lines.find((item) => item.id === requested) ?? opening.lines[0];
  const mode: TrainMode = params.get('mode') === 'quiz' ? 'quiz' : 'learn';

  function updateParams(nextLineId: string, nextMode: TrainMode) {
    const next = new URLSearchParams(params);
    next.set('line', nextLineId);
    next.set('mode', nextMode);
    setParams(next);
  }

  return (
    <LineSession
      key={`${line.id}-${mode}-${attempt}`}
      opening={opening}
      line={line}
      mode={mode}
      onRestart={() => setAttempt((value) => value + 1)}
      onMode={(nextMode) => updateParams(line.id, nextMode)}
      onLine={(lineId) => updateParams(lineId, mode)}
    />
  );
}

function LineSession({
  opening,
  line,
  mode,
  onRestart,
  onMode,
  onLine,
}: {
  opening: Opening;
  line: OpeningLine;
  mode: TrainMode;
  onRestart: () => void;
  onMode: (mode: TrainMode) => void;
  onLine: (lineId: string) => void;
}) {
  const navigate = useNavigate();
  const total = line.moves.length;
  const [ply, setPly] = useState(0);
  const [viewPly, setViewPly] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: nextMessageId(), role: 'bot', text: line.intro, board: commentBoard(line.moves, 0) },
  ]);
  const [preview, setPreview] = useState<BoardArrow[]>([]);
  const previewTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const previewGen = useRef(0);
  const [errors, setErrors] = useState(0);
  const [awaitingUser, setAwaitingUser] = useState(line.moves[0]?.by === 'user');
  const [done, setDone] = useState(false);
  const [miss, setMiss] = useState<{ from: string; to: string } | null>(null);
  const prompted = useRef(new Set<number>());
  const saved = useRef(false);
  const errorsRef = useRef(0);
  const plyRef = useRef(0);
  errorsRef.current = errors;
  plyRef.current = ply;

  const fen = useMemo(() => positionAt(line.moves, viewPly), [line.moves, viewPly]);

  function clearPreview() {
    previewGen.current += 1;
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreview([]);
  }

  function hidePreviewSoon() {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    const generation = previewGen.current;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      if (previewGen.current !== generation) return;
      clearPreview();
    }, 60);
  }

  function showPreview(arrows: BoardArrow[], flash: boolean) {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    previewGen.current += 1;
    const generation = previewGen.current;
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreview(arrows);
    if (!flash) return;
    previewTimer.current = window.setTimeout(() => {
      if (previewGen.current !== generation) return;
      previewTimer.current = null;
      setPreview([]);
    }, PREVIEW_MS);
  }

  useEffect(() => {
    return () => {
      if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (viewPly === ply) return;
    clearPreview();
  }, [viewPly, ply]);

  useEffect(() => {
    if (ply === 0 || viewPly !== ply) return;
    const landed = squaresOfPly(line.moves, ply);
    if (!landed) return;
    const arrows = coversOf(positionAt(line.moves, ply), landed.to);
    if (arrows.length === 0) return;
    showPreview(arrows, true);
  }, [ply, viewPly, line.moves]);
  const last = useMemo(() => squaresOfPly(line.moves, viewPly), [line.moves, viewPly]);

  useEffect(() => {
    if (done) return;
    if (ply >= total) {
      if (saved.current) return;
      saved.current = true;
      const mistakes = errorsRef.current;
      recordAttempt(line.id, mistakes === 0);
      setDone(true);
      setAwaitingUser(false);
      const tail =
        mistakes === 0
          ? 'Чисто. Линия уйдёт на повторение по интервалу: 1 день, потом 3, 7, 16 и 35.'
          : `Ошибок: ${mistakes}. Завтра эта линия вернётся сама — ошибка сбрасывает интервал.`;
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'bot',
          text: `Линия пройдена. ${line.summary}\n\n${tail}`,
          board: commentBoard(line.moves, total),
        },
      ]);
      return;
    }

    const move = line.moves[ply];
    if (move.by === 'opponent') {
      setAwaitingUser(false);
      const timer = window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: 'bot',
            text: move.say,
            board: commentBoard(line.moves, ply + 1, move.san),
          },
        ]);
        setPly((current) => current + 1);
        setViewPly((current) => (current === ply ? ply + 1 : current));
        setMiss(null);
      }, 450);
      return () => window.clearTimeout(timer);
    }

    setAwaitingUser(true);
    if (prompted.current.has(ply)) return;
    prompted.current.add(ply);
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: 'bot',
        text: mode === 'learn' ? move.say : move.hint,
        board: commentBoard(line.moves, ply, move.san),
      },
    ]);
  }, [done, line, mode, ply, total]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setViewPly((current) => Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setViewPly((current) => Math.min(plyRef.current, current + 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (viewPly === ply && miss) {
      styles[miss.from] = GOLD;
      styles[miss.to] = GOLD;
      return styles;
    }
    if (last) {
      styles[last.from] = GOLD;
      styles[last.to] = GOLD;
    }
    return styles;
  }, [last, miss, ply, viewPly]);

  function onMove(from: string, to: string, promotion?: string) {
    if (!awaitingUser || done || viewPly !== ply) return false;
    const expected = line.moves[ply];
    if (expected.by !== 'user') return false;
    const played = tryUserMove(positionAt(line.moves, ply), from, to, promotion);
    if (!played) return false;

    if (played.san === expected.san) {
      const extra =
        mode === 'quiz'
          ? [expected.why, expected.plan ? `Дальше: ${expected.plan}` : ''].filter(Boolean).join('\n\n')
          : '';
      setMessages((prev) => {
        const board = commentBoard(line.moves, ply + 1, expected.san);
        const next: ChatMessage[] = [
          ...prev,
          { id: nextMessageId(), role: 'user', text: `Мой ход: ${played.san}`, board },
        ];
        if (extra) next.push({ id: nextMessageId(), role: 'bot', text: extra, board });
        return next;
      });
      setMiss(null);
      setPly(ply + 1);
      setViewPly(ply + 1);
      return true;
    }

    const alternative = expected.alternatives?.find((item) => item.san === played.san);
    if (alternative) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'bot',
          text: `${played.san} — допустимо. ${alternative.why}\n\nВ этой линии играем ${expected.san}.`,
          board: commentBoard(line.moves, ply, expected.san),
        },
      ]);
      return false;
    }

    const hint = expectedSquares(positionAt(line.moves, ply), expected.san);
    if (hint) setMiss(hint);
    setErrors((count) => count + 1);
    const prompt = mode === 'learn' ? expected.say : expected.hint;
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: 'bot',
        text: `${prompt}\n\n❌ Неправильно! Ожидался ход: ${expected.san}`,
        board: commentBoard(line.moves, ply, expected.san),
      },
    ]);
    return false;
  }

  const lineIndex = opening.lines.findIndex((item) => item.id === line.id);
  const nextLine = opening.lines[lineIndex + 1];
  const live = viewPly === ply;
  const progress = Math.round((Math.min(ply, total) / total) * 100);

  let status = 'Ход соперника';
  if (done) status = 'Завершено!';
  else if (!live) status = 'Просмотр';
  else if (awaitingUser) status = 'Твой ход';

  return (
    <div className="flex h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="shrink-0 border-b border-[var(--chat-border)] bg-[var(--card-bg)] px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="К дебютам"
            >
              <BackIcon />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{opening.name}</h1>
              <p className="truncate text-sm text-[var(--muted-foreground)]">{line.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 rounded-md border border-[var(--chat-border)]">
            <ModeButton active={mode === 'learn'} onClick={() => onMode('learn')}>
              Учить
            </ModeButton>
            <ModeButton active={mode === 'quiz'} onClick={() => onMode('quiz')}>
              Проверка
            </ModeButton>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${done ? 'text-yellow-500' : ''}`}>{status}</span>
            <span className={`text-sm ${errors > 0 ? 'text-red-500' : 'text-[var(--muted-foreground)]'}`}>
              Ошибок: {errors}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Предыдущий ход" disabled={viewPly === 0} onClick={() => setViewPly((v) => v - 1)}>
              <BackIcon />
            </IconButton>
            <span className="px-1 text-sm text-[var(--muted-foreground)]">
              {viewPly} / {total}
            </span>
            <IconButton
              label="Следующий ход"
              disabled={viewPly >= ply}
              onClick={() => setViewPly((v) => Math.min(ply, v + 1))}
            >
              <ForwardIcon />
            </IconButton>
          </div>
        </div>
      </header>
      <div className="h-1 bg-neutral-800">
        <div className="h-1 bg-[var(--accent)] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(8rem,34vh)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1">
        <div className="order-2 flex min-h-0 items-center justify-center bg-[var(--background)] p-3 md:order-1 md:p-6">
          <ChessBoardView
            fen={fen}
            orientation={opening.side}
            allowMoves={awaitingUser && live && !done}
            onMove={onMove}
            boardWidth={680}
            squareStyles={squareStyles}
            arrows={preview}
          />
        </div>
        <aside className="order-1 min-h-0 border-b border-[var(--chat-border)] md:order-2 md:border-b-0 md:border-l">
          <ChatPanel
            messages={messages}
            lines={opening.lines}
            activeLineId={line.id}
            hasNext={Boolean(nextLine)}
            onLine={onLine}
            onRestart={onRestart}
            onPreview={showPreview}
            onPreviewEnd={hidePreviewSoon}
            onNext={() => {
              if (nextLine) onLine(nextLine.id);
              else navigate('/');
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-sm ${active ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--hover-bg)]'}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--chat-border)] p-2 hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
    </svg>
  );
}
