import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { EvalGraph } from '../components/EvalGraph';
import { api, type Game } from '../lib/api';

const CLASS_LABELS: Record<string, string> = {
  brilliant: 'Блестящий',
  good: 'Хороший',
  book: 'Дебют',
  inaccuracy: 'Неточность',
  mistake: 'Ошибка',
  blunder: 'Зевок',
};

export function GameReportPage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [fen, setFen] = useState(new Chess().fen());

  useEffect(() => {
    if (!id) return;
    api.getGame(parseInt(id, 10)).then((g) => {
      setGame(g);
      if (g.pgn) {
        const chess = new Chess();
        chess.loadPgn(g.pgn);
        setFen(chess.fen());
      }
    });
  }, [id]);

  if (!game) return <p className="text-[var(--text-secondary)]">Загрузка...</p>;

  const analysis = game.analysis;
  const keyMoments = analysis?.moves
    ?.filter((m) => m.classification === 'blunder' || m.classification === 'mistake')
    .slice(0, 3) ?? [];

  return (
    <div>
      <Link to="/games" className="text-[var(--text-secondary)] hover:text-white mb-4 inline-block">
        ← Назад к партиям
      </Link>
      <h2 className="text-2xl font-bold mb-2">Отчёт по партии</h2>
      <p className="text-[var(--text-secondary)] mb-6">
        {game.mode === 'coach' ? 'Тренер' : 'Бот'} {game.bot_elo} · {game.result || '—'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="flex justify-center">
          <ChessBoardView fen={fen} allowMoves={false} orientation={game.player_color as 'white' | 'black'} />
        </div>
        <div className="space-y-4">
          {analysis && (
            <>
              <div className="card">
                <p className="text-[var(--text-secondary)] text-sm">Точность</p>
                <p className="text-4xl font-bold text-[var(--accent)]">{Math.round(analysis.accuracy)}%</p>
              </div>
              <EvalGraph evalHistory={analysis.evalHistory} />
            </>
          )}
        </div>
      </div>

      {analysis && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Классификация ходов</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(
              analysis.moves.reduce<Record<string, number>>((acc, m) => {
                acc[m.classification] = (acc[m.classification] || 0) + 1;
                return acc;
              }, {})
            ).map(([cls, count]) => (
              <div key={cls} className={`classification-${cls}`}>
                {CLASS_LABELS[cls] || cls}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {keyMoments.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Ключевые моменты</h3>
          {keyMoments.map((m, i) => (
            <div key={i} className="mb-2 p-2 bg-[var(--bg-primary)] rounded">
              <span className={`classification-${m.classification} font-medium`}>
                {m.moveSan}
              </span>
              <span className="text-[var(--text-secondary)] ml-2">
                {CLASS_LABELS[m.classification]} · потеря {Math.round(m.cplLoss)} cp
              </span>
              {m.bestMove && (
                <span className="text-sm block">Лучший ход: {m.bestMove}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {game.coach_summary && (
        <div className="card">
          <h3 className="font-semibold mb-2">Резюме тренера (DeepSeek)</h3>
          <p className="whitespace-pre-wrap">{game.coach_summary}</p>
        </div>
      )}

      {game.pgn && (
        <div className="card mt-6">
          <h3 className="font-semibold mb-2">PGN</h3>
          <pre className="text-xs overflow-x-auto text-[var(--text-secondary)]">{game.pgn}</pre>
        </div>
      )}
    </div>
  );
}
