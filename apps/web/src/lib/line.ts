import { Chess, type Move, type Square } from 'chess.js';
import type { CommentBoard, LineMove, MoveMark, Side } from '../types';

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

export function moveMarks(moves: LineMove[], ply: number): MoveMark[] {
  const chess = new Chess();
  const marks: MoveMark[] = [];
  const limit = Math.min(ply, moves.length);
  for (let index = 0; index < limit; index += 1) {
    const played = chess.move(moves[index].san);
    if (!played) break;
    marks.push({ san: moves[index].san, from: played.from, to: played.to });
  }
  return marks;
}

export function commentBoard(moves: LineMove[], ply: number, focusSan?: string): CommentBoard {
  const played = moveMarks(moves, ply);
  const fen = positionAt(moves, ply);
  let focus: MoveMark | null = null;
  if (focusSan) {
    for (let index = played.length - 1; index >= 0; index -= 1) {
      if (played[index].san === focusSan) {
        focus = played[index];
        break;
      }
    }
    if (!focus) {
      const squares = expectedSquares(fen, focusSan);
      if (squares) focus = { san: focusSan, from: squares.from, to: squares.to };
    }
  }
  return { fen, focus, played };
}

export function sideToMove(side: Side, by: LineMove['by']): 'w' | 'b' {
  if (by === 'user') return side === 'white' ? 'w' : 'b';
  return side === 'white' ? 'b' : 'w';
}
