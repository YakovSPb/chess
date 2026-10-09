import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
          : 'border-[var(--chat-border)] hover:bg-[var(--hover-bg)]'
      }`}
    >
      {children}
    </Link>
  );
}

export function AppNav({ dueCount = 0 }: { dueCount?: number }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <NavLink to="/">Школа</NavLink>
      <NavLink to="/gambits">Гамбиты</NavLink>
      <NavLink to="/games">Мои партии</NavLink>
      <NavLink to="/review">Повторение{dueCount > 0 ? ` · ${dueCount}` : ''}</NavLink>
    </div>
  );
}
