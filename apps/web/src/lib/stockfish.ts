type StockfishCallback = (message: string) => void;

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private callback: StockfishCallback | null = null;
  private resolveBestMove: ((move: string) => void) | null = null;
  private rejectBestMove: ((reason: Error) => void) | null = null;
  private evalResolve: ((data: { eval: number; bestMove: string; pv: string[] }) => void) | null = null;
  private evalLatest: { eval: number; bestMove: string; pv: string[] } = { eval: 0, bestMove: '', pv: [] };
  private evalTimeout: ReturnType<typeof setTimeout> | null = null;
  private elo = 1200;
  private limitStrength = false;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const wasmSupported =
        typeof WebAssembly === 'object' &&
        WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

      this.worker = new Worker(wasmSupported ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js');

      this.worker.onmessage = (e: MessageEvent<string>) => {
        const msg = e.data;
        this.callback?.(msg);

        if (msg === 'uciok') {
          this.worker?.postMessage('isready');
        }
        if (msg === 'readyok') {
          this.ready = true;
          resolve();
        }
        if (msg.startsWith('bestmove')) {
          const move = msg.split(' ')[1];
          if (this.evalResolve) {
            this.finishEval(this.evalLatest);
          }
          if (this.resolveBestMove) {
            if (move && move !== '(none)') {
              this.resolveBestMove(move);
            } else {
              this.rejectBestMove?.(new Error('no move'));
            }
            this.resolveBestMove = null;
            this.rejectBestMove = null;
          }
        }
        if (msg.includes('score cp')) {
          const cpMatch = msg.match(/score cp (-?\d+)/);
          const pvMatch = msg.match(/ pv (.+)/);
          const cp = cpMatch ? parseInt(cpMatch[1], 10) : 0;
          const pv = pvMatch ? pvMatch[1].split(' ') : [];
          if (this.evalResolve) {
            this.evalLatest = {
              eval: cp,
              bestMove: pv[0] || this.evalLatest.bestMove,
              pv: pv.length > 0 ? pv : this.evalLatest.pv,
            };
          }
        }
        if (msg.includes('score mate')) {
          const mateMatch = msg.match(/score mate (-?\d+)/);
          const pvMatch = msg.match(/ pv (.+)/);
          const mate = mateMatch ? parseInt(mateMatch[1], 10) : 0;
          const cp = mate > 0 ? 10000 - mate * 100 : -10000 - mate * 100;
          const pv = pvMatch ? pvMatch[1].split(' ') : [];
          if (this.evalResolve) {
            this.evalLatest = {
              eval: cp,
              bestMove: pv[0] || this.evalLatest.bestMove,
              pv: pv.length > 0 ? pv : this.evalLatest.pv,
            };
          }
        }
      };

      this.worker.postMessage('uci');
    });

    return this.initPromise;
  }

  setStrength(elo: number, limit = true) {
    this.elo = elo;
    this.limitStrength = limit;
    if (!this.worker || !this.ready) return;
    if (limit) {
      this.worker.postMessage('setoption name UCI_LimitStrength value true');
      this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    } else {
      this.worker.postMessage('setoption name UCI_LimitStrength value false');
      this.worker.postMessage('setoption name Skill Level value 20');
    }
  }

  private finishEval(result: { eval: number; bestMove: string; pv: string[] }) {
    if (this.evalTimeout) {
      clearTimeout(this.evalTimeout);
      this.evalTimeout = null;
    }
    const resolve = this.evalResolve;
    this.evalResolve = null;
    resolve?.(result);
  }

  private prepareSearch(fen: string) {
    this.worker?.postMessage('stop');
    this.worker!.postMessage(`position fen ${fen}`);
  }

  async getBestMove(fen: string, movetimeMs = 250, maxDepth = 6): Promise<string> {
    if (!this.worker) throw new Error('Engine not initialized');
    this.setStrength(this.elo, this.limitStrength);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.worker?.postMessage('stop');
        this.resolveBestMove = null;
        this.rejectBestMove = null;
        reject(new Error('timeout'));
      }, movetimeMs + 400);

      this.resolveBestMove = (move) => {
        clearTimeout(timeout);
        resolve(move);
      };
      this.rejectBestMove = (err) => {
        clearTimeout(timeout);
        reject(err);
      };

      this.prepareSearch(fen);
      this.worker!.postMessage(`go movetime ${movetimeMs} depth ${maxDepth}`);
    });
  }

  async evaluate(
    fen: string,
    movetimeMs = 400,
  ): Promise<{ eval: number; bestMove: string; pv: string[] }> {
    if (!this.worker) throw new Error('Engine not initialized');

    const prevLimit = this.limitStrength;
    this.setStrength(this.elo, false);

    return new Promise((resolve) => {
      this.evalLatest = { eval: 0, bestMove: '', pv: [] };
      this.evalResolve = resolve;
      this.prepareSearch(fen);
      this.worker!.postMessage(`go movetime ${movetimeMs}`);
      this.evalTimeout = setTimeout(() => {
        this.worker?.postMessage('stop');
        this.finishEval(this.evalLatest);
      }, movetimeMs + 500);
    }).finally(() => {
      this.setStrength(this.elo, prevLimit);
    }) as Promise<{ eval: number; bestMove: string; pv: string[] }>;
  }

  stop() {
    this.worker?.postMessage('stop');
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
  }
}

