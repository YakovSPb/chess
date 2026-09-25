import { useEffect, useRef } from 'react';
import type { ChatMessage, OpeningLine } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  lines: OpeningLine[];
  activeLineId: string;
  hasNext: boolean;
  onLine: (lineId: string) => void;
  onRestart: () => void;
  onNext: () => void;
}

export function ChatPanel({
  messages,
  lines,
  activeLineId,
  hasNext,
  onLine,
  onRestart,
  onNext,
}: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--card-bg)]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--chat-border)] p-4">
        <div className="flex flex-wrap gap-2">
          {lines.map((line, index) => {
            const active = line.id === activeLineId;
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => onLine(line.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--chat-border)] text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
                }`}
              >
                {index + 1}. {line.name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            title="Сначала"
            onClick={onRestart}
            className="rounded-lg border border-[var(--chat-border)] px-4 py-3 text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-white hover:opacity-90"
          >
            {hasNext ? 'Следующая вариация' : 'К списку дебютов'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          mine ? 'bg-[#374151]' : 'bg-[var(--accent)]'
        }`}
      >
        {mine ? 'Я' : 'Т'}
      </div>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          mine
            ? 'rounded-br-md bg-[var(--user-bubble)] text-white'
            : 'rounded-bl-md border border-[var(--chat-border)] bg-[var(--bot-bubble)]'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15.36-5.36M20 15a9 9 0 0 1-15.36 5.36"
      />
    </svg>
  );
}
