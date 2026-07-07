import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { usePageContext } from '../lib/pageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function FooterChat() {
  const { context } = usePageContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await api.coachChat({
        message: text,
        page: context.page,
        fen: context.fen,
        details: context.details,
        history: messages,
      });
      setMessages([...history, { role: 'assistant', content: res.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const contextLine = [context.page, context.details].filter(Boolean).join(' · ');

  return (
    <footer className="border-t border-gray-700 bg-[var(--bg-secondary)] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-[var(--bg-card)] transition-colors"
      >
        <span className="font-medium text-[var(--accent)]">AI-чат</span>
        <span className="text-[var(--text-secondary)] truncate ml-4">
          {open ? 'Свернуть' : contextLine || 'Спросите о позиции и странице'}
        </span>
        <span className="text-[var(--text-secondary)] ml-2">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-700 px-4 py-3 flex flex-col gap-3 h-72">
          <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
            <p>Контекст: {contextLine}</p>
            {context.fen && <p className="truncate">FEN: {context.fen}</p>}
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                Спросите, например: «Какой план в этой позиции?» или «Что я делаю на этой странице?»
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[90%] whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'ml-auto bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-[var(--text-secondary)]">Думаю...</p>
            )}
          </div>

          {error && <p className="text-sm text-[#ca3431]">{error}</p>}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ваш вопрос..."
              className="input flex-1 text-sm"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="btn btn-primary text-sm shrink-0 disabled:opacity-50"
            >
              Отправить
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
