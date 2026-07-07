import { Chessboard } from 'react-chessboard';
import type { CSSProperties } from 'react';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

interface ChessBoardViewProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  allowMoves?: boolean;
  boardWidth?: number;
  squareStyles?: Record<string, CSSProperties>;
}

export function ChessBoardView({
  fen,
  orientation = 'white',
  onMove,
  allowMoves = true,
  boardWidth = 480,
  squareStyles,
}: ChessBoardViewProps) {
  const labelGutter = Math.max(18, Math.round(boardWidth * 0.045));
  const squareSize = boardWidth / 8;
  const totalWidth = labelGutter + boardWidth;
  const totalHeight = boardWidth + labelGutter;
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();

  const labelStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: `clamp(10px, ${labelGutter * 0.55}px, 14px)`,
    fontWeight: 500,
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      className="mx-auto shrink-0 w-full"
      style={{
        maxWidth: totalWidth,
        aspectRatio: `${totalWidth} / ${totalHeight}`,
        display: 'grid',
        gridTemplateColumns: `${labelGutter}fr repeat(8, ${squareSize}fr)`,
        gridTemplateRows: `repeat(8, ${squareSize}fr) ${labelGutter}fr`,
      }}
    >
      {ranks.map((rank, index) => (
        <span
          key={rank}
          style={{
            ...labelStyle,
            gridColumn: 1,
            gridRow: index + 1,
          }}
        >
          {rank}
        </span>
      ))}

      <div
        style={{
          gridColumn: '2 / 10',
          gridRow: '1 / 9',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Chessboard
          options={{
            position: fen,
            boardOrientation: orientation,
            allowDragging: allowMoves,
            showNotation: false,
            squareStyles,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!onMove || !targetSquare) return false;
              return onMove(sourceSquare, targetSquare);
            },
            darkSquareStyle: { backgroundColor: '#769656' },
            lightSquareStyle: { backgroundColor: '#eeeed2' },
            boardStyle: {
              borderRadius: '4px',
              width: '100%',
              height: '100%',
            },
          }}
        />
      </div>

      {files.map((file, index) => (
        <span
          key={file}
          style={{
            ...labelStyle,
            gridColumn: index + 2,
            gridRow: 9,
          }}
        >
          {file}
        </span>
      ))}
    </div>
  );
}
