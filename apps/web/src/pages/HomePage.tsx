import { Link } from 'react-router-dom';
import { CURRICULUM } from '../data/curriculum';
import { getOpening } from '../data/openings';
import {
  currentLesson,
  isLevelUnlocked,
  lessonStatus,
  levelProgress,
  openingAntiPassedCount,
  openingPassedCount,
  trackProgress,
  unlockHint,
} from '../lib/curriculumProgress';
import {
  PASS_STREAK,
  dueLabel,
  isDue,
  lineMastery,
  masteryColorClass,
  masteryLabel,
} from '../lib/srs';
import type { CurriculumLevel, CurriculumTrack, LessonStatus, Opening } from '../types';

export function HomePage() {
  const dueCount = CURRICULUM.reduce((sum, level) => {
    return (
      sum +
      level.tracks.reduce((trackSum, track) => {
        return (
          trackSum +
          track.openingIds.reduce((openingSum, openingId) => {
            const opening = getOpening(openingId);
            if (!opening) return openingSum;
            return (
              openingSum +
              [...opening.lines, ...opening.anti].filter((line) => isDue(line.id)).length
            );
          }, 0)
        );
      }, 0)
    );
  }, 0);

  const current = currentLesson();

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-semibold">Школа дебютов</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
              Семейные блоки: сначала все варианты и фишки одного дебюта (за тебя и против тебя),
              потом следующий дебют. Линия: {PASS_STREAK} чистые «Проверки» подряд —
              оранжевый → жёлтый → зелёный; зелёный фиксируется.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/games"
              className="rounded-lg border border-[var(--chat-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
            >
              Мои партии
            </Link>
            <Link
              to="/review"
              className="rounded-lg border border-[var(--chat-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
            >
              Повторение{dueCount > 0 ? ` · ${dueCount}` : ''}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {current && (
          <section className="rounded-xl border border-[var(--accent)]/40 bg-[var(--card-bg)] p-4">
            <p className="text-xs font-medium tracking-wide text-[var(--accent)] uppercase">Сейчас</p>
            <h2 className="mt-1 text-lg font-semibold">
              {current.level.name} · {current.opening.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Трек «{current.track.name}». {current.opening.description}
            </p>
            <Link
              to={`/openings/${current.opening.id}?line=${current.opening.lines[0]?.id}&mode=learn`}
              className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Продолжить урок
            </Link>
          </section>
        )}

        {CURRICULUM.map((level) => (
          <LevelBlock key={level.id} level={level} />
        ))}
      </main>
    </div>
  );
}

function LevelBlock({ level }: { level: CurriculumLevel }) {
  const unlocked = isLevelUnlocked(level);
  const progress = levelProgress(level);

  return (
    <section className={!unlocked ? 'opacity-60' : ''}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            {level.name}
            {!unlocked ? ' · закрыт' : ''}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{level.description}</p>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {progress.done}/{progress.total} уроков
        </p>
      </div>
      {!unlocked && (
        <p className="mb-3 rounded-lg border border-dashed border-[var(--chat-border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
          Сначала закрой предыдущий уровень.
        </p>
      )}
      <div className="flex flex-col gap-4">
        {level.tracks.map((track) => (
          <TrackBlock key={track.id} track={track} levelLocked={!unlocked} />
        ))}
      </div>
    </section>
  );
}

function TrackBlock({ track, levelLocked }: { track: CurriculumTrack; levelLocked: boolean }) {
  const progress = trackProgress(track);
  return (
    <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{track.name}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">{track.description}</p>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {progress.done}/{progress.total}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {track.openingIds.map((openingId, index) => {
          const opening = getOpening(openingId);
          if (!opening) return null;
          return (
            <LessonCard
              key={openingId}
              opening={opening}
              index={index}
              status={levelLocked ? 'locked' : lessonStatus(openingId)}
            />
          );
        })}
      </div>
    </div>
  );
}

function LessonCard({
  opening,
  index,
  status,
}: {
  opening: Opening;
  index: number;
  status: LessonStatus;
}) {
  const passed = openingPassedCount(opening.id);
  const antiPassed = openingAntiPassedCount(opening.id);
  const first = opening.lines[0];
  const anti = opening.anti[0];
  const locked = status === 'locked';
  const done = status === 'done';

  return (
    <article
      className={`flex w-72 shrink-0 flex-col rounded-lg border p-3 ${
        locked
          ? 'border-[var(--chat-border)] bg-[var(--background)]'
          : done
            ? 'border-emerald-500/40 bg-[var(--background)]'
            : 'border-[var(--accent)]/50 bg-[var(--background)]'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-xs text-[var(--muted-foreground)]">Урок {index + 1}</p>
        <StatusBadge status={status} />
      </div>
      <h4 className="font-medium">{opening.name}</h4>
      <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{opening.preview}</p>
      <p className="mt-2 line-clamp-3 text-sm text-[var(--muted-foreground)]">{opening.description}</p>
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" title="Прогресс линий: серый → оранжевый → жёлтый → зелёный">
          {[...opening.lines, ...opening.anti].map((line) => {
            const level = lineMastery(line.id);
            return (
              <span
                key={line.id}
                title={`${line.name}: ${masteryLabel(level)}`}
                className={`inline-block h-2.5 w-2.5 rounded-full ${masteryColorClass(level)}`}
              />
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Зелёных: {passed.done}/{passed.total}
        {antiPassed.total > 0
          ? ` (за тебя ${passed.done - antiPassed.done}/${passed.total - antiPassed.total}, против ${antiPassed.done}/${antiPassed.total})`
          : ''}
        {!done && !locked && passed.done < passed.total
          ? ` — по ${PASS_STREAK} чистые проверки на линию, чтобы открыть следующий шаг`
          : null}
        {!locked && first ? (
          <>
            {' · '}
            <span className={isDue(first.id) ? 'text-yellow-500' : ''}>{dueLabel(first.id)}</span>
          </>
        ) : null}
      </p>

      {locked ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">{unlockHint(opening.id)}</p>
      ) : (
        <div className="mt-auto flex gap-2 pt-3">
          <Link
            to={`/openings/${opening.id}?line=${first.id}&mode=learn`}
            className="flex-1 rounded-lg bg-[var(--accent)] px-2 py-2 text-center text-sm font-medium text-white hover:opacity-90"
          >
            Учить
          </Link>
          {anti && (
            <Link
              to={`/openings/${opening.id}?line=${anti.id}&mode=learn`}
              className="flex-1 rounded-lg border border-[var(--chat-border)] px-2 py-2 text-center text-sm hover:bg-[var(--hover-bg)]"
            >
              Против тебя
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: LessonStatus }) {
  if (status === 'done') {
    return <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">сдан</span>;
  }
  if (status === 'open') {
    return <span className="rounded bg-[var(--accent)]/20 px-2 py-0.5 text-xs text-[var(--accent)]">открыт</span>;
  }
  return <span className="rounded bg-[var(--hover-bg)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">закрыт</span>;
}