let botEngineInstance: StockfishEngine | null = null;
let evalEngineInstance: StockfishEngine | null = null;

/** Dedicated engine for bot moves — never blocked by analysis. */
export async function getBotEngine(): Promise<StockfishEngine> {
  if (!botEngineInstance) {
    botEngineInstance = new StockfishEngine();
    await botEngineInstance.init();
  }
  return botEngineInstance;
}

/** Separate engine for eval / coach hints. */
export async function getEvalEngine(): Promise<StockfishEngine> {
  if (!evalEngineInstance) {
    evalEngineInstance = new StockfishEngine();
    await evalEngineInstance.init();
  }
  return evalEngineInstance;
}

/** @deprecated use getBotEngine or getEvalEngine */
export async function getEngine(): Promise<StockfishEngine> {
  return getBotEngine();
}

/** Preload bot WASM in background so the first move is instant. */
export function preloadBotEngine(): void {
  void getBotEngine();
}

export function preloadEvalEngine(): void {
  void getEvalEngine();
}

/** Stockfish cp is from side-to-move; convert to white's perspective. */
export function evalToWhitePerspective(fen: string, cp: number): number {
  const turn = fen.split(' ')[1];
  return turn === 'b' ? -cp : cp;
}

/** Eval from the player's perspective (+ = player is better). */
export function evalForPlayer(fen: string, cp: number, playerColor: 'white' | 'black'): number {
  const whiteEval = evalToWhitePerspective(fen, cp);
  return playerColor === 'white' ? whiteEval : -whiteEval;
}

export function classifyMove(cplLoss: number): string {
  if (cplLoss <= 10) return 'good';
  if (cplLoss <= 50) return 'inaccuracy';
  if (cplLoss <= 100) return 'mistake';
  return 'blunder';
}

export function computeAccuracy(moves: Array<{ cplLoss: number }>): number {
  if (moves.length === 0) return 100;
  const weights = moves.map((m) => Math.max(0, 1 - m.cplLoss / 500));
  return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100);
}

export const BOT_LEVELS = [
  { label: 'Новичок', elo: 800 },
  { label: 'Начинающий', elo: 1200 },
  { label: 'Любитель', elo: 1600 },
  { label: 'Кандидат', elo: 2000 },
  { label: 'Мастер', elo: 2400 },
  { label: 'Гроссмейстер', elo: 2800 },
];

export function botSearchParams(elo: number): { movetime: number; depth: number } {
  if (elo <= 800) return { movetime: 120, depth: 4 };
  if (elo <= 1200) return { movetime: 180, depth: 5 };
  if (elo <= 1600) return { movetime: 250, depth: 6 };
  if (elo <= 2000) return { movetime: 350, depth: 7 };
  if (elo <= 2400) return { movetime: 450, depth: 8 };
  return { movetime: 550, depth: 9 };
}

/** @deprecated use botSearchParams */
export function botThinkTime(elo: number): number {
  return botSearchParams(elo).movetime;
}

export const THEME_LABELS: Record<string, string> = {
  fork: 'Вилка',
  pin: 'Связка',
  mateIn1: 'Мат в 1',
  mateIn2: 'Мат в 2',
  mateIn3: 'Мат в 3',
  backRankMate: 'Мат на последней горизонтали',
  discoveredAttack: 'Вскрытое нападение',
  sacrifice: 'Жертва',
  deflection: 'Отвлечение',
  skewer: 'Рентген',
  endgame: 'Эндшпиль',
  opening: 'Дебют',
  middlegame: 'Миттельшпиль',
};
