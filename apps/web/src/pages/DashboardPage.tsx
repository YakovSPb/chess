import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardStats } from '../lib/api';
import { THEME_LABELS } from '../lib/stockfish';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<{ id: number; rating: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
    api.getDailyPuzzle().then((p) => setDailyPuzzle({ id: p.id, rating: p.rating })).catch(() => {});
  }, []);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!stats) return <div className="text-[var(--text-secondary)]">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Главная</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-[var(--text-secondary)] text-sm">Рейтинг задач</p>
          <p className="text-3xl font-bold text-[var(--accent)]">{Math.round(stats.puzzle_rating)}</p>
        </div>
        <div className="card">
          <p className="text-[var(--text-secondary)] text-sm">Серия задач</p>
          <p className="text-3xl font-bold">{stats.puzzle_streak} 🔥</p>
        </div>
        <div className="card">
          <p className="text-[var(--text-secondary)] text-sm">Точность (30 дней)</p>
          <p className="text-3xl font-bold">
            {stats.avg_accuracy !== null ? `${Math.round(stats.avg_accuracy)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold mb-2">Рекомендация на сегодня</h3>
        <p>{stats.recommendation}</p>
        {stats.weak_themes.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Слабые темы: {stats.weak_themes.map((t) => THEME_LABELS[t] || t).join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {dailyPuzzle && (
          <Link to="/puzzles" className="card hover:border-[var(--accent)] transition-colors">
            <h3 className="font-semibold">Задача дня</h3>
            <p className="text-[var(--text-secondary)]">Рейтинг: {dailyPuzzle.rating}</p>
          </Link>
        )}
        <Link to="/coach" className="card hover:border-[var(--accent)] transition-colors">
          <h3 className="font-semibold">Игра с тренером</h3>
          <p className="text-[var(--text-secondary)]">DeepSeek объясняет ваши ходы</p>
        </Link>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Последние партии</h3>
        {stats.recent_games.length === 0 ? (
          <p className="text-[var(--text-secondary)]">Партий пока нет. Начните игру с ботом!</p>
        ) : (
          <div className="space-y-2">
            {stats.recent_games.map((g) => (
              <Link
                key={g.id}
                to={`/games/${g.id}`}
                className="flex justify-between items-center p-2 rounded hover:bg-[var(--bg-card)]"
              >
                <span>
                  {g.mode === 'coach' ? 'Тренер' : 'Бот'} {g.bot_elo} · {g.player_color === 'white' ? 'Белые' : 'Чёрные'}
                </span>
                <span>{g.result || '—'}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
