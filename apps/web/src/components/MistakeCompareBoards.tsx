import { useMemo, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from './ChessBoardView';
import { expectedSquares } from '../lib/line';
import type { BoardArrow } from '../types';

const PLAYED_FROM: CSSProperties = { backgroundColor: 'rgba(244, 67, 54, 0.45)' };
const PLAYED_TO: CSSProperties = { backgroundColor: 'rgba(244, 67, 54, 0.3)' };
const BEST_FROM: CSSProperties = { backgroundColor: 'rgba(62, 207, 142, 0.5)' };
const BEST_TO: CSSProperties = { backgroundColor: 'rgba(62, 207, 142, 0.32)' };

type MistakeCompareBoardsProps = {
  fen: string;
  played: string;
  best: string;
  boardWidth?: number;
  className?: string;
};

function orientationFromFen(fen: string): 'white' | 'black' {
  return fen.includes(' w ') ? 'white' : 'black';
}

function moveStyles(fen: string, san: string, fromStyle: CSSProperties, toStyle: CSSProperties) {
  const squares = expectedSquares(fen, san);
  if (!squares) return {} as Record<string, CSSProperties>;
  return {
    [squares.from]: fromStyle,
    [squares.to]: toStyle,
  };
}

function moveArrow(fen: string, san: string, color: string): BoardArrow[] {
  const squares = expectedSquares(fen, san);
  if (!squares) return [];
  return [{ startSquare: squares.from, endSquare: squares.to, color }];
}

export function MistakeCompareBoards({
  fen,
  played,
  best,
  boardWidth = 200,
  className = '',
}: MistakeCompareBoardsProps) {
  const orientation = useMemo(() => orientationFromFen(fen), [fen]);

  const valid = useMemo(() => {
    try {
      new Chess(fen);
      return Boolean(expectedSquares(fen, played) || expectedSquares(fen, best));
    } catch {
      return false;
    }
  }, [fen, played, best]);

  const playedStyles = useMemo(
    () => moveStyles(fen, played, PLAYED_FROM, PLAYED_TO),
    [fen, played]
  );
  const bestStyles = useMemo(() => moveStyles(fen, best, BEST_FROM, BEST_TO), [fen, best]);
  const playedArrows = useMemo(() => moveArrow(fen, played, '#f44336'), [fen, played]);
  const bestArrows = useMemo(() => moveArrow(fen, best, '#3ecf8e'), [fen, best]);

  if (!valid) return null;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm">
          <span className="text-red-400">Вы так</span>
          <span className="ml-2 font-mono">{played}</span>
        </figcaption>
        <ChessBoardView
          fen={fen}
          orientation={orientation}
          allowMoves={false}
          boardWidth={boardWidth}
          squareStyles={playedStyles}
          arrows={playedArrows}
        />
      </figure>
      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm">
          <span className="text-emerald-400">Надо было так</span>
          <span className="ml-2 font-mono">{best}</span>
        </figcaption>
        <ChessBoardView
          fen={fen}
          orientation={orientation}
          allowMoves={false}
          boardWidth={boardWidth}
          squareStyles={bestStyles}
          arrows={bestArrows}
        />
      </figure>
    </div>
  );
}
