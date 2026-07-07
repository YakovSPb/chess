import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api } from '../lib/api';
import { BOT_LEVELS, preloadBotEngine } from '../lib/stockfish';

const TIME_CONTROLS = [
  { label: 'Без часов', value: 'none' },
  { label: '3+2', value: '3+2' },
  { label: '5+0', value: '5+0' },
  { label: '10+0', value: '10+0' },
];

export function PlayBotPage() {
  const navigate = useNavigate();
  const [botElo, setBotElo] = useState(1200);
  const [timeControl, setTimeControl] = useState('none');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    preloadBotEngine();
  }, []);

  const startGame = async () => {
    setStarting(true);
    try {
      const game = await api.createGame({
        mode: 'bot',
        bot_elo: botElo,
        time_control: timeControl,
        player_color: color,
      });
      navigate(`/play/${game.id}`, { state: { botElo, color, timeControl } });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Игра с ботом</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Уровень бота</label>
            <div className="grid grid-cols-2 gap-2">
              {BOT_LEVELS.map((level) => (
                <button
                  key={level.elo}
                  onClick={() => setBotElo(level.elo)}
                  className={`p-3 rounded-lg border transition-colors ${
                    botElo === level.elo
                      ? 'border-[var(--accent)] bg-[var(--bg-card)]'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">{level.label}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{level.elo} ELO</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Контроль времени</label>
            <div className="flex gap-2 flex-wrap">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.value}
                  onClick={() => setTimeControl(tc.value)}
                  className={`btn ${timeControl === tc.value ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Ваш цвет</label>
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
          </div>

          <button onClick={startGame} disabled={starting} className="btn btn-primary w-full">
            {starting ? 'Создание...' : 'Начать игру'}
          </button>
        </div>

        <div className="flex justify-center items-start">
          <ChessBoardView fen={new Chess().fen()} allowMoves={false} />
        </div>
      </div>
    </div>
  );
}
