import type { GamesReport } from '../types/gamesReport';

const API = '/api';

export type ChesscomJob = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error' | string;
  stage: string;
  progress: number;
  message: string;
  usernames: string[];
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type SyncOptions = {
  usernames: string[];
  depth?: number;
  maxGames?: number;
  maxPly?: number;
  download?: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data as T;
}

export async function fetchGamesReport(): Promise<GamesReport> {
  const response = await fetch(`${API}/chesscom/report`);
  return readJson<GamesReport>(response);
}

export async function startChesscomSync(options: SyncOptions): Promise<ChesscomJob> {
  const response = await fetch(`${API}/chesscom/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: options.usernames,
      depth: options.depth ?? 12,
      max_games: options.maxGames ?? 60,
      max_ply: options.maxPly ?? 40,
      download: options.download ?? true,
    }),
  });
  return readJson<ChesscomJob>(response);
}

export async function fetchChesscomJob(jobId: string): Promise<ChesscomJob> {
  const response = await fetch(`${API}/chesscom/jobs/${jobId}`);
  return readJson<ChesscomJob>(response);
}
