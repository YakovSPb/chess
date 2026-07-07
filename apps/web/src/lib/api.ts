const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function parseApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item),
      )
      .join(', ');
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Сервер недоступен. Запустите API: docker-compose up -d');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const message = parseApiError(err.detail, res.statusText);
    if (res.status === 401) {
      throw new Error(message === 'Invalid credentials' ? 'Неверный логин или пароль' : message);
    }
    throw new Error(message || 'Request failed');
  }
  return res.json();
}

export interface User {
  id: number;
  username: string;
  email: string;
  puzzle_rating: number;
  puzzle_streak: number;
}

export interface Game {
  id: number;
  mode: string;
  bot_elo: number | null;
  time_control: string | null;
  pgn: string;
  result: string | null;
  player_color: string;
  analysis: GameAnalysis | null;
  coach_summary: string | null;
  created_at: string;
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  accuracy: number;
  evalHistory: number[];
}

export interface MoveAnalysis {
  moveNumber: number;
  moveSan: string;
  evalBefore: number;
  evalAfter: number;
  bestMove: string | null;
  cplLoss: number;
  classification: string;
}

export interface Puzzle {
  id: number;
  lichess_id: string;
  fen: string;
  rating: number;
  themes: string;
  moves?: string;
  solved?: boolean;
}

export interface PuzzleLevel {
  id: string;
  label: string;
  min_rating: number;
  max_rating: number;
  total: number;
  solved: number;
}

export interface PuzzleListItem {
  id: number;
  lichess_id: string;
  rating: number;
  themes: string;
  solved: boolean;
  index: number;
}

export interface Lesson {
  id: number;
  title: string;
  category: string;
  description: string;
  difficulty: number;
  steps_count: number;
}

export interface LessonDetail extends Lesson {
  steps: Array<{
    fen: string;
    expected_move: string;
    explanation: string;
  }>;
}

export interface Opening {
  id: number;
  title: string;
  eco: string;
  description: string;
  popularity: number;
  player_color: 'white' | 'black';
  steps_count: number;
  completed: boolean;
}

export interface OpeningPro {
  title: string;
  benefit: string;
  development: string;
}

export interface OpeningDetail extends Opening {
  steps: Array<{
    actor: 'user' | 'bot';
    expected_move: string;
    explanation: string;
  }>;
  pros: OpeningPro[];
  cons: string[];
}

export interface DashboardStats {
  puzzle_rating: number;
  puzzle_streak: number;
  games_played: number;
  avg_accuracy: number | null;
  weak_themes: string[];
  recommendation: string;
  recent_games: Game[];
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/auth/me'),

  getGames: () => request<Game[]>('/games'),

  createGame: (data: { mode: string; bot_elo?: number; time_control?: string; player_color?: string }) =>
    request<Game>('/games', { method: 'POST', body: JSON.stringify(data) }),

  updateGame: (id: number, data: Partial<Game>) =>
    request<Game>(`/games/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getGame: (id: number) => request<Game>(`/games/${id}`),

  getPuzzleThemes: () => request<Array<{ id: string; label: string }>>('/puzzles/themes'),

  getPuzzleLevels: () => request<PuzzleLevel[]>('/puzzles/levels'),

  getPuzzlesByLevel: (levelId: string) => request<PuzzleListItem[]>(`/puzzles/level/${levelId}`),

  getPuzzle: (id: number) => request<Puzzle>(`/puzzles/${id}`),

  getDailyPuzzle: () => request<Puzzle>('/puzzles/daily'),

  getNextPuzzle: (rating?: number, theme?: string) => {
    const params = new URLSearchParams();
    if (rating) params.set('rating', String(rating));
    if (theme) params.set('theme', theme);
    return request<Puzzle>(`/puzzles/next?${params}`);
  },

  solvePuzzle: (id: number, moves: string[], timeMs?: number) =>
    request<{ correct: boolean; puzzle_rating_change: number; new_rating: number; streak: number }>(
      `/puzzles/${id}/solve`,
      { method: 'POST', body: JSON.stringify({ moves, time_ms: timeMs }) }
    ),

  coachHint: (data: {
    fen: string;
    last_move?: string;
    eval_cp?: number;
    best_line?: string[];
    hint_level?: number;
    user_rating?: number;
  }) => request<{ message: string }>('/coach/hint', { method: 'POST', body: JSON.stringify(data) }),

  coachExplainMove: (data: {
    fen: string;
    move_san: string;
    eval_before: number;
    eval_after: number;
    best_move?: string;
    best_line?: string[];
    user_rating?: number;
  }) => request<{ message: string }>('/coach/explain-move', { method: 'POST', body: JSON.stringify(data) }),

  coachSummarize: (pgn: string, analysisSummary: string) =>
    request<{ message: string }>('/coach/summarize-game', {
      method: 'POST',
      body: JSON.stringify({ pgn, analysis_summary: analysisSummary }),
    }),

  getDashboard: () => request<DashboardStats>('/stats/dashboard'),

  getLessons: () => request<Lesson[]>('/lessons'),

  getLesson: (id: number) => request<LessonDetail>(`/lessons/${id}`),

  updateLessonProgress: (id: number, currentStep: number, completed: boolean) =>
    request<{ ok: boolean }>(`/lessons/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ current_step: currentStep, completed }),
    }),

  explainLessonStep: (id: number, fen: string, expectedMove: string, explanation: string) =>
    request<{ message: string }>(`/lessons/${id}/explain`, {
      method: 'POST',
      body: JSON.stringify({ fen, expected_move: expectedMove, explanation }),
    }),

  coachChat: (data: {
    message: string;
    page?: string;
    fen?: string;
    details?: string;
    player_color?: 'white' | 'black';
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) =>
    request<{ message: string }>('/coach/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOpenings: () => request<Opening[]>('/openings'),

  getOpening: (id: number) => request<OpeningDetail>(`/openings/${id}`),

  updateOpeningProgress: (id: number, currentStep: number, completed: boolean) =>
    request<{ ok: boolean }>(`/openings/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ current_step: currentStep, completed }),
    }),
};
