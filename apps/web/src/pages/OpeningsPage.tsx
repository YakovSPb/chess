import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api, type Opening, type OpeningDetail } from '../lib/api';
import { usePageContextSync } from '../lib/pageContext';

type OpeningStep = OpeningDetail['steps'][number];

const HINT_SQUARE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(233, 69, 96, 0.55)',
  boxShadow: 'inset 0 0 0 3px #e94560',
};

function moveMatches(san: string, from: string, to: string, expected: string): boolean {
  const played = san.toLowerCase();
  const expectedLower = expected.toLowerCase();
  const playedUci = `${from}${to}`.toLowerCase();
  return played === expectedLower || playedUci === expectedLower || expectedLower.includes(played);
}

function findMoveFromSquare(fen: string, expectedSan: string): string | null {
  const board = new Chess(fen);
  for (const candidate of board.moves({ verbose: true })) {
    const trial = new Chess(fen);
    try {
      const played = trial.move({
        from: candidate.from,
        to: candidate.to,
        promotion: candidate.promotion,
      });
      if (played && moveMatches(played.san, candidate.from, candidate.to, expectedSan)) {
        return candidate.from;
      }
    } catch {
      continue;
    }
  }

  try {
    const trial = new Chess(fen);
    const played = trial.move(expectedSan);
    if (played) return played.from;
  } catch {
    return null;
  }
  return null;
}

function playStep(chess: Chess, step: OpeningStep): boolean {
  try {
    const move = chess.move(step.expected_move);
    return Boolean(move);
  } catch {
    return false;
  }
}

