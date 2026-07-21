import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FooterChat } from './FooterChat';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Главная', icon: '🏠' },
  { to: '/puzzles', label: 'Задачи', icon: '🧩' },
  { to: '/play', label: 'Игра с ботом', icon: '♟' },
  { to: '/coach', label: 'Тренер', icon: '🎓' },
  { to: '/openings', label: 'Дебюты', icon: '♜' },
  { to: '/championships', label: 'Чемпионаты', icon: '🏆' },
  { to: '/learn', label: 'Обучение', icon: '📚' },
  { to: '/study', label: 'Учёба', icon: '📝' },
  { to: '/games', label: 'Мои партии', icon: '📊' },
  { to: '/settings', label: 'Настройки', icon: '⚙' },
];

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-[100dvh]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Закрыть меню"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-700 bg-[var(--bg-secondary)] transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-700 p-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--accent)]">ChessTrain</h1>
            {user && (
              <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                {user.username} · {Math.round(user.puzzle_rating)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-white lg:hidden"
            aria-label="Закрыть меню"
          >
            <MenuIcon open />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {user && (
          <button onClick={logout} className="m-2 btn btn-secondary text-sm">
            Выйти
          </button>
        )}
      </aside>

      <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-gray-700 bg-[var(--bg-secondary)] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-white"
            aria-label="Открыть меню"
          >
            <MenuIcon open={false} />
          </button>
          <h1 className="truncate text-lg font-bold text-[var(--accent)]">ChessTrain</h1>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
        <FooterChat />
      </main>
    </div>
  );
}
