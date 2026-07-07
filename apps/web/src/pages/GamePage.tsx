import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoardView } from '../components/ChessBoardView';
import { api, type MoveAnalysis } from '../lib/api';
import {
  botSearchParams,
  classifyMove,
  computeAccuracy,
  evalForPlayer,
  evalToWhitePerspective,
  getBotEngine,
  getEvalEngine,
  preloadBotEngine,
  preloadEvalEngine,
} from '../lib/stockfish';
import { usePageContextSync } from '../lib/pageContext';

interface GamePageProps {
  mode: 'bot' | 'coach';
}

export function GamePage({ mode }: GamePageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [botElo, setBotElo] = useState(1200);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState('');
  const [moves, setMoves] = useState<string[]>([]);
  const [evalCp, setEvalCp] = useState(0);
  const [coachMessage, setCoachMessage] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(1);
  const evalHistory = useRef<number[]>([0]);
  const moveAnalyses = useRef<MoveAnalysis[]>([]);
  const lastEval = useRef(0);
  const pendingBot = useRef(false);
  const gameId = id ? parseInt(id, 10) : 0;

  const gameDetails = `${mode === 'coach' ? 'Тренер' : 'Бот'} ${botElo}, вы играете ${playerColor === 'white' ? 'белыми' : 'чёрными'}${moves.length ? `, ходы: ${moves.join(' ')}` : ''}${status ? ` — ${status}` : ''}`;
  usePageContextSync(mode === 'coach' ? 'Игра с тренером' : 'Игра с ботом', fen, gameDetails);

  useEffect(() => {
    preloadBotEngine();
    preloadEvalEngine();
  }, []);

  const refreshEval = useCallback(
    async (positionFen: string) => {
      try {
        const engine = await getEvalEngine();
        const result = await engine.evaluate(positionFen, 400);
        const playerEval = evalForPlayer(positionFen, result.eval, playerColor);
        setEvalCp(playerEval);
      } catch {
        /* eval optional */
      }
    },
    [playerColor]
  );

  const pickFallbackMove = useCallback((board: Chess): string => {
    const legal = board.moves({ verbose: true });
    if (legal.length === 0) throw new Error('No legal moves');
    const m = legal[Math.floor(Math.random() * legal.length)];
    return `${m.from}${m.to}${m.promotion || ''}`;
  }, []);

  useEffect(() => {
    if (!gameId) return;
    api.getGame(gameId).then((game) => {
      setBotElo(game.bot_elo || 1200);
      setPlayerColor(game.player_color as 'white' | 'black');
      if (game.pgn) {
        chess.loadPgn(game.pgn);
        setFen(chess.fen());
        setMoves(chess.history());
        void refreshEval(chess.fen());
      } else {
        void refreshEval(chess.fen());
      }
    });
  }, [gameId, chess, refreshEval]);

  const isPlayerTurn = useCallback(() => {
    const turn = chess.turn();
    return (playerColor === 'white' && turn === 'w') || (playerColor === 'black' && turn === 'b');
  }, [chess, playerColor]);

  const checkGameOver = useCallback(() => {
    if (chess.isCheckmate()) setStatus('Мат!');
    else if (chess.isDraw()) setStatus('Ничья');
    else if (chess.isCheck()) setStatus('Шах!');
    else setStatus('');
  }, [chess]);

  const finishGame = useCallback(async () => {
    let result = '*';
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'black' : 'white';
      result = winner === playerColor ? '1-0' : '0-1';
      if (playerColor === 'black') result = result === '1-0' ? '0-1' : '1-0';
    } else if (chess.isDraw()) result = '1/2-1/2';

    const accuracy = computeAccuracy(moveAnalyses.current);
    const analysis = {
      moves: moveAnalyses.current,
      accuracy,
      evalHistory: evalHistory.current,
    };

    await api.updateGame(gameId, { pgn: chess.pgn(), result, analysis });

    if (mode === 'coach') {
      const summary = moveAnalyses.current
        .filter((m) => m.classification === 'blunder' || m.classification === 'mistake')
        .map((m) => `Ход ${m.moveSan}: ${m.classification}, потеря ${Math.round(m.cplLoss)}cp`)
        .join('\n');
      try {
        const res = await api.coachSummarize(chess.pgn(), summary || 'Партия без серьёзных ошибок');
        await api.updateGame(gameId, { coach_summary: res.message });
      } catch {
        /* DeepSeek optional */
      }
    }

    navigate(`/games/${gameId}`);
  }, [chess, gameId, mode, navigate, playerColor]);

  const makeBotMove = useCallback(async () => {
    if (chess.isGameOver()) return;
    setThinking(true);
    try {
      const engine = await getBotEngine();
      engine.setStrength(botElo, true);
      const { movetime, depth } = botSearchParams(botElo);
      let moveUci: string;
      try {
        moveUci = await engine.getBestMove(chess.fen(), movetime, depth);
      } catch {
        moveUci = pickFallbackMove(chess);
      }
      chess.move({
        from: moveUci.slice(0, 2),
        to: moveUci.slice(2, 4),
        promotion: moveUci[4] as 'q' | 'r' | 'b' | 'n' | undefined,
      });
      setFen(chess.fen());
      setMoves(chess.history());
      checkGameOver();
      void refreshEval(chess.fen());
      if (chess.isGameOver()) await finishGame();
    } finally {
      setThinking(false);
      pendingBot.current = false;
    }
  }, [botElo, chess, checkGameOver, finishGame, pickFallbackMove, refreshEval]);

  useEffect(() => {
    if (playerColor === 'black' && chess.history().length === 0 && !thinking && !pendingBot.current) {
      pendingBot.current = true;
      void makeBotMove();
    }
  }, [playerColor, chess, makeBotMove, thinking]);

  const analyzeMove = async (moveSan: string, fenAfterMove: string) => {
    const engine = await getEvalEngine();
    const result = await engine.evaluate(fenAfterMove, 400);
    const evalBefore = lastEval.current;
    const evalAfter = evalToWhitePerspective(fenAfterMove, result.eval);
    const cplLoss = Math.abs(evalAfter - evalBefore);
    const analysis: MoveAnalysis = {
      moveNumber: Math.ceil(chess.history().length / 2),
      moveSan,
      evalBefore,
      evalAfter,
      bestMove: result.bestMove,
      cplLoss,
      classification: classifyMove(cplLoss),
    };
    moveAnalyses.current.push(analysis);
    lastEval.current = evalAfter;
    evalHistory.current.push(evalAfter);
    setEvalCp(evalForPlayer(fenAfterMove, result.eval, playerColor));
  };

  const handleMove = (from: string, to: string, promotion?: string) => {
    if (!isPlayerTurn() || thinking) return false;
    try {
      const move = chess.move({ from, to, promotion: promotion as 'q' | undefined });
      if (!move) return false;
      const fenAfterPlayer = chess.fen();
      setFen(fenAfterPlayer);
      setMoves(chess.history());
      checkGameOver();
      void refreshEval(fenAfterPlayer);
      void (async () => {
        if (chess.isGameOver()) {
          if (mode === 'coach') {
            await analyzeMove(move.san, fenAfterPlayer);
          }
          await finishGame();
          return;
        }
        await makeBotMove();
        if (mode === 'coach') {
          void analyzeMove(move.san, fenAfterPlayer);
        }
      })();
      return true;
    } catch {
      return false;
    }
  };

  const requestHint = async () => {
    setCoachLoading(true);
    try {
      const engine = await getEvalEngine();
      const result = await engine.evaluate(chess.fen(), 400);
      const res = await api.coachHint({
        fen: chess.fen(),
        last_move: moves[moves.length - 1],
        eval_cp: result.eval,
        best_line: result.pv,
        hint_level: hintLevel,
      });
      setCoachMessage(res.message);
    } catch (e) {
      setCoachMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setCoachLoading(false);
    }
  };

  const explainLastMove = async () => {
    const last = moveAnalyses.current[moveAnalyses.current.length - 1];
    if (!last) return;
    setCoachLoading(true);
    try {
      const res = await api.coachExplainMove({
        fen: chess.fen(),
        move_san: last.moveSan,
        eval_before: last.evalBefore,
        eval_after: last.evalAfter,
        best_move: last.bestMove || undefined,
      });
      setCoachMessage(res.message);
    } catch (e) {
      setCoachMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setCoachLoading(false);
    }
  };

  const resign = async () => {
    if (confirm('Сдаться?')) {
      const result = playerColor === 'white' ? '0-1' : '1-0';
      await api.updateGame(gameId, { pgn: chess.pgn(), result });
      navigate(`/games/${gameId}`);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        {mode === 'coach' ? 'Игра с тренером' : 'Игра с ботом'} · {botElo} ELO
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex justify-center items-start">
          <ChessBoardView
            fen={fen}
            orientation={playerColor}
            onMove={handleMove}
            allowMoves={isPlayerTurn() && !thinking}
          />
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-[var(--text-secondary)]">Оценка (ваше преимущество)</p>
            <p className="text-2xl font-bold">
              {evalCp > 0 ? '+' : ''}{(evalCp / 100).toFixed(1)}
            </p>
            {status && <p className="text-[var(--accent)]">{status}</p>}
            {thinking && <p className="text-[var(--text-secondary)]">Бот думает...</p>}
          </div>

          <div className="card max-h-48 overflow-y-auto">
            <h3 className="font-semibold mb-2">Ходы</h3>
            <div className="text-sm font-mono">
              {moves.map((m, i) => (
                <span key={i} className="mr-2">
                  {i % 2 === 0 && `${Math.floor(i / 2) + 1}.`}{m}
                </span>
              ))}
            </div>
          </div>

          {mode === 'coach' && (
            <div className="card space-y-2">
              <h3 className="font-semibold">Тренер</h3>
              <div className="flex gap-2">
                <button onClick={() => void requestHint()} disabled={coachLoading} className="btn btn-secondary text-sm flex-1">
                  Подсказка
                </button>
                <button onClick={() => void explainLastMove()} disabled={coachLoading} className="btn btn-secondary text-sm flex-1">
                  Почему плохо?
                </button>
              </div>
              <select
                value={hintLevel}
                onChange={(e) => setHintLevel(Number(e.target.value))}
                className="input text-sm"
              >
                <option value={1}>Подсказка: идея</option>
                <option value={2}>Подсказка: направление</option>
                <option value={3}>Подсказка: точный ход</option>
              </select>
              {coachMessage && (
                <p className="text-sm bg-[var(--bg-primary)] p-3 rounded-lg">{coachMessage}</p>
              )}
            </div>
          )}

          <button onClick={() => void resign()} className="btn btn-secondary w-full">
            Сдаться
          </button>
        </div>
      </div>
    </div>
  );
}
