import type { StudyProgress } from '../data/study/types';

const STORAGE_KEY = 'study-progress';

export function loadStudyProgress(): StudyProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StudyProgress;
  } catch {
    return {};
  }
}

export function saveStudyProgress(progress: StudyProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function markPuzzleSolved(puzzleId: string): StudyProgress {
  const progress = { ...loadStudyProgress(), [puzzleId]: true };
  saveStudyProgress(progress);
  return progress;
}
