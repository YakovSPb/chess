import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '../components/ChatPanel';
import { ChessBoardView } from '../components/ChessBoardView';
import { getOpening, studentSide } from '../data/openings';
import { neighborLessons, trackOf } from '../data/curriculum';
import { arrowsForIdeas, coversOf } from '../lib/commentArrows';
import {
  isLinePassed,
  isOpeningUnlocked,
  lessonStatus,
  nextUnpassedLine,
  openingPassedCount,
  isOpeningCompleted,
  rememberLesson,
  unlockHint,
} from '../lib/curriculumProgress';
import { commentBoard, expectedSquares, positionAt, scoreOf, squaresOfPly, tryUserMove } from '../lib/line';
import {
  PASS_STREAK,
  lineMastery,
  masteryColorClass,
  masteryLabel,
  masteryProgressNote,
  recordAttempt,
} from '../lib/srs';
import type { BoardArrow, ChatMessage, Opening, OpeningLine, Side, TrainMode } from '../types';

let messageSeq = 0;

function nextMessageId() {
  messageSeq += 1;
  return `msg-${messageSeq}`;
}

const PREVIEW_MS = 1800;

const GOLD: CSSProperties = {
  backgroundImage: 'linear-gradient(45deg, rgba(255, 215, 0, 0.6), rgba(255, 215, 0, 0.3))',
};

