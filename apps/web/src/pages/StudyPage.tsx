import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { getStudyStats, STUDY_CATEGORIES, type StudyCategory, type StudyPrinciple, type StudyProgress, type StudyPuzzle } from '../data/study';
import {
  applyUciMove,
  initPuzzleBoard,
  puzzleOrientation,
  shouldAutoPlayOpponent,
  toUci,
} from '../lib/puzzleMoves';
import { loadStudyProgress, markPuzzleSolved } from '../lib/studyProgress';
import { usePageContextSync } from '../lib/pageContext';

type View = 'categories' | 'principles' | 'practice';

export function StudyPage() {
  const stats = useMemo(() => getStudyStats(), []);
  const [view, setView] = useState<View>('categories');
  const [category, setCategory] = useState<StudyCategory | null>(null);
  const [principle, setPrinciple] = useState<StudyPrinciple | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [progress, setProgress] = useState<StudyProgress>(() => loadStudyProgress());
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState('');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [expectedMoves, setExpectedMoves] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [hintSquares, setHintSquares] = useState<Record<string, CSSProperties>>({});
  const [search, setSearch] = useState('');

  const currentPuzzle: StudyPuzzle | null = principle?.puzzles[exampleIndex] ?? null;

  const pageDetails = useMemo(() => {
    if (view === 'practice' && principle && currentPuzzle) {
      return `${category?.title} · ${principle.text.slice(0, 60)}… · ${currentPuzzle.title}`;
    }
    if (view === 'principles' && category) return category.title;
    return `${stats.categories} разделов · ${stats.principles} утверждений · ${stats.puzzles} примеров`;
  }, [view, category, principle, currentPuzzle, stats]);

  usePageContextSync('Учёба', view === 'practice' && fen ? fen : undefined, pageDetails);

  const setupPuzzle = useCallback(
    (puzzle: StudyPuzzle) => {
      const moves = puzzle.moves.trim().split(/\s+/);
      setExpectedMoves(moves);
      const board = initPuzzleBoard(puzzle.fen);
      chess.load(board.fen());
      setFen(chess.fen());
      setOrientation(puzzleOrientation(puzzle.fen));
      setStep(0);
      setFeedback('');
      setHintSquares({});
    },
    [chess],
  );

  useEffect(() => {
    if (currentPuzzle) setupPuzzle(currentPuzzle);
  }, [currentPuzzle, setupPuzzle]);

  const solvedCount = useMemo(
    () => Object.values(progress).filter(Boolean).length,
    [progress],
  );

  const categoryProgress = (cat: StudyCategory) => {
    const total = cat.principles.length * 3;
    const done = cat.principles.reduce(
      (n, pr) => n + pr.puzzles.filter((pu) => progress[pu.id]).length,
      0,
    );
    return { done, total };
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STUDY_CATEGORIES;
    return STUDY_CATEGORIES.filter(
      (cat) =>
        cat.title.toLowerCase().includes(q) ||
        cat.principles.some((pr) => pr.text.toLowerCase().includes(q)),
    );
  }, [search]);

  const openCategory = (cat: StudyCategory) => {
    setCategory(cat);
    setPrinciple(null);
    setView('principles');
    setSearch('');
  };

  const openPrinciple = (pr: StudyPrinciple) => {
    setPrinciple(pr);
    setExampleIndex(0);
    setView('practice');
  };

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

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!currentPuzzle || step >= expectedMoves.length) return false;

    const expected = expectedMoves[step].toLowerCase();
    const played = toUci(from, to, promotion);

    if (played !== expected) {
      setFeedback('❌ Неверный ход. Попробуйте снова.');
      return false;
    }

    try {
      chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
      setFen(chess.fen());
      let nextStep = step + 1;

      if (nextStep >= expectedMoves.length) {
        setProgress(markPuzzleSolved(currentPuzzle.id));
        setFeedback(`✅ Верно! ${currentPuzzle.explanation}`);
        setHintSquares({});
        return true;
      }

      if (shouldAutoPlayOpponent(step, expectedMoves.length)) {
        applyUciMove(chess, expectedMoves[nextStep]);
        setFen(chess.fen());
        nextStep += 1;
      }

      setStep(nextStep);
      setHintSquares({});
      setFeedback('✓ Продолжайте');
      return true;
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : '❌ Нелегальный ход');
      return false;
    }
  };

  if (view === 'practice' && category && principle && currentPuzzle) {
    return (
      <div>
        <button
          onClick={() => {
            setView('principles');
            setPrinciple(null);
          }}
          className="text-[var(--text-secondary)] mb-4"
        >
          ← {category.title}
        </button>

        <div className="card mb-4">
          <p className="text-sm text-[var(--accent)] mb-2">{category.title}</p>
          <p className="leading-relaxed">{principle.text}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {principle.puzzles.map((pu, idx) => (
            <button
              key={pu.id}
              onClick={() => setExampleIndex(idx)}
              className={`btn text-sm ${exampleIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
            >
              {pu.title}
              {progress[pu.id] ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="flex justify-center min-w-0 w-full">
            <ChessBoardView
              fen={fen}
              orientation={orientation}
              onMove={handleMove}
              squareStyles={hintSquares}
            />
          </div>
          <div className="space-y-4 min-w-0">
            <div className="card space-y-3">
              <h3 className="font-semibold">{currentPuzzle.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Найдите лучший ход, применяя принцип выше.
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
      </div>
    );
  }

  if (view === 'principles' && category) {
    return (
      <div>
        <button
          onClick={() => {
            setView('categories');
            setCategory(null);
          }}
          className="text-[var(--text-secondary)] mb-4"
        >
          ← Все разделы
        </button>

        <h2 className="text-2xl font-bold mb-2">{category.title}</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          {category.principles.length} утверждений · пройдено {categoryProgress(category).done}/
          {categoryProgress(category).total} примеров
        </p>

        <div className="space-y-3">
          {category.principles.map((pr, index) => {
            const done = pr.puzzles.filter((pu) => progress[pu.id]).length;
            return (
              <button
                key={pr.id}
                onClick={() => openPrinciple(pr)}
                className="card w-full text-left hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-[var(--accent)]">#{index + 1}</span>
                    <p className="mt-1 leading-relaxed">{pr.text}</p>
                  </div>
                  <span className="shrink-0 text-sm text-[var(--text-secondary)]">
                    {done}/3
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Учёба</h2>
      <p className="text-[var(--text-secondary)] mb-4">
        {stats.categories} разделов · {stats.principles} шахматных утверждений · {stats.puzzles}{' '}
        примеров-задач · пройдено {solvedCount}/{stats.puzzles}
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по утверждениям..."
        className="w-full max-w-md mb-6 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-gray-700"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const { done, total } = categoryProgress(cat);
          return (
            <button
              key={cat.id}
              onClick={() => openCategory(cat)}
              className="card text-left hover:border-[var(--accent)] transition-colors"
            >
              <h3 className="font-semibold">{cat.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {cat.principles.length} утверждений · {done}/{total} примеров
              </p>
            </button>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <p className="text-[var(--text-secondary)]">Ничего не найдено</p>
      )}
    </div>
  );
}
