import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-primary)] px-4 py-6">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-[var(--accent)] mb-2">ChessTrain</h1>
        <p className="text-[var(--text-secondary)] mb-6">Вход в аккаунт</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
            autoComplete="current-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? '...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
