import type { CSSProperties } from 'react';

const PROMOTION_PIECES = [
  { piece: 'q', label: 'Ферзь', white: '♕', black: '♛' },
  { piece: 'r', label: 'Ладья', white: '♖', black: '♜' },
  { piece: 'b', label: 'Слон', white: '♗', black: '♝' },
  { piece: 'n', label: 'Конь', white: '♘', black: '♞' },
] as const;

interface PromotionDialogProps {
  square: string;
  color: 'w' | 'b';
  orientation: 'white' | 'black';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

function squarePosition(
  square: string,
  orientation: 'white' | 'black'
): Pick<CSSProperties, 'left' | 'top' | 'width' | 'height'> {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number.parseInt(square[1], 10);
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  const size = 100 / 8;

  return {
    left: `${col * size}%`,
    top: `${row * size}%`,
    width: `${size}%`,
    height: `${size}%`,
  };
}

export function PromotionDialog({
  square,
  color,
  orientation,
  onSelect,
  onCancel,
}: PromotionDialogProps) {
  const pos = squarePosition(square, orientation);
  const rank = Number.parseInt(square[1], 10);
  const openDown = rank >= 5;

  return (
    <div className="absolute inset-0 z-20" onClick={onCancel}>
      <div
        className="absolute z-30 flex flex-col overflow-hidden rounded-md border border-gray-500 shadow-lg"
        style={{
          ...pos,
          justifyContent: openDown ? 'flex-start' : 'flex-end',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {PROMOTION_PIECES.map(({ piece, label, white, black }) => (
          <button
            key={piece}
            type="button"
            title={label}
            className="flex flex-1 items-center justify-center bg-[var(--board-light)] text-3xl leading-none transition-colors hover:bg-[var(--accent)] hover:text-white"
            onClick={() => onSelect(piece)}
          >
            {color === 'w' ? white : black}
          </button>
        ))}
      </div>
    </div>
  );
}
