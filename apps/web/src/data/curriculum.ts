import type { CurriculumLevel } from '../types';

/** Школьная программа: уровни → треки → уроки (openingId). */
export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 'level-1-open',
    name: 'Уровень 1 · Открытые дебюты',
    description: '1.e4 e5. Сначала спокойная итальянская, потом тактика и соседние схемы.',
    tracks: [
      {
        id: 'track-italian',
        name: 'Итальянская семья',
        description: 'От спокойного центра к двухконям и атаке на f7.',
        openingIds: ['italian', 'two-knights', 'fegatello'],
      },
      {
        id: 'track-other-open',
        name: 'Другие открытые',
        description: 'Шотландская и простая испанская — после итальянской семьи.',
        openingIds: ['scotch', 'spanish'],
      },
    ],
  },
  {
    id: 'level-2-systems',
    name: 'Уровень 2 · Системы',
    description: 'Одна схема на разные ответы: лондонская за белых.',
    tracks: [
      {
        id: 'track-london',
        name: 'Лондонская система',
        description: 'd4, Nf3, Bf4 — мало теории, понятный план.',
        openingIds: ['london'],
      },
    ],
  },
  {
    id: 'level-3-vs-e4',
    name: 'Уровень 3 · Ответ на 1.e4',
    description: 'Крепкие схемы за чёрных и правильный разбор скандинавской за белых.',
    tracks: [
      {
        id: 'track-caro',
        name: 'Каро-Канн',
        description: '1.e4 c6 2.d4 d5 — без сицилианской лавины.',
        openingIds: ['caro'],
      },
      {
        id: 'track-french',
        name: 'Французская защита',
        description: '1.e4 e6 2.d4 d5 — закрытый центр и контригра.',
        openingIds: ['french'],
      },
      {
        id: 'track-scandi',
        name: 'Скандинавская за белых',
        description: 'На …d5 почти всегда бери на d5, не прыгай Nc3 вслепую.',
        openingIds: ['scandinavian'],
      },
    ],
  },
  {
    id: 'level-4-vs-d4',
    name: 'Уровень 4 · Ответ на 1.d4',
    description: 'd5, отказанный гамбит, славянская и ответ на лондонскую.',
    tracks: [
      {
        id: 'track-queens',
        name: 'Против 1.d4',
        description: 'Один ответ d5 на разные планы белых.',
        openingIds: ['queens'],
      },
    ],
  },
];

export function flatLessons(): { levelId: string; trackId: string; openingId: string; indexInTrack: number }[] {
  const result: { levelId: string; trackId: string; openingId: string; indexInTrack: number }[] = [];
  for (const level of CURRICULUM) {
    for (const track of level.tracks) {
      track.openingIds.forEach((openingId, indexInTrack) => {
        result.push({ levelId: level.id, trackId: track.id, openingId, indexInTrack });
      });
    }
  }
  return result;
}

export function findLesson(openingId: string) {
  return flatLessons().find((item) => item.openingId === openingId);
}

export function trackOf(openingId: string) {
  for (const level of CURRICULUM) {
    for (const track of level.tracks) {
      if (track.openingIds.includes(openingId)) {
        return { level, track };
      }
    }
  }
  return null;
}

export function neighborLessons(openingId: string): { prev: string | null; next: string | null } {
  const place = findLesson(openingId);
  if (!place) return { prev: null, next: null };
  const track = CURRICULUM.flatMap((level) => level.tracks).find((item) => item.id === place.trackId);
  if (!track) return { prev: null, next: null };
  const prev = track.openingIds[place.indexInTrack - 1] ?? null;
  const next = track.openingIds[place.indexInTrack + 1] ?? null;
  return { prev, next };
}
