import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { CSSProperties } from 'react';
import { PromotionDialog } from './PromotionDialog';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

type PromotionPiece = 'q' | 'r' | 'b' | 'n';

interface PendingPromotion {
  from: string;
  to: string;
}

interface ChessBoardViewProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  allowMoves?: boolean;
  boardWidth?: number;
  squareStyles?: Record<string, CSSProperties>;
}

function buildMoveHighlights(
  fen: string,
  selectedSquare: string,
  externalStyles?: Record<string, CSSProperties>
): Record<string, CSSProperties> {
  const chess = new Chess(fen);
  const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
  const styles: Record<string, CSSProperties> = { ...externalStyles };

  styles[selectedSquare] = {
    ...styles[selectedSquare],
    backgroundImage: 'none',
    backgroundColor: 'rgba(255, 255, 51, 0.5)',
  };

  for (const move of moves) {
    const targetPiece = chess.get(move.to as Square);
    const isCapture = Boolean(targetPiece);
    styles[move.to] = {
      ...styles[move.to],
      backgroundImage: isCapture
        ? 'radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.25) 56%)'
        : 'radial-gradient(circle, rgba(0, 0, 0, 0.2) 22%, transparent 23%)',
    };
  }

  return styles;
}

function needsPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  return chess
    .moves({ square: from as Square, verbose: true })
    .some((move) => move.to === to && move.promotion);
}

const MAX_BOARD_WIDTH = 480;

function useResponsiveBoardWidth(maxWidth: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(maxWidth);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const available = container.clientWidth;
      const gutter = Math.max(18, Math.round(available * 0.04));
      const nextWidth = Math.min(maxWidth, Math.max(240, available - gutter));
      setBoardWidth(nextWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxWidth]);

  return { containerRef, boardWidth };
}

export function ChessBoardView({
  fen,
  orientation = 'white',
  onMove,
  allowMoves = true,
  boardWidth: boardWidthProp,
  squareStyles,
}: ChessBoardViewProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const maxWidth = boardWidthProp ?? MAX_BOARD_WIDTH;
  const { containerRef, boardWidth } = useResponsiveBoardWidth(maxWidth);

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [fen]);

  const labelGutter = Math.max(18, Math.round(boardWidth * 0.045));
  const squareSize = boardWidth / 8;
  const totalWidth = labelGutter + boardWidth;
  const totalHeight = boardWidth + labelGutter;
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();

  const promotionColor = useMemo((): 'w' | 'b' => {
    if (!pendingPromotion) return fen.includes(' w ') ? 'w' : 'b';
    const chess = new Chess(fen);
    const piece = chess.get(pendingPromotion.from as Square);
    return piece?.color ?? (fen.includes(' w ') ? 'w' : 'b');
  }, [fen, pendingPromotion]);

  const mergedSquareStyles = useMemo(() => {
    if (!selectedSquare || pendingPromotion) return squareStyles;
    return buildMoveHighlights(fen, selectedSquare, squareStyles);
  }, [fen, selectedSquare, pendingPromotion, squareStyles]);

  const tryMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece): boolean => {
      if (!onMove) return false;
      const success = onMove(from, to, promotion);
      if (success) {
        setSelectedSquare(null);
        setPendingPromotion(null);
      }
      return success;
    },
    [onMove]
  );

  const handleSquareClick = useCallback(
    ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
      if (!allowMoves || !onMove || pendingPromotion) return;

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare) {
        const chess = new Chess(fen);
        const legalMoves = chess.moves({ square: selectedSquare as Square, verbose: true });
        const canMoveTo = legalMoves.some((move) => move.to === square);

        if (!canMoveTo) {
          if (piece) {
            const pieceMoves = chess.moves({ square: square as Square, verbose: true });
            if (pieceMoves.length > 0) {
              setSelectedSquare(square);
            } else {
              setSelectedSquare(null);
            }
          } else {
            setSelectedSquare(null);
          }
          return;
        }

        if (needsPromotion(fen, selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        tryMove(selectedSquare, square);
        return;
      }

      if (!piece) return;

      const chess = new Chess(fen);
      const legalMoves = chess.moves({ square: square as Square, verbose: true });
      if (legalMoves.length > 0) {
        setSelectedSquare(square);
      }
    },
    [allowMoves, fen, onMove, pendingPromotion, selectedSquare, tryMove]
  );

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
    <div ref={containerRef} className="mx-auto w-full min-w-0">
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
        className="relative"
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
            allowDragging: false,
            showNotation: false,
            squareStyles: mergedSquareStyles,
            onSquareClick: handleSquareClick,
            darkSquareStyle: { backgroundColor: '#b58863' },
            lightSquareStyle: { backgroundColor: '#f0d9b5' },
            boardStyle: {
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              width: '100%',
              height: '100%',
            },
          }}
        />

        {pendingPromotion && (
          <PromotionDialog
            square={pendingPromotion.to}
            color={promotionColor}
            orientation={orientation}
            onSelect={(piece) => tryMove(pendingPromotion.from, pendingPromotion.to, piece)}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
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
    </div>
  );
}
