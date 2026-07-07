import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Game } from '../lib/api';

export function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getGames().then(setGames).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[var(--text-secondary)]">Загрузка...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Мои партии</h2>
      {games.length === 0 ? (
        <p className="text-[var(--text-secondary)]">Партий пока нет</p>
      ) : (
        <div className="space-y-2">
          {games.map((g) => (
            <Link
              key={g.id}
              to={`/games/${g.id}`}
              className="card flex justify-between items-center hover:border-[var(--accent)] transition-colors"
            >
              <div>
                <span className="font-medium">
                  {g.mode === 'coach' ? 'Тренер' : 'Бот'} {g.bot_elo}
                </span>
                <span className="text-[var(--text-secondary)] ml-2">
                  {new Date(g.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {g.analysis?.accuracy !== undefined && (
                  <span className="text-sm">Точность: {Math.round(g.analysis.accuracy)}%</span>
                )}
                <span>{g.result || '—'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
