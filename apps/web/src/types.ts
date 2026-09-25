export type Side = 'white' | 'black';
export type TrainMode = 'learn' | 'quiz';

export type Alternative = {
  san: string;
  why: string;
};

type MoveBase = {
  san: string;
};

export type OpponentMove = MoveBase & {
  by: 'opponent';
  say: string;
};

export type UserMove = MoveBase & {
  by: 'user';
  say: string;
  hint: string;
  why: string;
  plan?: string;
  alternatives?: Alternative[];
};

export type LineMove = OpponentMove | UserMove;

export type OpeningLine = {
  id: string;
  name: string;
  intro: string;
  summary: string;
  moves: LineMove[];
};

export type Opening = {
  id: string;
  name: string;
  description: string;
  side: Side;
  preview: string;
  lines: OpeningLine[];
};

export type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};
