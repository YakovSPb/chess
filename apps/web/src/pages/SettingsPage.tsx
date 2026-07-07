import { useState } from 'react';

export function SettingsPage() {
  const [hintLevel, setHintLevel] = useState(
    () => Number(localStorage.getItem('hintLevel') || '1')
  );

  const save = () => {
    localStorage.setItem('hintLevel', String(hintLevel));
    alert('Настройки сохранены');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Настройки</h2>
      <div className="card max-w-md space-y-4">
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            Уровень подсказок тренера по умолчанию
          </label>
          <select
            value={hintLevel}
            onChange={(e) => setHintLevel(Number(e.target.value))}
            className="input"
          >
            <option value={1}>1 — общая идея</option>
            <option value={2}>2 — направление</option>
            <option value={3}>3 — конкретный ход</option>
          </select>
        </div>
        <div className="text-sm text-[var(--text-secondary)] space-y-2">
          <p>AI настраивается в <code>.env</code> на сервере:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <code>OPENAI_API_KEY</code> — ключ с{' '}
              <a href="https://platform.openai.com/api-keys" className="underline" target="_blank" rel="noreferrer">
                platform.openai.com
              </a>
            </li>
            <li>
              <code>OPENAI_MODEL</code> — модель, по умолчанию <code>gpt-4o-mini</code>
            </li>
          </ul>
        </div>
        <button onClick={save} className="btn btn-primary">
          Сохранить
        </button>
      </div>
    </div>
  );
}