export function OpeningsPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [selected, setSelected] = useState<OpeningDetail | null>(null);
  const [step, setStep] = useState(0);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [feedback, setFeedback] = useState('');
  const [hintSquares, setHintSquares] = useState<Record<string, CSSProperties>>({});
  const [completed, setCompleted] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageDetails = selected
    ? `${selected.title}, шаг ${step + 1}/${selected.steps.length}${completed ? ', дебют пройден' : ''}${feedback ? ` — ${feedback.replace(/^✓\s*/, '')}` : ''}`
    : 'Список дебютов';
  usePageContextSync('Дебюты', selected ? fen : undefined, pageDetails);

  useEffect(() => {
    api.getOpenings().then(setOpenings);
  }, []);

  const clearHint = () => setHintSquares({});

  const openOpening = async (id: number) => {
    const opening = await api.getOpening(id);
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    chess.reset();
    setFen(chess.fen());
    setStep(0);
    setFeedback('');
    clearHint();
    setBotThinking(false);
    setCompleted(false);
    setSelected(opening);
  };

  const finishOpening = useCallback(async (opening: OpeningDetail) => {
    setCompleted(true);
    setFeedback('Дебют пройден! Ниже — плюсы, минусы и план развития.');
    try {
      await api.updateOpeningProgress(opening.id, opening.steps.length - 1, true);
      const refreshed = await api.getOpening(opening.id);
      setSelected(refreshed);
    } catch {
      // progress save failed — UI still shows completion locally
    }
  }, []);

  const advanceStep = useCallback(
    (opening: OpeningDetail, nextStep: number) => {
      if (nextStep >= opening.steps.length) {
        finishOpening(opening);
        return;
      }
      setStep(nextStep);
      setFeedback('');
      clearHint();
    },
    [finishOpening]
  );

  useEffect(() => {
    if (!selected || completed) return;

    const current = selected.steps[step];
    if (!current || current.actor !== 'bot') {
      setBotThinking(false);
      return;
    }

    setBotThinking(true);
    let cancelled = false;

    botTimerRef.current = setTimeout(() => {
      if (cancelled) return;

      const ok = playStep(chess, current);
      if (!ok) {
        setFeedback('Ошибка линии дебюта. Перезагрузите страницу.');
        setBotThinking(false);
        return;
      }

      setFen(chess.fen());
      setFeedback(current.explanation);
      setBotThinking(false);
      advanceStep(selected, step + 1);
    }, 600);

    return () => {
      cancelled = true;
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      setBotThinking(false);
    };
  }, [selected, step, completed, chess, advanceStep]);

  const handleMove = (from: string, to: string) => {
    if (!selected || completed || botThinking) return false;
    const current = selected.steps[step];
    if (!current || current.actor !== 'user') return false;

    try {
      const move = chess.move({ from, to });
      if (!move) return false;

      if (!moveMatches(move.san, from, to, current.expected_move)) {
        chess.undo();
        setFen(chess.fen());
        setFeedback('Неверный ход. Попробуйте снова или нажмите «Подсказка».');
        return false;
      }

      setFen(chess.fen());
      setFeedback(`✓ ${current.explanation}`);
      clearHint();

      const nextStep = step + 1;
      if (nextStep >= selected.steps.length) {
        void finishOpening(selected);
      } else {
        setTimeout(() => advanceStep(selected, nextStep), 900);
      }
      return true;
    } catch {
      return false;
    }
  };

  const showHint = () => {
    if (!selected || completed) return;
    const current = selected.steps[step];
    if (!current || current.actor !== 'user') return;

    const from = findMoveFromSquare(chess.fen(), current.expected_move);
    if (!from) return;

    setHintSquares({ [from]: HINT_SQUARE_STYLE });
  };

  const userSteps = selected?.steps.filter((s) => s.actor === 'user').length ?? 0;
  const userStepIndex =
    selected?.steps.slice(0, step + 1).filter((s) => s.actor === 'user').length ?? 0;

  if (selected) {
    const isUserTurn = !completed && selected.steps[step]?.actor === 'user' && !botThinking;

    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-[var(--text-secondary)] mb-4">
          ← Все дебюты
        </button>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold">{selected.title}</h2>
          {selected.eco && (
            <span className="text-xs px-2 py-1 rounded bg-[var(--bg-card)] text-[var(--text-secondary)]">
              {selected.eco}
            </span>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            #{selected.popularity} по популярности
          </span>
        </div>

        <p className="text-[var(--text-secondary)] mb-4">
          {completed
            ? 'Дебют завершён'
            : botThinking
              ? 'Соперник делает ход...'
              : isUserTurn
                ? `Ваш ход · ${userStepIndex} из ${userSteps}`
                : 'Подготовка позиции...'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex justify-center min-w-0 w-full">
            <ChessBoardView
              fen={fen}
              orientation={selected.player_color}
              onMove={handleMove}
              allowMoves={isUserTurn}
              squareStyles={hintSquares}
            />
          </div>

          <div className="space-y-4 min-w-0">
            <div className="card">
              <p>{selected.description}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Вы играете {selected.player_color === 'white' ? 'белыми' : 'чёрными'}. Соперник
                автоматически отвечает по дебютной линии.
              </p>
              {!completed && (
                <p className="text-xs text-[var(--text-secondary)] mt-3">
                  Плюсы, минусы и план развития откроются после прохождения дебюта.
                </p>
              )}
            </div>

            {feedback && <div className="card">{feedback}</div>}

            {!completed && (
              <button
                onClick={showHint}
                disabled={!isUserTurn}
                className="btn btn-secondary w-full disabled:opacity-50"
              >
                Подсказка
              </button>
            )}

            {Object.keys(hintSquares).length > 0 && !completed && (
              <p className="text-sm text-[var(--text-secondary)]">
                Подсвечена фигура, которой нужно сходить.
              </p>
            )}

            {completed && selected.pros.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card md:col-span-2 lg:col-span-1">
                  <h3 className="font-semibold text-[#81b64c] mb-3">Плюсы и развитие</h3>
                  <ul className="space-y-4 text-sm">
                    {selected.pros.map((pro) => (
                      <li key={pro.title}>
                        <p className="font-medium">{pro.title}</p>
                        <p className="mt-1">{pro.benefit}</p>
                        <p className="mt-1 text-[var(--text-secondary)]">
                          Как развивать: {pro.development}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-[#ca3431] mb-2">Минусы</h3>
                  <ul className="space-y-1 text-sm">
                    {selected.cons.map((con) => (
                      <li key={con}>− {con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Дебюты</h2>
      <p className="text-[var(--text-secondary)] mb-6">
        Изучайте популярные дебюты: сыграйте линию за свою сторону, используйте подсказки. Плюсы и
        минусы откроются после прохождения.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {openings.map((opening, index) => (
          <button
            key={opening.id}
            onClick={() => openOpening(opening.id)}
            className="card text-left hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--accent)]">#{index + 1}</span>
              {opening.completed && <span className="text-xs text-[#81b64c]">✓ пройден</span>}
            </div>
            <h3 className="font-semibold mt-1">{opening.title}</h3>
            {opening.eco && (
              <span className="text-xs text-[var(--text-secondary)]">{opening.eco}</span>
            )}
            <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
              {opening.description}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {opening.steps_count} ходов · {opening.player_color === 'white' ? 'белые' : 'чёрные'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
