import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api, type Puzzle, type PuzzleLevel, type PuzzleListItem } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  applyUciMove,
  initPuzzleBoard,
  puzzleOrientation,
  shouldAutoPlayOpponent,
  toUci,
} from '../lib/puzzleMoves';
import { THEME_LABELS } from '../lib/stockfish';
import { usePageContextSync } from '../lib/pageContext';

export function PuzzlesPage() {
  const { user } = useAuth();
  const [chess] = useState(() => new Chess());
  const [levels, setLevels] = useState<PuzzleLevel[]>([]);
  const [levelId, setLevelId] = useState('easy');
  const [puzzleList, setPuzzleList] = useState<PuzzleListItem[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState('');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [expectedMoves, setExpectedMoves] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [playedMoves, setPlayedMoves] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [streak, setStreak] = useState(user?.puzzle_streak ?? 0);
  const [rating, setRating] = useState(user?.puzzle_rating ?? 1200);
  const startTime = useRef(Date.now());
  const [loading, setLoading] = useState(true);
  const [hintSquares, setHintSquares] = useState<Record<string, CSSProperties>>({});

  const puzzleDetails = puzzle
    ? `Рейтинг ${puzzle.rating}, темы: ${puzzle.themes.split(' ').map((t) => THEME_LABELS[t] || t).join(', ')}${feedback ? ` — ${feedback}` : ''}`
    : `Уровень: ${levels.find((l) => l.id === levelId)?.label ?? levelId}`;
  usePageContextSync('Задачи', puzzle && fen ? fen : undefined, puzzleDetails);

  const clearHint = () => setHintSquares({});

  const showHint = () => {
    if (step >= expectedMoves.length) return;
    const from = expectedMoves[step].slice(0, 2);
    setHintSquares({
      [from]: {
        backgroundColor: 'rgba(233, 69, 96, 0.55)',
        boxShadow: 'inset 0 0 0 3px #e94560',
      },
    });
    setFeedback('Подсказка: ходит выделенная фигура');
  };

  const setupPuzzle = useCallback(
    (p: Puzzle) => {
      if (!p.moves) {
        setFeedback('Нужна авторизация для решения задач');
        return;
      }

      const moves = p.moves.trim().split(/\s+/);
      setExpectedMoves(moves);

      let board: Chess;
      try {
        board = initPuzzleBoard(p.fen);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Ошибка загрузки задачи');
        setPuzzle(null);
        return;
      }

      chess.load(board.fen());
      setFen(chess.fen());
      setOrientation(puzzleOrientation(p.fen));
      setStep(0);
      setPlayedMoves([]);
      setPuzzle(p);
      clearHint();
      startTime.current = Date.now();
    },
    [chess]
  );

  const refreshLevels = useCallback(async () => {
    const data = await api.getPuzzleLevels();
    setLevels(data);
    return data;
  }, []);

  const loadLevelPuzzles = useCallback(async (selectedLevel: string) => {
    const list = await api.getPuzzlesByLevel(selectedLevel);
    setPuzzleList(list);
    return list;
  }, []);

  const openPuzzle = useCallback(
    async (puzzleId: number) => {
      setLoading(true);
      setFeedback('');
      clearHint();
      try {
        const p = await api.getPuzzle(puzzleId);
        setupPuzzle(p);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Ошибка загрузки');
        setPuzzle(null);
      } finally {
        setLoading(false);
      }
    },
    [setupPuzzle]
  );

  const initLevel = useCallback(
    async (selectedLevel: string, preferredPuzzleId?: number) => {
      setLoading(true);
      setFeedback('');
      clearHint();
      try {
        await refreshLevels();
        const list = await loadLevelPuzzles(selectedLevel);
        if (list.length === 0) {
          setPuzzle(null);
          setFeedback('В этом уровне пока нет задач');
          return;
        }
        const targetId =
          preferredPuzzleId ??
          list.find((p) => !p.solved)?.id ??
          list[0].id;
        await openPuzzle(targetId);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Ошибка загрузки');
        setPuzzle(null);
      } finally {
        setLoading(false);
      }
    },
    [refreshLevels, loadLevelPuzzles, openPuzzle]
  );

  useEffect(() => {
    void initLevel('easy');
  }, []);

  useEffect(() => {
    if (user) {
      setRating(user.puzzle_rating);
      setStreak(user.puzzle_streak);
    }
  }, [user]);

  const handleLevelChange = (newLevel: string) => {
    setLevelId(newLevel);
    void initLevel(newLevel);
  };

  const refreshAfterSolve = async (puzzleId: number) => {
    await refreshLevels();
    const list = await loadLevelPuzzles(levelId);
    setPuzzleList(list);
    const next = list.find((p) => !p.solved && p.id !== puzzleId);
    if (next) {
      setTimeout(() => void openPuzzle(next.id), 1500);
    }
  };

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!puzzle || step >= expectedMoves.length) return false;

    const expected = expectedMoves[step].toLowerCase();
    const played = toUci(from, to, promotion);

    if (played !== expected) {
      setFeedback('❌ Неверный ход. Попробуйте снова.');
      return false;
    }

    try {
      chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
      setFen(chess.fen());
      const newPlayed = [...playedMoves, played];
      setPlayedMoves(newPlayed);
      let nextStep = step + 1;

      if (nextStep >= expectedMoves.length) {
        const timeMs = Date.now() - startTime.current;
        void api.solvePuzzle(puzzle.id, newPlayed, timeMs).then(async (result) => {
          setStreak(result.streak);
          setRating(result.new_rating);
          setFeedback(
            result.correct
              ? `✅ Верно! ${result.puzzle_rating_change > 0 ? '+' : ''}${result.puzzle_rating_change} рейтинг`
              : '❌ Неверно'
          );
          if (result.correct) {
            setPuzzleList((prev) =>
              prev.map((p) => (p.id === puzzle.id ? { ...p, solved: true } : p))
            );
            await refreshAfterSolve(puzzle.id);
          }
        });
        return true;
      }

      if (shouldAutoPlayOpponent(step, expectedMoves.length)) {
        applyUciMove(chess, expectedMoves[nextStep]);
        setFen(chess.fen());
        nextStep += 1;
      }

      setStep(nextStep);
      clearHint();
      setFeedback('✓ Продолжайте');
      return true;
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : '❌ Нелегальный ход');
      return false;
    }
  };

  const currentLevel = levels.find((l) => l.id === levelId);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Задачи</h2>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-[var(--text-secondary)]">Рейтинг: {Math.round(rating)}</span>
        <span>🔥 {streak}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => handleLevelChange(level.id)}
            className={`btn text-sm ${levelId === level.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {level.label}
            <span className="ml-2 opacity-80">
              {level.solved}/{level.total}
            </span>
          </button>
        ))}
      </div>

      {currentLevel && (
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Уровень: {currentLevel.label} ({currentLevel.min_rating}–{currentLevel.max_rating}) ·
          пройдено {currentLevel.solved} из {currentLevel.total}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card order-2 max-h-64 overflow-y-auto lg:order-1 lg:col-span-1 lg:max-h-[520px]">
          <h3 className="font-semibold mb-3">
            Список задач{puzzleList.length > 0 ? ` · ${puzzleList.length}` : ''}
          </h3>
          {puzzleList.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm">Нет задач</p>
          ) : (
            <div className="space-y-1">
              {puzzleList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void openPuzzle(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    puzzle?.id === item.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'hover:bg-[var(--bg-card)]'
                  }`}
                >
                  <span>
                    #{item.index} · {item.rating}
                  </span>
                  <span className={item.solved ? 'text-green-400' : 'text-[var(--text-secondary)]'}>
                    {item.solved ? '✓' : '○'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2 lg:col-span-2">
          {loading ? (
            <p className="text-[var(--text-secondary)]">Загрузка задачи...</p>
          ) : puzzle ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex justify-center items-start">
                <ChessBoardView
                  fen={fen}
                  orientation={orientation}
                  onMove={handleMove}
                  squareStyles={hintSquares}
                />
              </div>
              <div className="space-y-4">
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <p>
                      Задача #{puzzleList.find((p) => p.id === puzzle.id)?.index ?? '—'} ·{' '}
                      <strong>{puzzle.rating}</strong>
                    </p>
                    {puzzle.solved && (
                      <span className="text-green-400 font-medium">✓ Пройдена</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Темы: {puzzle.themes.split(' ').map((t) => THEME_LABELS[t] || t).join(', ')}
                  </p>
                  <button
                    onClick={showHint}
                    disabled={step >= expectedMoves.length}
                    className="btn btn-secondary w-full"
                  >
                    Подсказка
                  </button>
                </div>
                {feedback && (
                  <div
                    className={`card ${
                      feedback.startsWith('✅')
                        ? 'border-green-600'
                        : feedback.startsWith('❌')
                          ? 'border-red-600'
                          : ''
                    }`}
                  >
                    {feedback}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-400">{feedback || 'Задачи не найдены'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
