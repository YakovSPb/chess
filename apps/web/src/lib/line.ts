import { Chess, type Move, type Square } from 'chess.js';
import type { LineMove, Side } from '../types';

export function positionAt(moves: LineMove[], ply: number): string {
  const chess = new Chess();
  for (let index = 0; index < ply; index += 1) {
    const played = chess.move(moves[index].san);
    if (!played) {
      throw new Error(`Нелегальный ход ${moves[index].san} на полуходе ${index}`);
    }
  }
  return chess.fen();
}

export function squaresOfPly(moves: LineMove[], ply: number): { from: Square; to: Square } | null {
  if (ply <= 0) return null;
  const chess = new Chess();
  let last: Move | null = null;
  for (let index = 0; index < ply; index += 1) {
    last = chess.move(moves[index].san);
    if (!last) return null;
  }
  if (!last) return null;
  return { from: last.from, to: last.to };
}

export function tryUserMove(fen: string, from: string, to: string, promotion?: string) {
  const chess = new Chess(fen);
  return chess.move({
    from: from as Square,
    to: to as Square,
    promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
  });
}

export function expectedSquares(fen: string, san: string): { from: Square; to: Square } | null {
  const chess = new Chess(fen);
  const played = chess.move(san);
  if (!played) return null;
  return { from: played.from, to: played.to };
}

export function sideToMove(side: Side, by: LineMove['by']): 'w' | 'b' {
  if (by === 'user') return side === 'white' ? 'w' : 'b';
  return side === 'white' ? 'b' : 'w';
}
