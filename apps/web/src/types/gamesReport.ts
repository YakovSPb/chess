export type GameResultBucket = {
  wins: number;
  draws: number;
  losses: number;
};

export type OpeningStat = {
  eco: string;
  name: string;
  side: 'white' | 'black' | string;
  keyMoves: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
  avgLossCp: number;
};

export type MistakeExample = {
  url?: string;
  played: string;
  best: string;
  lossCp: number;
};

export type MistakeStat = {
  id: string;
  fen: string;
  played: string;
  best: string;
  bestUci?: string;
  lossCp: number;
  kind: 'inaccuracy' | 'mistake' | 'blunder' | string;
  phase: 'opening' | 'middlegame' | 'endgame' | string;
  opening: string;
  eco: string;
  side: string;
  count: number;
  tip: string;
  examples: MistakeExample[];
};

export type PlanPriority = {
  title: string;
  why: string;
  action: string;
  mistakeIds: string[];
  tag?: string;
};

export type DevelopmentPlan = {
  headline: string;
  summary: string;
  priorities: PlanPriority[];
  strengths: string[];
  weeklyPlan: string[];
  focusPhase?: string;
  winRate?: number;
};

export type PlayerReport = {
  username: string;
  analyzedGames: number;
  downloadedGames: number;
  results: GameResultBucket;
  openings: OpeningStat[];
  mistakes: MistakeStat[];
  plan?: DevelopmentPlan;
};

export type GamesReport = {
  generatedAt: string | null;
  engineDepth: number;
  maxGamesPerPlayer: number;
  players: PlayerReport[];
  hint?: string;
};
