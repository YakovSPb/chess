import { NavLink, Outlet } from 'react-router-dom';
import { FooterChat } from './FooterChat';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Главная', icon: '🏠' },
  { to: '/puzzles', label: 'Задачи', icon: '🧩' },
  { to: '/play', label: 'Игра с ботом', icon: '♟' },
  { to: '/coach', label: 'Тренер', icon: '🎓' },
  { to: '/openings', label: 'Дебюты', icon: '♜' },
  { to: '/learn', label: 'Обучение', icon: '📚' },
  { to: '/games', label: 'Мои партии', icon: '📊' },
  { to: '/settings', label: 'Настройки', icon: '⚙' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-[var(--bg-secondary)] border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-[var(--accent)]">ChessTrain</h1>
          {user && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {user.username} · {Math.round(user.puzzle_rating)}
            </p>
          )}
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
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
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
        <FooterChat />
      </main>
    </div>
  );
}
