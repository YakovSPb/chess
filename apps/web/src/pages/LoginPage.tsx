import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const TEST_LOGIN = 'admin';
const TEST_PASSWORD = 'admin';

export function LoginPage() {
  const { user, login, register, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submitLogin = async (loginValue: string, loginPassword: string) => {
    setError('');
    setSubmitting(true);
    try {
      await login(loginValue, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      setError('');
      setSubmitting(true);
      try {
        if (password.length < 6) {
          setError('Пароль должен быть не короче 6 символов');
          return;
        }
        await register(username, email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    await submitLogin(email, password);
  };

  const handleTestLogin = async () => {
    setEmail(TEST_LOGIN);
    setPassword(TEST_PASSWORD);
    await submitLogin(TEST_LOGIN, TEST_PASSWORD);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-[var(--accent)] mb-2">ChessTrain</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          {isRegister ? 'Регистрация' : 'Вход в аккаунт'}
        </p>
        {!isRegister && (
          <button
            type="button"
            onClick={handleTestLogin}
            disabled={submitting}
            className="btn btn-secondary w-full mb-4 disabled:opacity-50"
          >
            Войти как admin (тест)
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              required
            />
          )}
          <input
            type={isRegister ? 'email' : 'text'}
            placeholder={isRegister ? 'Email' : 'Email или логин'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
            minLength={isRegister ? 6 : 1}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? '...' : isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="text-sm text-[var(--text-secondary)] mt-4 hover:text-white"
        >
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}
