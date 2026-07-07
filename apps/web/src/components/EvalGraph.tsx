interface EvalGraphProps {
  evalHistory: number[];
  height?: number;
}

export function EvalGraph({ evalHistory, height = 120 }: EvalGraphProps) {
  if (evalHistory.length === 0) {
    return <div className="card text-[var(--text-secondary)] text-sm">Нет данных для графика</div>;
  }

  const maxEval = 800;
  const width = Math.max(evalHistory.length * 12, 400);

  const points = evalHistory.map((ev, i) => {
    const x = (i / Math.max(evalHistory.length - 1, 1)) * width;
    const clamped = Math.max(-maxEval, Math.min(maxEval, ev));
    const y = height / 2 - (clamped / maxEval) * (height / 2 - 10);
    return `${x},${y}`;
  });

  const zeroY = height / 2;

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-medium mb-2">График оценки</h3>
      <svg width={width} height={height} className="bg-[var(--bg-primary)] rounded">
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#555" strokeWidth="1" />
        <polyline
          fill="none"
          stroke="#81b64c"
          strokeWidth="2"
          points={points.join(' ')}
        />
        {evalHistory.map((ev, i) => {
          const x = (i / Math.max(evalHistory.length - 1, 1)) * width;
          const clamped = Math.max(-maxEval, Math.min(maxEval, ev));
          const y = height / 2 - (clamped / maxEval) * (height / 2 - 10);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={ev >= 0 ? '#81b64c' : '#ca3431'}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
        <span>Ход 1</span>
        <span>Ход {evalHistory.length}</span>
      </div>
    </div>
  );
}
