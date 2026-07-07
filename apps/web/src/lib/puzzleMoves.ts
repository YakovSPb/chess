import { Chess } from 'chess.js';

/** Apply a Lichess UCI move (e.g. e2e4, e7e8q) to the board. */
export function applyUciMove(board: Chess, uci: string): void {
  const normalized = uci.trim().toLowerCase();
  if (normalized.length < 4) {
    throw new Error(`Invalid UCI move: ${uci}`);
  }

  const from = normalized.slice(0, 2);
  const to = normalized.slice(2, 4);
  const promotion = normalized[4] as 'q' | 'r' | 'b' | 'n' | undefined;

  const move = board.move({ from, to, promotion });
  if (!move) {
    throw new Error(`Illegal move: ${uci}`);
  }
}

/** Compare user drag-drop move with expected UCI move. */
export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion || ''}`.toLowerCase();
}

/** Board orientation: solver is the side to move in the starting FEN. */
export function puzzleOrientation(fen: string): 'white' | 'black' {
  const board = new Chess(fen);
  return board.turn() === 'w' ? 'white' : 'black';
}

/** Initialize puzzle board — no auto-setup; FEN already has solver to move. */
export function initPuzzleBoard(fen: string): Chess {
  return new Chess(fen);
}

/** User plays even indices (0, 2, 4…); opponent responses at odd indices are auto-played. */
export function isUserMoveStep(step: number): boolean {
  return step % 2 === 0;
}

export function shouldAutoPlayOpponent(step: number, totalMoves: number): boolean {
  return step % 2 === 0 && step + 1 < totalMoves;
}
