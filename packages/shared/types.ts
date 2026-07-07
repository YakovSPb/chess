export type MoveClassification =
  | "brilliant"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveAnalysis {
  moveNumber: number;
  moveSan: string;
  evalBefore: number;
  evalAfter: number;
  bestMove: string | null;
  cplLoss: number;
  classification: MoveClassification;
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  accuracy: number;
  evalHistory: number[];
}

export const BOT_LEVELS = [
  { label: "Новичок", elo: 800 },
  { label: "Начинающий", elo: 1200 },
  { label: "Любитель", elo: 1600 },
  { label: "Кандидат", elo: 2000 },
  { label: "Мастер", elo: 2400 },
  { label: "Гроссмейстер", elo: 2800 },
] as const;

export const TIME_CONTROLS = [
  { label: "Без часов", value: "none" },
  { label: "3+2", value: "3+2" },
  { label: "5+0", value: "5+0" },
  { label: "10+0", value: "10+0" },
] as const;

export function classifyMove(cplLoss: number): MoveClassification {
  if (cplLoss <= 10) return "good";
  if (cplLoss <= 50) return "inaccuracy";
  if (cplLoss <= 100) return "mistake";
  return "blunder";
}

export function computeAccuracy(moves: MoveAnalysis[]): number {
  if (moves.length === 0) return 100;
  const weights = moves.map((m) => {
    const w = Math.max(0, 1 - m.cplLoss / 500);
    return w;
  });
  return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100);
}

export const THEME_LABELS: Record<string, string> = {
  fork: "Вилка",
  pin: "Связка",
  mateIn1: "Мат в 1",
  mateIn2: "Мат в 2",
  mateIn3: "Мат в 3",
  backRankMate: "Мат на последней горизонтали",
  discoveredAttack: "Вскрытое нападение",
  sacrifice: "Жертва",
  deflection: "Отвлечение",
  skewer: "Рентген",
  hangingPiece: "Незащищённая фигура",
  trappedPiece: "Запертая фигура",
  advancedPawn: "Проходная пешка",
  endgame: "Эндшпиль",
  opening: "Дебют",
  middlegame: "Миттельшпиль",
};