/** В проверке не называем ход: убираем SAN из текста подсказки. */
function quizPromptText(san: string, hint: string, why: string): string {
  const variants = [san, san.replace(/[+#]/g, ''), san.replace(/^=/, '')].filter(Boolean);
  let text = hint;
  for (const token of variants) {
    text = text.replaceAll(token, '…');
  }
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  const hollow = !text || /^сделай ход/i.test(hint) || text.replace(/[….!\s—–-]/g, '').length < 6;
  if (!hollow) return text;

  let idea = why;
  for (const token of variants) {
    idea = idea.replaceAll(token, '…');
  }
  idea = idea.replace(/\s{2,}/g, ' ').trim();
  if (idea && idea.replace(/[….!\s—–-]/g, '').length >= 6) return idea;
  return 'Сделай ход по схеме этой линии.';
}

export function TrainerPage() {
  const { openingId } = useParams();
  const opening = getOpening(openingId);
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);

  if (!opening) return <Navigate to="/" replace />;
  if (!isOpeningUnlocked(opening.id)) return <Navigate to="/" replace />;

  const requested = params.get('line');
  const against = opening.anti.some((item) => item.id === requested);
  const pool = against ? opening.anti : opening.lines;
  const line = pool.find((item) => item.id === requested) ?? pool[0];
  const side = studentSide(opening, against);
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
      lines={pool}
      side={side}
      against={against}
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
  lines,
  side,
  against,
  mode,
  onRestart,
  onMode,
  onLine,
}: {
  opening: Opening;
  line: OpeningLine;
  lines: OpeningLine[];
  side: Side;
  against: boolean;
  mode: TrainMode;
  onRestart: () => void;
  onMode: (mode: TrainMode) => void;
  onLine: (lineId: string) => void;
}) {
  const navigate = useNavigate();
  const trackCtx = trackOf(opening.id);
  const neighbors = neighborLessons(opening.id);

  useEffect(() => {
    rememberLesson(opening.id);
  }, [opening.id]);

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
  const finaleArrows = useRef<BoardArrow[] | null>(null);
  const [errors, setErrors] = useState(0);
  const [awaitingUser, setAwaitingUser] = useState(line.moves[0]?.by === 'user');
  const [done, setDone] = useState(false);
  const [miss, setMiss] = useState<{ from: string; to: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);
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
      if (finaleArrows.current && viewPly === ply) {
        showPreview(finaleArrows.current, false);
        return;
      }
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
      setPreview(finaleArrows.current ?? []);
    }, PREVIEW_MS);
  }

  useEffect(() => {
    return () => {
      if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (viewPly === ply) return;
    clearPreview();
  }, [viewPly, ply]);

  useEffect(() => {
    if (ply === 0 || viewPly !== ply || ply >= total) return;
    const landed = squaresOfPly(line.moves, ply);
    if (!landed) return;
    const arrows = coversOf(positionAt(line.moves, ply), landed.to);
    if (arrows.length === 0) return;
    showPreview(arrows, true);
  }, [ply, viewPly, line.moves, total]);
  const last = useMemo(() => squaresOfPly(line.moves, viewPly), [line.moves, viewPly]);

  useEffect(() => {
    if (done) return;
    if (ply >= total) {
      if (saved.current) return;
      saved.current = true;
      const mistakes = errorsRef.current;
      // В школу засчитывается только чистая «Проверка».
      if (mode === 'quiz') {
        recordAttempt(line.id, mistakes === 0);
      }
      setDone(true);
      setAwaitingUser(false);

      const mastery = lineMastery(line.id);
      let schoolNote = '';
      if (mode === 'learn') {
        schoolNote =
          `Это режим «Учить». В школу засчитывается только «Проверка» без ошибок — ${PASS_STREAK} раза подряд до зелёного (линии «за тебя» и «против тебя»).`;
      } else if (mistakes === 0) {
        const progress = openingPassedCount(opening.id);
        if (isOpeningCompleted(opening.id)) {
          const nextId = neighbors.next;
          schoolNote = nextId
            ? `Урок сдан целиком (${progress.done}/${progress.total} зелёных). Дальше в этом блоке: следующий шаг семьи, не новый дебют сразу.`
            : `Урок сдан (${progress.done}/${progress.total} зелёных). Блок можно закрывать, если сданы все уроки блока.`;
        } else {
          const leftMain = opening.lines.filter((item) => !isLinePassed(item.id)).length;
          const leftAnti = opening.anti.filter((item) => !isLinePassed(item.id)).length;
          schoolNote = `Урок: ${progress.done}/${progress.total} зелёных. Осталось «за тебя»: ${leftMain}, «против тебя»: ${leftAnti}.`;
        }
      } else {
        schoolNote =
          mastery >= PASS_STREAK
            ? `Ошибок: ${mistakes}. Зелёный сохранён, но интервал повторения сброшен.`
            : `Ошибок: ${mistakes}. Счётчик сброшен: ${masteryLabel(mastery)}. Нужно ${PASS_STREAK} чистые проверки подряд.`;
      }

      const tail =
        mistakes === 0 && mode === 'quiz'
          ? mastery >= PASS_STREAK
            ? `${masteryProgressNote(mastery)} Уйдёт на повторение: 1 день, потом 3, 7, 16 и 35.`
            : `Чисто. ${masteryProgressNote(mastery)}`
          : mistakes === 0
            ? 'Линия пройдена в режиме обучения.'
            : `Ошибок: ${mistakes}. При чистой проверке счётчик растёт: оранжевый → жёлтый → зелёный.`;

      const fen = positionAt(line.moves, total);
      const color = side === 'white' ? 'w' : 'b';
      const ideas = arrowsForIdeas(fen, line.next, color);
      const arrows = ideas.flatMap((idea) => idea.arrows);
      finaleArrows.current = arrows.length > 0 ? arrows : null;
      if (finaleArrows.current) showPreview(finaleArrows.current, false);
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'bot',
          text: `Линия пройдена. ${line.summary}\n\n${tail}\n\n${schoolNote}`,
          board: commentBoard(line.moves, total),
          ideas,
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
        text: mode === 'learn' ? move.say : quizPromptText(move.san, move.hint, move.why),
        // В проверке не рисуем стрелку правильного хода до ответа ученика.
        board: commentBoard(line.moves, ply, mode === 'learn' ? move.san : undefined),
      },
    ]);
  }, [done, line, mode, side, ply, total, against, opening.id, neighbors.next]);

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
          text:
            mode === 'learn'
              ? `${played.san} — допустимо. ${alternative.why}\n\nВ этой линии играем ${expected.san}.`
              : `${played.san} — допустимо. ${alternative.why}\n\nВ этой линии нужен другой ход схемы.`,
          board: commentBoard(line.moves, ply, mode === 'learn' ? expected.san : undefined),
        },
      ]);
      return false;
    }

    const hintSquares = expectedSquares(positionAt(line.moves, ply), expected.san);
    if (hintSquares) setMiss(hintSquares);
    setErrors((count) => count + 1);
    const prompt =
      mode === 'learn' ? expected.say : quizPromptText(expected.san, expected.hint, expected.why);
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: 'bot',
        text:
          mode === 'learn'
            ? `${prompt}\n\n❌ Неправильно! Ожидался ход: ${expected.san}`
            : `${prompt}\n\n❌ Неправильно. Попробуй ещё раз.`,
        board: commentBoard(line.moves, ply, mode === 'learn' ? expected.san : undefined),
      },
    ]);
    return false;
  }

  async function copyMoves() {
    const score = scoreOf(line.moves, viewPly);
    const who = side === 'white' ? 'белыми' : 'чёрными';
    const text = [
      `${opening.name} — ${line.name}`,
      against ? 'Против тебя' : null,
      `Играю ${who}`,
      score ? `Ходы: ${score}` : 'Ходы: начальная позиция',
      `FEN: ${fen}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => {
      copiedTimer.current = null;
      setCopied(false);
    }, 1500);
  }

  const lineIndex = lines.findIndex((item) => item.id === line.id);
  const nextLine = lines[lineIndex + 1];
  const hasNext =
    Boolean(nextLine) ||
    (done &&
      (Boolean(nextUnpassedLine(opening.id)) ||
        (isOpeningCompleted(opening.id) &&
          Boolean(neighbors.next && isOpeningUnlocked(neighbors.next)))));
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
              {against ? (
                <p className="truncate text-xs text-[var(--muted-foreground)]">Против тебя</p>
              ) : null}
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
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Линии урока">
          {lines.map((item) => {
            const active = item.id === line.id;
            const mastery = lineMastery(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={`${item.name}: ${masteryLabel(mastery)}`}
                onClick={() => onLine(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--chat-border)] text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    active && mastery === 0 ? 'bg-white/70' : masteryColorClass(mastery)
                  }`}
                  aria-hidden
                />
                <span className="max-w-[12rem] truncate">{item.name}</span>
              </button>
            );
          })}
        </div>
        {trackCtx && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              disabled={!neighbors.prev || !isOpeningUnlocked(neighbors.prev)}
              onClick={() => {
                if (!neighbors.prev || !isOpeningUnlocked(neighbors.prev)) return;
                const prevOpening = getOpening(neighbors.prev);
                const first = prevOpening?.lines[0];
                if (prevOpening && first) {
                  navigate(`/openings/${prevOpening.id}?line=${first.id}&mode=${mode}`);
                }
              }}
              className="shrink-0 rounded-md border border-[var(--chat-border)] px-2 py-1 text-xs disabled:opacity-40"
            >
              ← Урок
            </button>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {trackCtx.track.openingIds.map((id) => {
                const item = getOpening(id);
                if (!item) return null;
                const status = lessonStatus(id);
                const active = id === opening.id;
                const locked = status === 'locked';
                return (
                  <button
                    key={id}
                    type="button"
                    title={locked ? unlockHint(id) : item.name}
                    disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      const first = item.lines[0];
                      navigate(`/openings/${item.id}?line=${first.id}&mode=${mode}`);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      active
                        ? 'bg-[var(--accent)] text-white'
                        : locked
                          ? 'border border-[var(--chat-border)] text-[var(--muted-foreground)] opacity-50'
                          : 'border border-[var(--chat-border)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {item.name}
                    {status === 'done' ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!neighbors.next || !isOpeningUnlocked(neighbors.next)}
              title={
                neighbors.next && !isOpeningUnlocked(neighbors.next)
                  ? unlockHint(neighbors.next)
                  : 'Следующий урок'
              }
              onClick={() => {
                if (!neighbors.next || !isOpeningUnlocked(neighbors.next)) return;
                const nextOpening = getOpening(neighbors.next);
                const first = nextOpening?.lines[0];
                if (nextOpening && first) {
                  navigate(`/openings/${nextOpening.id}?line=${first.id}&mode=${mode}`);
                }
              }}
              className="shrink-0 rounded-md border border-[var(--chat-border)] px-2 py-1 text-xs disabled:opacity-40"
            >
              Урок →
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${done ? 'text-yellow-500' : ''}`}>{status}</span>
            <span className={`text-sm ${errors > 0 ? 'text-red-500' : 'text-[var(--muted-foreground)]'}`}>
              Ошибок: {errors}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              label={copied ? 'Скопировано' : 'Скопировать ходы'}
              disabled={false}
              onClick={() => void copyMoves()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
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
            orientation={side}
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
            lines={lines}
            activeLineId={line.id}
            hasNext={hasNext}
            onLine={onLine}
            onRestart={onRestart}
            onPreview={showPreview}
            onPreviewEnd={hidePreviewSoon}
            onNext={() => {
              if (nextLine) {
                onLine(nextLine.id);
                return;
              }
              const unfinished = nextUnpassedLine(opening.id);
              if (unfinished) {
                onLine(unfinished);
                return;
              }
              if (neighbors.next && isOpeningUnlocked(neighbors.next)) {
                const nextOpening = getOpening(neighbors.next);
                const first = nextOpening?.lines[0];
                if (nextOpening && first) {
                  navigate(`/openings/${nextOpening.id}?line=${first.id}&mode=${mode}`);
                  return;
                }
              }
              navigate('/');
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

function CopyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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
