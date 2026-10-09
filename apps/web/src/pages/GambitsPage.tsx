import { Link } from 'react-router-dom';
import { AppNav } from '../components/AppNav';
import { CurriculumBlocks } from '../components/CurriculumBlocks';
import { CURRICULUM, SIDE_BLOCK_IDS } from '../data/curriculum';
import { getOpening } from '../data/openings';
import { currentLesson } from '../lib/curriculumProgress';
import { isDue } from '../lib/srs';

export function GambitsPage() {
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

  const levels = CURRICULUM.filter((level) => SIDE_BLOCK_IDS.has(level.id));
  const current = currentLesson();
  const currentIsGambit = current && SIDE_BLOCK_IDS.has(current.level.id);

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-semibold">Гамбиты</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
              Вне школы развития: жертвы пешек и учебные матовые атаки. Можно проходить в любой
              момент.
            </p>
          </div>
          <AppNav dueCount={dueCount} />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {currentIsGambit && current && (
          <section className="rounded-xl border border-[var(--accent)]/40 bg-[var(--card-bg)] p-4">
            <p className="text-xs font-medium tracking-wide text-[var(--accent)] uppercase">Сейчас</p>
            <h2 className="mt-1 text-lg font-semibold">
              {current.level.flag ? `${current.level.flag} ` : ''}
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

        <CurriculumBlocks levels={levels} />
      </main>
    </div>
  );
}
