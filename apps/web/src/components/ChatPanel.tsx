import { useEffect, useRef } from 'react';
import { arrowsForSentence, splitComment } from '../lib/commentArrows';
import type { BoardArrow, ChatMessage, OpeningLine } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  lines: OpeningLine[];
  activeLineId: string;
  hasNext: boolean;
  onLine: (lineId: string) => void;
  onRestart: () => void;
  onNext: () => void;
  onPreview: (arrows: BoardArrow[], flash: boolean) => void;
  onPreviewEnd: () => void;
}

export function ChatPanel({
  messages,
  lines,
  activeLineId,
  hasNext,
  onLine,
  onRestart,
  onNext,
  onPreview,
  onPreviewEnd,
}: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--card-bg)]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} onPreview={onPreview} onPreviewEnd={onPreviewEnd} />
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

function Bubble({
  message,
  onPreview,
  onPreviewEnd,
}: {
  message: ChatMessage;
  onPreview: (arrows: BoardArrow[], flash: boolean) => void;
  onPreviewEnd: () => void;
}) {
  const mine = message.role === 'user';
  const parts = splitComment(message.text);
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
        {parts.map((part, index) => {
          const arrows = arrowsForSentence(part, message.board);
          if (arrows.length === 0) return <span key={index}>{part}</span>;
          return (
            <CommentSentence
              key={index}
              text={part}
              arrows={arrows}
              onPreview={onPreview}
              onPreviewEnd={onPreviewEnd}
            />
          );
        })}
        {message.ideas?.map((idea) => (
          <div key={idea.text} className="mt-2">
            <CommentSentence
              text={idea.text}
              arrows={idea.arrows}
              onPreview={onPreview}
              onPreviewEnd={onPreviewEnd}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentSentence({
  text,
  arrows,
  onPreview,
  onPreviewEnd,
}: {
  text: string;
  arrows: BoardArrow[];
  onPreview: (arrows: BoardArrow[], flash: boolean) => void;
  onPreviewEnd: () => void;
}) {
  const pointer = useRef<'mouse' | 'touch'>('mouse');

  return (
    <span
      role="button"
      tabIndex={0}
      title="Показать на доске"
      className="cursor-pointer rounded-sm underline decoration-dotted decoration-white/50 underline-offset-4 hover:bg-white/10 hover:decoration-[var(--accent)]"
      onPointerDown={(event) => {
        pointer.current = event.pointerType === 'mouse' ? 'mouse' : 'touch';
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onPreview(arrows, true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onPreviewEnd();
      }}
      onClick={() => {
        if (pointer.current !== 'mouse') onPreview(arrows, true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPreview(arrows, true);
        }
      }}
    >
      {text}
    </span>
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
