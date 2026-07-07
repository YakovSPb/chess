export const PUZZLE_LEVELS = [
  { id: 'easy', label: 'Лёгкий', minRating: 800, maxRating: 1099 },
  { id: 'medium', label: 'Средний', minRating: 1100, maxRating: 1399 },
  { id: 'hard', label: 'Сложный', minRating: 1400, maxRating: 1699 },
  { id: 'expert', label: 'Эксперт', minRating: 1700, maxRating: 3000 },
] as const;
