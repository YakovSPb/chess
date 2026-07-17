import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api, type Championship, type ChampionshipDetail } from '../lib/api';
import { usePageContextSync } from '../lib/pageContext';

type GameStep = ChampionshipDetail['steps'][number];

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

function playStep(chess: Chess, step: GameStep): boolean {
  try {
    return Boolean(chess.move(step.expected_move));
  } catch {
    return false;
  }
}

function resultLabel(game: Championship): string {
  if (game.winner === 'draw' || game.result === '1/2-1/2') {
    return `Ничья: ${game.white} — ${game.black}`;
  }
  if (game.winner_name && game.loser_name) {
    return `Победитель: ${game.winner_name} · Проигравший: ${game.loser_name}`;
  }
  return `Результат: ${game.result}`;
}

export function ChampionshipsPage() {
  const [games, setGames] = useState<Championship[]>([]);
  const [selected, setSelected] = useState<ChampionshipDetail | null>(null);
  const [step, setStep] = useState(0);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [feedback, setFeedback] = useState('');
  const [hintSquares, setHintSquares] = useState<Record<string, CSSProperties>>({});
  const [completed, setCompleted] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageDetails = selected
    ? `${selected.title}, ход ${step + 1}/${selected.steps.length}${completed ? ', партия пройдена' : ''}${feedback ? ` — ${feedback.replace(/^✓\s*/, '')}` : ''}`
    : 'Список чемпионатов';
  usePageContextSync(
    'Чемпионаты',
    selected ? fen : undefined,
    pageDetails,
    selected?.player_color
  );

  useEffect(() => {
    api.getChampionships().then(setGames);
  }, []);

  const clearHint = () => setHintSquares({});

  const openGame = async (id: number) => {
    const game = await api.getChampionship(id);
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
    setSelected(game);
  };

  const finishGame = useCallback(async (game: ChampionshipDetail) => {
    setCompleted(true);
    const outcome =
      game.winner === 'draw'
        ? 'Партия завершена ничьей.'
        : `Партия завершена. Победил ${game.winner_name}, проиграл ${game.loser_name}.`;
    setFeedback(outcome);
    try {
      await api.updateChampionshipProgress(game.id, game.steps.length - 1, true);
      const refreshed = await api.getChampionship(game.id);
      setSelected(refreshed);
    } catch {
      // progress save failed — UI still shows completion locally
    }
  }, []);

  const advanceStep = useCallback(
    (game: ChampionshipDetail, nextStep: number) => {
      if (nextStep >= game.steps.length) {
        void finishGame(game);
        return;
      }
      setStep(nextStep);
      setFeedback('');
      clearHint();
    },
    [finishGame]
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
        setFeedback('Ошибка линии партии. Перезагрузите страницу.');
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

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!selected || completed || botThinking) return false;
    const current = selected.steps[step];
    if (!current || current.actor !== 'user') return false;

    try {
      const move = chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
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
        void finishGame(selected);
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
          ← Все партии
        </button>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold">{selected.title}</h2>
          <span className="text-xs px-2 py-1 rounded bg-[var(--bg-card)] text-[var(--text-secondary)]">
            {selected.event} · {selected.year}
          </span>
        </div>

        <p className="text-sm mb-1">
          <span className="text-[#81b64c]">{selected.white}</span>
          <span className="text-[var(--text-secondary)]"> — </span>
          <span className="text-[#ca3431]">{selected.black}</span>
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{resultLabel(selected)}</p>

        <p className="text-[var(--text-secondary)] mb-4">
          {completed
            ? 'Партия пройдена'
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
                Вы играете за {selected.player_color === 'white' ? selected.white : selected.black}{' '}
                ({selected.player_color === 'white' ? 'белые' : 'чёрные'}). Нужно пройти всю партию
                до конца — до победы или поражения исторического результата.
              </p>
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

            {completed && (
              <div className="card">
                <h3 className="font-semibold mb-2">Итог</h3>
                <p className="text-sm">{resultLabel(selected)}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Результат: {selected.result}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Чемпионаты</h2>
      <p className="text-[var(--text-secondary)] mb-6">
        Финалы чемпионатов мира и самые известные партии. Сыграйте всю партию за победителя (или
        известную сторону), используйте подсказки — как в дебютах.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => openGame(game.id)}
            className="card text-left hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--accent)]">
                {game.event} · {game.year}
              </span>
              {game.completed && <span className="text-xs text-[#81b64c]">✓ пройдена</span>}
            </div>
            <h3 className="font-semibold mt-1">{game.title}</h3>
            <p className="text-sm mt-2">
              <span className="text-[#81b64c]">{game.white}</span>
              <span className="text-[var(--text-secondary)]"> vs </span>
              <span className="text-[#ca3431]">{game.black}</span>
            </p>
            <p className="text-sm mt-2 font-medium">{resultLabel(game)}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
              {game.description}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {game.steps_count} ходов · играете{' '}
              {game.player_color === 'white' ? 'белыми' : 'чёрными'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
