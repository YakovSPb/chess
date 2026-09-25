const STORAGE_KEY = 'opening-srs-v1';
const INTERVALS_DAYS = [1, 3, 7, 16, 35];
const DAY_MS = 24 * 60 * 60 * 1000;

export type SrsEntry = {
  step: number;
  dueAt: number;
  lapses: number;
};

function readAll(): Record<string, SrsEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, SrsEntry>;
  } catch {
    return {};
  }
}

function writeAll(entries: Record<string, SrsEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Прогресс необязателен: тренировка работает и без хранилища.
  }
}

export function getSrs(lineId: string): SrsEntry | null {
  return readAll()[lineId] ?? null;
}

export function recordAttempt(lineId: string, correct: boolean) {
  const all = readAll();
  const prev = all[lineId] ?? { step: 0, dueAt: 0, lapses: 0 };
  if (correct) {
    const step = Math.min(prev.step, INTERVALS_DAYS.length - 1);
    all[lineId] = {
      step: Math.min(step + 1, INTERVALS_DAYS.length - 1),
      dueAt: Date.now() + INTERVALS_DAYS[step] * DAY_MS,
      lapses: prev.lapses,
    };
  } else {
    all[lineId] = {
      step: 0,
      dueAt: Date.now() + DAY_MS,
      lapses: prev.lapses + 1,
    };
  }
  writeAll(all);
}

export function isDue(lineId: string, now = Date.now()): boolean {
  const entry = getSrs(lineId);
  if (!entry?.dueAt) return false;
  return entry.dueAt <= now;
}

export function dueLabel(lineId: string, now = Date.now()): string {
  const entry = getSrs(lineId);
  if (!entry?.dueAt) return 'ещё не проходил';
  const diff = entry.dueAt - now;
  if (diff <= 0) return 'пора повторить';
  const days = Math.ceil(diff / DAY_MS);
  if (days <= 1) return 'повтор завтра';
  return `повтор через ${days} дн.`;
}
