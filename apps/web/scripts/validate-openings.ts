import { Chess } from 'chess.js';
import { OPENINGS } from '../src/data/openings';
import { sideToMove } from '../src/lib/line';

const errors: string[] = [];

for (const opening of OPENINGS) {
  for (const line of opening.lines) {
    const chess = new Chess();
    line.moves.forEach((move, index) => {
      const turn = chess.turn();
      const expected = sideToMove(opening.side, move.by);
      if (turn !== expected) {
        errors.push(`${line.id} #${index} ${move.san}: ход ${move.by}, а очередь ${turn}`);
      }
      const played = chess.move(move.san);
      if (!played) {
        errors.push(`${line.id} #${index}: нелегальный ${move.san} из ${chess.fen()}`);
        return;
      }
      if (played.san !== move.san) {
        errors.push(`${line.id} #${index}: записан ${move.san}, chess.js даёт ${played.san}`);
      }
    });

    const probe = new Chess();
    for (const move of line.moves) {
      if (move.by === 'user' && move.alternatives) {
        for (const alternative of move.alternatives) {
          const branch = new Chess(probe.fen());
          const played = branch.move(alternative.san);
          if (!played) {
            errors.push(`${line.id}: альтернатива ${alternative.san} нелегальна перед ${move.san}`);
          } else if (played.san !== alternative.san) {
            errors.push(`${line.id}: альтернатива ${alternative.san} записывается как ${played.san}`);
          }
        }
      }
      const played = probe.move(move.san);
      if (!played) break;
    }

    const last = line.moves[line.moves.length - 1];
    if (last?.by !== 'user') {
      errors.push(`${line.id}: линия должна заканчиваться ходом ученика`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`ok: ${OPENINGS.reduce((sum, opening) => sum + opening.lines.length, 0)} линий`);
