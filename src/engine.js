export const SIZE = 4;
export const emptyBoard = () => Array(16).fill(0);

export function addTile(board, random = Math.random) {
  const empty = board.map((value, i) => value === 0 ? i : -1).filter(i => i >= 0);
  if (!empty.length) return { board: [...board], index: -1 };
  const index = empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))];
  const next = [...board]; next[index] = random() < 0.9 ? 2 : 4;
  return { board: next, index };
}
export function newBoard(random = Math.random) { return addTile(addTile(emptyBoard(), random).board, random).board; }

export function move(board, direction) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('Invalid direction');
  const next = emptyBoard(), movements = [], merges = [];
  let score = 0;
  for (let line = 0; line < SIZE; line++) {
    const indices = Array.from({ length: SIZE }, (_, pos) => direction === 'left' ? line * SIZE + pos : direction === 'right' ? line * SIZE + SIZE - 1 - pos : direction === 'up' ? pos * SIZE + line : (SIZE - 1 - pos) * SIZE + line);
    const entries = indices.filter(i => board[i]).map(i => ({ index: i, value: board[i] }));
    let dest = 0;
    for (let i = 0; i < entries.length; i++, dest++) {
      const entry = entries[i], target = indices[dest];
      if (i + 1 < entries.length && entry.value === entries[i + 1].value) {
        next[target] = entry.value * 2; score += next[target];
        movements.push({ from: entry.index, to: target, value: entry.value }, { from: entries[i + 1].index, to: target, value: entry.value });
        merges.push({ index: target, value: next[target] }); i++;
      } else { next[target] = entry.value; movements.push({ from: entry.index, to: target, value: entry.value }); }
    }
  }
  return { board: next, changed: board.some((v, i) => v !== next[i]), score, movements, merges };
}
export function canMove(board) {
  if (board.some(v => v === 0)) return true;
  return board.some((v, i) => (i % SIZE < SIZE - 1 && v === board[i + 1]) || (i < 12 && v === board[i + SIZE]));
}
export function validBoard(board) { return Array.isArray(board) && board.length === 16 && board.every(v => Number.isSafeInteger(v) && (v === 0 || (v >= 2 && Number.isInteger(Math.log2(v))))); }
