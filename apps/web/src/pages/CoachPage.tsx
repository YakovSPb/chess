import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api } from '../lib/api';
import { BOT_LEVELS, preloadBotEngine } from '../lib/stockfish';

export function CoachPage() {
  const navigate = useNavigate();
  const [botElo, setBotElo] = useState(1200);
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    preloadBotEngine();
  }, []);

  const startGame = async () => {
    setStarting(true);
    try {
      const game = await api.createGame({
        mode: 'coach',
        bot_elo: botElo,
        player_color: color,
      });
      navigate(`/coach/${game.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Игра с тренером</h2>
      <p className="text-[var(--text-secondary)] mb-6">
        DeepSeek анализирует ваши ходы и объясняет ошибки на русском языке
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Сила соперника</label>
            <div className="grid grid-cols-2 gap-2">
              {BOT_LEVELS.map((level) => (
                <button
                  key={level.elo}
                  onClick={() => setBotElo(level.elo)}
                  className={`p-3 rounded-lg border transition-colors ${
                    botElo === level.elo
                      ? 'border-[var(--accent)] bg-[var(--bg-card)]'
                      : 'border-gray-600'
                  }`}
                >
                  {level.label} ({level.elo})
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setColor('white')}
              className={`btn flex-1 ${color === 'white' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Белые
            </button>
            <button
              onClick={() => setColor('black')}
              className={`btn flex-1 ${color === 'black' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Чёрные
            </button>
          </div>

          <button onClick={startGame} disabled={starting} className="btn btn-primary w-full">
            {starting ? 'Создание...' : 'Начать с тренером'}
          </button>
        </div>

        <div className="flex justify-center items-start">
          <ChessBoardView fen={new Chess().fen()} allowMoves={false} />
        </div>
      </div>
    </div>
  );
}
