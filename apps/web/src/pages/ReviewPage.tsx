import { Link } from 'react-router-dom';
import { allLines } from '../data/openings';
import { dueLabel, isDue } from '../lib/srs';

export function ReviewPage() {
  const due = allLines().filter(({ line }) => isDue(line.id));

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          <Link to="/" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Назад">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Повторение</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Интервалы 1 → 3 → 7 → 16 → 35 дней. Ошибка возвращает линию на завтра.
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6">
        {due.length === 0 ? (
          <p className="rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--muted-foreground)]">
            Сейчас повторять нечего. Пройди линию в режиме «Учить» или «Проверка» — чистый проход уйдёт на следующий
            интервал, ошибка вернётся завтра.
          </p>
        ) : (
          due.map(({ opening, line }) => (
            <Link
              key={line.id}
              to={`/openings/${opening.id}?line=${line.id}&mode=quiz`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--chat-border)] bg-[var(--card-bg)] px-4 py-3 hover:bg-[var(--hover-bg)]"
            >
              <span>
                <span className="block font-medium">{line.name}</span>
                <span className="text-sm text-[var(--muted-foreground)]">{opening.name}</span>
              </span>
              <span className="text-sm text-yellow-500">{dueLabel(line.id)}</span>
            </Link>
          ))
        )}
      </main>
    </div>
  );
}
