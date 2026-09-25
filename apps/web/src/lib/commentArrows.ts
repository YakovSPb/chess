import { Chess, type Square } from 'chess.js';
import type { BoardArrow, CommentBoard, MoveMark } from '../types';

const MOVE = '#f6c445';
const HOLD = '#3ecf8e';

const CENTER = new Set([
  'c3', 'd3', 'e3', 'f3',
  'c4', 'd4', 'e4', 'f4',
  'c5', 'd5', 'e5', 'f5',
  'c6', 'd6', 'e6', 'f6',
]);

const FILES = 'abcdefgh';

const TOKEN_SOURCE =
  '\\b(?:O-O-O|O-O|[NBRQK][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|[a-h][1-8])(?:=[NBRQ])?\\b';

const CONTROL = /держ|защи|напад|напал|смотрит|смотрят|бь[её]т|бь[её]м|атак|контрол|занима/i;
const NEGATED_CONTROL = /не\s+(?:держ|защи|напад|смотрит|бь|атак|контрол|занима)/i;
const MOVE_VERB = /сыгра|ответил|поставил|вывел|выведи|забира|начина|приш[её]л|ид[её]т на|поставь/i;
const NEGATED_MOVE = /не\s+(?:трог|играем|ходи|ставь|бер[её]м)/i;
const PRONOUN = /(?:^|[^\p{L}])(?:он|она|они)(?:[^\p{L}]|$)/iu;

function tokens(sentence: string): string[] {
  return sentence.match(new RegExp(TOKEN_SOURCE, 'g')) ?? [];
}

function isApplied(board: CommentBoard): boolean {
  if (!board.focus) return false;
  return board.played.some(
    (mark) => mark.san === board.focus?.san && mark.from === board.focus.from && mark.to === board.focus.to,
  );
}

function resolveSan(token: string, board: CommentBoard): MoveMark | null {
  if (board.focus?.san === token) return board.focus;
  for (let index = board.played.length - 1; index >= 0; index -= 1) {
    if (board.played[index].san === token) return board.played[index];
  }
  return null;
}

function destination(token: string): string | null {
  const match = token.match(/([a-h][1-8])(?:=[NBRQ])?$/);
  return match ? match[1] : null;
}

function namedSquare(sentence: string): string | null {
  const named = sentence.match(
    /(?:кон[а-яё]*|слон[а-яё]*|ладь[а-яё]*|ферз[а-яё]*|пешк[а-яё]*|корол[а-яё]*)\s+на\s+([a-h][1-8])/i,
  );
  return named ? named[1] : null;
}

function isSquareMention(sentence: string, token: string): boolean {
  if (!/^[a-h][1-8]$/.test(token)) return false;
  const pattern = new RegExp(
    `(?:на|пешк[а-яё]*|пол[ея][а-яё]*|клетк[а-яё]*)\\s+${token}\\b`,
    'i',
  );
  return pattern.test(sentence);
}

function originSquare(sentence: string): string | null {
  const origin = sentence.match(/(?:^|\s)с\s+([a-h][1-8])/i);
  return origin ? origin[1] : null;
}

function moveOnto(square: string, board: CommentBoard): MoveMark | null {
  if (board.focus?.to === square) return board.focus;
  for (let index = board.played.length - 1; index >= 0; index -= 1) {
    if (board.played[index].to === square) return board.played[index];
  }
  if (board.focus?.from === square) return board.focus;
  return null;
}

