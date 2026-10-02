const STORAGE_KEY = 'opening-srs-v1';
const INTERVALS_DAYS = [1, 3, 7, 16, 35];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Чистых проверок подряд, чтобы линия стала зелёной. */
export const PASS_STREAK = 3;

export type MasteryLevel = 0 | 1 | 2 | 3;

export type SrsEntry = {
  step: number;
  /** Чистые проверки подряд для школы (0…3). Зелёный (=3) фиксируется. */
  streak: number;
  dueAt: number;
  lapses: number;
};

type StoredEntry = Partial<SrsEntry> & {
  step?: number;
  dueAt?: number;
  lapses?: number;
};

function readAll(): Record<string, SrsEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, SrsEntry> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, StoredEntry>)) {
      result[id] = normalizeEntry(value);
    }
    return result;
  } catch {
    return {};
  }
}

/** Старые записи без streak: step >= 1 считались сданными → зелёный. */
function normalizeEntry(raw: StoredEntry | undefined): SrsEntry {
  const step = typeof raw?.step === 'number' ? raw.step : 0;
  const dueAt = typeof raw?.dueAt === 'number' ? raw.dueAt : 0;
  const lapses = typeof raw?.lapses === 'number' ? raw.lapses : 0;
  let streak: number;
  if (typeof raw?.streak === 'number') {
    streak = Math.max(0, Math.min(PASS_STREAK, raw.streak));
  } else if (step >= 1) {
    streak = PASS_STREAK;
  } else {
    streak = 0;
  }
  return { step, streak, dueAt, lapses };
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

export function lineMastery(lineId: string): MasteryLevel {
  const entry = getSrs(lineId);
  if (!entry) return 0;
  return Math.min(PASS_STREAK, entry.streak) as MasteryLevel;
}

export function masteryColorClass(level: MasteryLevel): string {
  if (level >= 3) return 'bg-emerald-500';
  if (level === 2) return 'bg-yellow-400';
  if (level === 1) return 'bg-orange-500';
  return 'bg-[var(--muted-foreground)]/40';
}

export function masteryTextClass(level: MasteryLevel): string {
  if (level >= 3) return 'text-emerald-400';
  if (level === 2) return 'text-yellow-400';
  if (level === 1) return 'text-orange-400';
  return 'text-[var(--muted-foreground)]';
}

export function masteryLabel(level: MasteryLevel): string {
  if (level >= 3) return `зелёный (${PASS_STREAK}/${PASS_STREAK})`;
  if (level === 2) return `жёлтый (2/${PASS_STREAK})`;
  if (level === 1) return `оранжевый (1/${PASS_STREAK})`;
  return `серый (0/${PASS_STREAK})`;
}

/** Короткий текст после чистой проверки. */
export function masteryProgressNote(level: MasteryLevel): string {
  if (level >= 3) return `Линия закреплена: ${masteryLabel(level)}.`;
  if (level === 2) return `${masteryLabel(level)}. Ещё 1 чистая проверка — и линия зелёная.`;
  if (level === 1) return `${masteryLabel(level)}. Ещё 2 чистые проверки подряд — и линия зелёная.`;
  return `Прогресс сброшен: ${masteryLabel(level)}.`;
}

export function recordAttempt(lineId: string, correct: boolean) {
  const all = readAll();
  const prev = all[lineId] ?? { step: 0, streak: 0, dueAt: 0, lapses: 0 };
  if (correct) {
    const step = Math.min(prev.step, INTERVALS_DAYS.length - 1);
    const streak = Math.min(prev.streak + 1, PASS_STREAK);
    all[lineId] = {
      step: Math.min(step + 1, INTERVALS_DAYS.length - 1),
      streak,
      dueAt: Date.now() + INTERVALS_DAYS[step] * DAY_MS,
      lapses: prev.lapses,
    };
  } else {
    // Зелёный фиксируется для школы; интервал повторения сбрасывается.
    const streak = prev.streak >= PASS_STREAK ? PASS_STREAK : 0;
    all[lineId] = {
      step: 0,
      streak,
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
