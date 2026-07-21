export interface StudyPuzzle {
  id: string;
  title: string;
  fen: string;
  /** UCI-ходы через пробел, первый ход — за решающего */
  moves: string;
  explanation: string;
}

export interface StudyPrinciple {
  id: string;
  text: string;
  puzzles: [StudyPuzzle, StudyPuzzle, StudyPuzzle];
}

export interface StudyCategory {
  id: string;
  title: string;
  principles: StudyPrinciple[];
}

export type StudyProgress = Record<string, boolean>;