function squareAt(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}`;
}

function attacksOf(chess: Chess, square: string): string[] {
  const piece = chess.get(square as Square);
  if (!piece) return [];
  const file = FILES.indexOf(square[0] ?? '');
  const rank = Number(square[1]);
  const squares: string[] = [];

  const push = (nextFile: number, nextRank: number) => {
    const next = squareAt(nextFile, nextRank);
    if (next) squares.push(next);
  };

  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1;
    push(file - 1, rank + direction);
    push(file + 1, rank + direction);
    return squares;
  }

  if (piece.type === 'n') {
    const jumps = [
      [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
    ] as const;
    for (const [fileDelta, rankDelta] of jumps) push(file + fileDelta, rank + rankDelta);
    return squares;
  }

  const rays =
    piece.type === 'b'
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : piece.type === 'r'
        ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const limit = piece.type === 'k' ? 1 : 7;

  for (const [fileDelta, rankDelta] of rays) {
    for (let step = 1; step <= limit; step += 1) {
      const next = squareAt(file + fileDelta * step, rank + rankDelta * step);
      if (!next) break;
      squares.push(next);
      if (chess.get(next as Square)) break;
    }
  }

  return squares;
}

function positionForArrows(board: CommentBoard): Chess {
  const chess = new Chess(board.fen);
  if (!board.focus || isApplied(board)) return chess;
  try {
    chess.move({ from: board.focus.from as Square, to: board.focus.to as Square });
  } catch {
    return new Chess(board.fen);
  }
  return chess;
}

function moveArrow(mark: MoveMark): BoardArrow {
  return { startSquare: mark.from, endSquare: mark.to, color: MOVE };
}

function unique(arrows: BoardArrow[]): BoardArrow[] {
  const seen = new Set<string>();
  const result: BoardArrow[] = [];
  for (const arrow of arrows) {
    if (arrow.startSquare === arrow.endSquare) continue;
    const key = `${arrow.color}:${arrow.startSquare}:${arrow.endSquare}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(arrow);
  }
  return result;
}

export function arrowsForSentence(sentence: string, board: CommentBoard | undefined): BoardArrow[] {
  if (!board) return [];
  const text = sentence.trim();
  if (!text) return [];

  const found = tokens(text);
  const marks = found
    .filter((token) => !isSquareMention(text, token))
    .map((token) => resolveSan(token, board))
    .filter((mark): mark is MoveMark => mark !== null);
  const control = CONTROL.test(text) && !NEGATED_CONTROL.test(text);

  if (control) {
    const focusHit =
      board.focus !== null && found.some((token) => token === board.focus?.san || token === board.focus?.to);
    let subject =
      namedSquare(text) ??
      (focusHit ? board.focus?.to : undefined) ??
      originSquare(text) ??
      (PRONOUN.test(text) ? board.focus?.to : undefined);
    if (!subject && board.focus && /центр|занима/.test(text)) subject = board.focus.to;
    if (!subject) return unique(marks.map(moveArrow));

    const attacks = attacksOf(positionForArrows(board), subject);
    const mentioned = found
      .map(destination)
      .filter((square): square is string => square !== null && square !== subject);
    const wantsCenter = /центр/.test(text);
    let targets = mentioned.filter((square) => attacks.includes(square));
    if (targets.length === 0 && wantsCenter) targets = attacks.filter((square) => CENTER.has(square));
    if (targets.length === 0 && mentioned.length === 0) targets = attacks.slice(0, 4);

    const arrows = targets.slice(0, 6).map((square) => ({
      startSquare: subject,
      endSquare: square,
      color: HOLD,
    }));
    const focus = board.focus;
    const aboutFocus = focus !== null && (subject === focus.to || marks.some((mark) => mark.san === focus.san));
    if (focus && aboutFocus) arrows.unshift(moveArrow(focus));
    else if (MOVE_VERB.test(text)) {
      const placed = marks.filter((mark) => mark.to === subject);
      if (placed.length === 0 && focus && subject === focus.to) placed.push(focus);
      for (const mark of placed) arrows.unshift(moveArrow(mark));
    }
    return unique(arrows);
  }

  if (NEGATED_MOVE.test(text)) return [];

  const arrows = marks.map(moveArrow);
  const focus = board.focus;
  if (
    focus &&
    !isApplied(board) &&
    /первый ход/i.test(text) &&
    !arrows.some((arrow) => arrow.startSquare === focus.from && arrow.endSquare === focus.to)
  ) {
    arrows.unshift(moveArrow(focus));
  }
  if (arrows.length === 0 && focus && (MOVE_VERB.test(text) || /рокир/i.test(text))) {
    arrows.push(moveArrow(focus));
  }
  if (arrows.length === 0) {
    const placed = namedSquare(text) ?? originSquare(text);
    const mark = placed ? moveOnto(placed, board) : null;
    if (mark) arrows.push(moveArrow(mark));
  }
  if (arrows.length === 0 && focus && PRONOUN.test(text)) arrows.push(moveArrow(focus));
  return unique(arrows);
}

export function splitComment(text: string): string[] {
  return text.split(/(\n+|(?<=[.!?])\s+)/);
}
