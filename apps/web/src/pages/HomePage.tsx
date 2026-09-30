import { Link } from 'react-router-dom';
import { OPENINGS } from '../data/openings';
import { dueLabel, isDue } from '../lib/srs';
import type { Opening } from '../types';

export function HomePage() {
  const dueCount = OPENINGS.reduce(
    (sum, opening) =>
      sum + [...opening.lines, ...opening.anti].filter((line) => isDue(line.id)).length,
    0,
  );

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-semibold">Дебюты</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
              Пять схем. Учишь позицию и зачем ход, а не длинную цепочку. Справа тренер подсказывает, на доске
              ходишь сам.
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
        <Section title="За белых" openings={OPENINGS.filter((opening) => opening.side === 'white')} />
        <Section title="За чёрных" openings={OPENINGS.filter((opening) => opening.side === 'black')} />
      </main>
    </div>
  );
}

function Section({ title, openings }: { title: string; openings: Opening[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {openings.map((opening) => (
          <OpeningCard key={opening.id} opening={opening} />
        ))}
      </div>
    </section>
  );
}

function OpeningCard({ opening }: { opening: Opening }) {
  const first = opening.lines[0];
  const anti = opening.anti[0];
  return (
    <article className="flex flex-col rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{opening.name}</h3>
        <span className="font-mono text-xs text-[var(--muted-foreground)]">{opening.preview}</span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted-foreground)]">{opening.description}</p>
      <ul className="mb-4 flex flex-col gap-1 text-sm">
        {opening.lines.map((line) => (
          <LineRow key={line.id} id={line.id} name={line.name} />
        ))}
      </ul>
      <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
        Если играют против тебя
      </p>
      <ul className="mb-4 flex flex-col gap-1 text-sm">
        {opening.anti.map((line) => (
          <LineRow key={line.id} id={line.id} name={line.name} />
        ))}
      </ul>
      <div className="mt-auto flex gap-2">
        <Link
          to={`/openings/${opening.id}?line=${first.id}&mode=learn`}
          className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-medium text-white hover:opacity-90"
        >
          Учить
        </Link>
        <Link
          to={`/openings/${opening.id}?line=${anti.id}&mode=learn`}
          className="flex-1 rounded-lg border border-[var(--chat-border)] px-3 py-2 text-center text-sm font-medium hover:bg-[var(--hover-bg)]"
        >
          Против тебя
        </Link>
      </div>
    </article>
  );
}

function LineRow({ id, name }: { id: string; name: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{name}</span>
      <span className={isDue(id) ? 'text-yellow-500' : 'text-[var(--muted-foreground)]'}>{dueLabel(id)}</span>
    </li>
  );
}
