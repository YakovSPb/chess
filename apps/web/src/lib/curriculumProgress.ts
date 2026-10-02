import { CURRICULUM, findLesson, flatLessons, trackOf } from '../data/curriculum';
import { getOpening } from '../data/openings';
import { getSrs } from './srs';
import type { CurriculumLevel, CurriculumTrack, LessonStatus, Opening } from '../types';

const STORAGE_KEY = 'opening-curriculum-v1';

type CurriculumMeta = {
  lastOpeningId?: string;
};

function readMeta(): CurriculumMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CurriculumMeta;
  } catch {
    return {};
  }
}

function writeMeta(meta: CurriculumMeta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function rememberLesson(openingId: string) {
  writeMeta({ ...readMeta(), lastOpeningId: openingId });
}

export function isLinePassed(lineId: string): boolean {
  const entry = getSrs(lineId);
  return Boolean(entry && entry.step >= 1);
}

/** Урок сдан: все линии «за тебя» и «против тебя». */
export function isOpeningCompleted(openingId: string): boolean {
  const opening = getOpening(openingId);
  if (!opening) return false;
  const all = [...opening.lines, ...opening.anti];
  if (all.length === 0) return false;
  return all.every((line) => isLinePassed(line.id));
}

export function openingPassedCount(openingId: string): { done: number; total: number } {
  const opening = getOpening(openingId);
  if (!opening) return { done: 0, total: 0 };
  const all = [...opening.lines, ...opening.anti];
  const done = all.filter((line) => isLinePassed(line.id)).length;
  return { done, total: all.length };
}

export function openingAntiPassedCount(openingId: string): { done: number; total: number } {
  const opening = getOpening(openingId);
  if (!opening) return { done: 0, total: 0 };
  const done = opening.anti.filter((line) => isLinePassed(line.id)).length;
  return { done, total: opening.anti.length };
}

/** Следующая несданная линия: сначала «за тебя», потом «против тебя». */
export function nextUnpassedLine(openingId: string): string | null {
  const opening = getOpening(openingId);
  if (!opening) return null;
  for (const line of opening.lines) {
    if (!isLinePassed(line.id)) return line.id;
  }
  for (const line of opening.anti) {
    if (!isLinePassed(line.id)) return line.id;
  }
  return null;
}

export function isTrackCompleted(track: CurriculumTrack): boolean {
  return track.openingIds.every((id) => isOpeningCompleted(id));
}

export function isLevelCompleted(level: CurriculumLevel): boolean {
  return level.tracks.every((track) => isTrackCompleted(track));
}

function previousTrack(level: CurriculumLevel, trackId: string): CurriculumTrack | null {
  const index = level.tracks.findIndex((track) => track.id === trackId);
  if (index <= 0) return null;
  return level.tracks[index - 1] ?? null;
}

function previousLevel(levelId: string): CurriculumLevel | null {
  const index = CURRICULUM.findIndex((level) => level.id === levelId);
  if (index <= 0) return null;
  return CURRICULUM[index - 1] ?? null;
}

/** Урок открыт только после сдачи предыдущего в цепочке школы. */
export function isOpeningUnlocked(openingId: string): boolean {
  const place = findLesson(openingId);
  if (!place) return true;

  const level = CURRICULUM.find((item) => item.id === place.levelId);
  if (!level) return false;

  const levelIndex = CURRICULUM.findIndex((item) => item.id === level.id);
  if (levelIndex > 0) {
    const prevLevel = CURRICULUM[levelIndex - 1];
    if (!isLevelCompleted(prevLevel)) return false;
  }

  const track = level.tracks.find((item) => item.id === place.trackId);
  if (!track) return false;

  const trackIndex = level.tracks.findIndex((item) => item.id === track.id);
  if (trackIndex > 0) {
    const prev = level.tracks[trackIndex - 1];
    if (!isTrackCompleted(prev)) return false;
  }

  if (place.indexInTrack === 0) return true;
  const prevOpeningId = track.openingIds[place.indexInTrack - 1];
  return isOpeningCompleted(prevOpeningId);
}

export function lessonStatus(openingId: string): LessonStatus {
  if (isOpeningCompleted(openingId)) return 'done';
  if (isOpeningUnlocked(openingId)) return 'open';
  return 'locked';
}

export function unlockHint(openingId: string): string {
  const place = findLesson(openingId);
  if (!place) return 'Урок недоступен.';

  const level = CURRICULUM.find((item) => item.id === place.levelId);
  if (!level) return 'Урок недоступен.';

  const prevLvl = previousLevel(level.id);
  if (prevLvl && !isLevelCompleted(prevLvl)) {
    return `Сначала сдай уровень «${prevLvl.name}».`;
  }

  const track = level.tracks.find((item) => item.id === place.trackId);
  if (!track) return 'Урок недоступен.';

  const prevTr = previousTrack(level, track.id);
  if (prevTr && !isTrackCompleted(prevTr)) {
    return `Сначала закончи трек «${prevTr.name}».`;
  }

  if (place.indexInTrack > 0) {
    const prevId = track.openingIds[place.indexInTrack - 1];
    const prevOpening = getOpening(prevId);
    const progress = openingPassedCount(prevId);
    return `Сначала сдай урок «${prevOpening?.name ?? prevId}»: все линии «за тебя» и «против тебя» в «Проверке» без ошибок (сейчас ${progress.done}/${progress.total}).`;
  }

  return 'Урок пока закрыт.';
}

export function trackProgress(track: CurriculumTrack): { done: number; total: number } {
  const total = track.openingIds.length;
  const done = track.openingIds.filter((id) => isOpeningCompleted(id)).length;
  return { done, total };
}

export function levelProgress(level: CurriculumLevel): { done: number; total: number } {
  const ids = level.tracks.flatMap((track) => track.openingIds);
  const total = ids.length;
  const done = ids.filter((id) => isOpeningCompleted(id)).length;
  return { done, total };
}

export function isLevelUnlocked(level: CurriculumLevel): boolean {
  const index = CURRICULUM.findIndex((item) => item.id === level.id);
  if (index <= 0) return true;
  return isLevelCompleted(CURRICULUM[index - 1]);
}

/** Первый незавершённый открытый урок; иначе последний открытый. */
export function currentLesson(): { opening: Opening; level: CurriculumLevel; track: CurriculumTrack } | null {
  const meta = readMeta();
  if (meta.lastOpeningId && isOpeningUnlocked(meta.lastOpeningId) && !isOpeningCompleted(meta.lastOpeningId)) {
    const opening = getOpening(meta.lastOpeningId);
    const ctx = trackOf(meta.lastOpeningId);
    if (opening && ctx) return { opening, level: ctx.level, track: ctx.track };
  }

  for (const lesson of flatLessons()) {
    if (isOpeningUnlocked(lesson.openingId) && !isOpeningCompleted(lesson.openingId)) {
      const opening = getOpening(lesson.openingId);
      const ctx = trackOf(lesson.openingId);
      if (opening && ctx) return { opening, level: ctx.level, track: ctx.track };
    }
  }

  for (const lesson of [...flatLessons()].reverse()) {
    if (isOpeningUnlocked(lesson.openingId)) {
      const opening = getOpening(lesson.openingId);
      const ctx = trackOf(lesson.openingId);
      if (opening && ctx) return { opening, level: ctx.level, track: ctx.track };
    }
  }

  return null;
}
