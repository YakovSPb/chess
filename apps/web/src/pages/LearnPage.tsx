import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api, type Lesson, type LessonDetail } from '../lib/api';
import { usePageContextSync } from '../lib/pageContext';

const CATEGORY_LABELS: Record<string, string> = {
  endgame: 'Эндшпиль',
  tactics: 'Тактика',
};

export function LearnPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selected, setSelected] = useState<LessonDetail | null>(null);
  const [step, setStep] = useState(0);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState('');
  const [feedback, setFeedback] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const lessonDetails = selected
    ? `${selected.title}, шаг ${step + 1}/${selected.steps.length}`
    : 'Список уроков';
  usePageContextSync('Обучение', selected ? fen : undefined, lessonDetails);

  useEffect(() => {
    api.getLessons().then(setLessons);
  }, []);

  const openLesson = async (id: number) => {
    const lesson = await api.getLesson(id);
    setSelected(lesson);
    setStep(0);
    setFeedback('');
    setAiExplanation('');
    if (lesson.steps.length > 0) {
      chess.load(lesson.steps[0].fen);
      setFen(chess.fen());
    }
  };

  const handleMove = (from: string, to: string) => {
    if (!selected) return false;
    const current = selected.steps[step];
    try {
      const move = chess.move({ from, to });
      if (!move) return false;

      const expected = current.expected_move.toLowerCase();
      const played = move.san.toLowerCase();
      const playedUci = `${from}${to}`.toLowerCase();

      if (played !== expected && playedUci !== expected && !expected.includes(played)) {
        chess.undo();
        setFen(chess.fen());
        setFeedback('❌ Неверный ход. Попробуйте снова.');
        return false;
      }

      setFen(chess.fen());
      setFeedback(`✅ ${current.explanation}`);

      if (step + 1 < selected.steps.length) {
        setTimeout(() => {
          const next = step + 1;
          setStep(next);
          chess.load(selected.steps[next].fen);
          setFen(chess.fen());
          setFeedback('');
          setAiExplanation('');
        }, 1500);
      } else {
        api.updateLessonProgress(selected.id, step, true);
        setFeedback('🎉 Урок завершён!');
      }
      return true;
    } catch {
      return false;
    }
  };

  const askDeepSeek = async () => {
    if (!selected) return;
    const current = selected.steps[step];
    setLoadingAi(true);
    try {
      const res = await api.explainLessonStep(
        selected.id,
        current.fen,
        current.expected_move,
        current.explanation
      );
      setAiExplanation(res.message);
    } catch (e) {
      setAiExplanation(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoadingAi(false);
    }
  };

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-[var(--text-secondary)] mb-4">
          ← Все уроки
        </button>
        <h2 className="text-2xl font-bold mb-2">{selected.title}</h2>
        <p className="text-[var(--text-secondary)] mb-4">
          Шаг {step + 1} из {selected.steps.length}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex justify-center min-w-0 w-full">
            <ChessBoardView fen={fen} onMove={handleMove} />
          </div>
          <div className="space-y-4 min-w-0">
            <div className="card">
              <p>{selected.description}</p>
            </div>
            {feedback && <div className="card">{feedback}</div>}
            <button onClick={askDeepSeek} disabled={loadingAi} className="btn btn-secondary w-full">
              {loadingAi ? 'Загрузка...' : 'Спросить DeepSeek подробнее'}
            </button>
            {aiExplanation && (
              <div className="card">
                <h3 className="font-semibold mb-2">DeepSeek</h3>
                <p className="whitespace-pre-wrap break-words">{aiExplanation}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Обучение</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => openLesson(lesson.id)}
            className="card text-left hover:border-[var(--accent)] transition-colors"
          >
            <span className="text-xs text-[var(--accent)]">
              {CATEGORY_LABELS[lesson.category] || lesson.category}
            </span>
            <h3 className="font-semibold mt-1">{lesson.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{lesson.description}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {lesson.steps_count} шагов · Сложность {lesson.difficulty}/3
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
