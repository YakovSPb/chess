import type { CurriculumLevel } from '../types';

/**
 * Каждый блок — одна семья дебюта.
 * Внутри: база → схемы → фишки/жертвы (3–4 шага).
 * Урок сдан = все линии «за тебя» и «против тебя» в Проверке 3 раза подряд без ошибок (зелёный).
 * Шкала линии: оранжевый (1) → жёлтый (2) → зелёный (3). Ошибка сбрасывает счётчик.
 * Новый блок открывается только после закрытия предыдущего.
 */
export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 'block-italian',
    name: 'Блок 1 · Итальянская семья',
    description: 'База → двухконей → жертва на f7. Развитие и схемы; гамбит Эванса — в разделе «Гамбиты».',
    tracks: [
      {
        id: 'track-italian',
        name: 'Путь по итальянской',
        description: 'Спокойная игра, схемы, удар на f7.',
        openingIds: ['italian', 'two-knights', 'fegatello'],
      },
    ],
  },
  {
    id: 'block-scotch',
    name: 'Блок 2 · Шотландская семья',
    description: 'Четырёх коней → шотландская → шотландский гамбит.',
    tracks: [
      {
        id: 'track-scotch',
        name: 'Путь по шотландской',
        description: 'Спокойные кони, удар d4, гамбитная фишка.',
        openingIds: ['four-knights', 'scotch', 'scotch-gambit'],
      },
    ],
  },
  {
    id: 'block-spanish',
    name: 'Блок 3 · Испанская семья',
    description: 'База → открытая → Маршалл → Берлин.',
    tracks: [
      {
        id: 'track-spanish',
        name: 'Путь по испанской',
        description: 'Давление, открытый центр, жертва, крепость.',
        openingIds: ['spanish', 'spanish-open', 'marshall', 'berlin'],
      },
    ],
  },
  {
    id: 'block-open-sharp',
    name: 'Блок 4 · Острые на e4 e5',
    description: 'Венская → русская → королевский гамбит.',
    tracks: [
      {
        id: 'track-open-sharp',
        name: 'От спокойного к острому',
        description: 'Сначала Nc3, потом симметрия, потом f4.',
        openingIds: ['vienna', 'petrov', 'kings-gambit'],
      },
    ],
  },
  {
    id: 'block-d4-systems',
    name: 'Блок 5 · Системы на d4',
    description: 'Лондон → Колле → Йобава.',
    tracks: [
      {
        id: 'track-d4-systems',
        name: 'Путь систем',
        description: 'От надёжного лондона к острой Йобаве.',
        openingIds: ['london', 'colle', 'jobava'],
      },
    ],
  },
  {
    id: 'block-caro',
    name: 'Блок 6 · Каро и ранний …d5',
    description: 'Каро-Канн → Панов → скандинавская.',
    tracks: [
      {
        id: 'track-caro',
        name: 'Путь Каро',
        description: 'Крепость, атака Панова, соседняя …d5.',
        openingIds: ['caro', 'caro-panov', 'scandinavian'],
      },
    ],
  },
  {
    id: 'block-french',
    name: 'Блок 7 · Французская семья',
    description: 'База → Винавер → Тарраш.',
    tracks: [
      {
        id: 'track-french',
        name: 'Путь французской',
        description: 'Закрытый центр, связка Bb4, ответ на Nd2.',
        openingIds: ['french', 'french-winawer', 'french-tarrasch'],
      },
    ],
  },
  {
    id: 'block-queens',
    name: 'Блок 8 · Ферзевый гамбит',
    description: 'Отказ/славянская → принятый → полуславянская.',
    tracks: [
      {
        id: 'track-queens',
        name: 'Путь ферзевых',
        description: 'Классика d5, потом острые структуры.',
        openingIds: ['queens', 'qga', 'semi-slav'],
      },
    ],
  },
  {
    id: 'block-indian',
    name: 'Блок 9 · Индийские защиты',
    description: 'Нимцович → Бого → новоиндийская.',
    tracks: [
      {
        id: 'track-indian',
        name: 'Путь индийских',
        description: 'Связка на c3, шах Bb4+, фианкетто b7.',
        openingIds: ['nimzo', 'bogo-indian', 'queens-indian'],
      },
    ],
  },
  {
    id: 'block-hypermodern',
    name: 'Блок 10 · Гипермодерн на d4',
    description: 'Староиндийская → Грюнфельд → Бенони.',
    tracks: [
      {
        id: 'track-hypermodern',
        name: 'Путь гипермодерна',
        description: 'Уступи центр, бей …e5/…c5/…d5.',
        openingIds: ['kid', 'grunfeld', 'benoni'],
      },
    ],
  },
  {
    id: 'block-sicilian',
    name: 'Блок 11 · Сицилианская семья',
    description: 'База за чёрных → Алапин → дракон.',
    tracks: [
      {
        id: 'track-sicilian',
        name: 'Путь сицилианки',
        description: 'Асимметрия, анти-схема, острый дракон.',
        openingIds: ['sicilian-black', 'alapin', 'dragon'],
      },
    ],
  },
  {
    id: 'block-flank',
    name: 'Блок 12 · Фланговые начала',
    description: 'Английское → Рети → голландская.',
    tracks: [
      {
        id: 'track-flank',
        name: 'Путь флангов',
        description: 'c4, Nf3/c4, затем …f5.',
        openingIds: ['english', 'reti', 'dutch'],
      },
    ],
  },
  {
    id: 'block-modern-white',
    name: 'Блок 13 · Современные белые',
    description: 'Торре → каталон → Тромповский.',
    tracks: [
      {
        id: 'track-modern-white',
        name: 'Путь систем 1.d4',
        description: 'Связка Bg5, фианкетто g2, ранний Bg5 на …Nf6.',
        openingIds: ['torre', 'catalan', 'trompowsky'],
      },
    ],
  },
  {
    id: 'block-flex-e4',
    name: 'Блок 14 · Гибкий ответ на e4',
    description: 'Пирц → современная → Алехин.',
    tracks: [
      {
        id: 'track-flex-e4',
        name: 'Путь гибких',
        description: 'Уступи центр, бей позже.',
        openingIds: ['pirc', 'modern', 'alekhine'],
      },
    ],
  },
  {
    id: 'block-gm',
    name: 'Блок 15 · Гроссмейстерские фишки',
    description: 'Английская атака → Ботвинник → гамбит Морра.',
    tracks: [
      {
        id: 'track-gm',
        name: 'Острые GM-схемы',
        description: 'Сицилианские атаки белых и система Ботвинника.',
        openingIds: ['english-attack', 'botvinnik', 'smith-morra'],
      },
    ],
  },
  /**
   * Вне цепочки школы: острые гамбиты и матовые атаки.
   * Открыт сразу — не блокирует и не требует сдачи блоков 1–15.
   */
  {
    id: 'block-gambits',
    name: 'Эванс и жертвы',
    description: 'Жертвы пешек и учебные матовые атаки — не путать со школой спокойного развития.',
    tracks: [
      {
        id: 'track-gambits',
        name: 'Гамбит Эванса',
        description: 'Мат с жертвой ферзя и ответы на разные защиты.',
        openingIds: ['evans'],
      },
    ],
  },
];

/** Блоки вне основной цепочки школы (сразу открыты). */
export const SIDE_BLOCK_IDS = new Set(['block-gambits']);

export function flatLessons(): { levelId: string; trackId: string; openingId: string; indexInTrack: number }[] {
  const result: { levelId: string; trackId: string; openingId: string; indexInTrack: number }[] = [];
  for (const level of CURRICULUM) {
    for (const track of level.tracks) {
      track.openingIds.forEach((openingId, indexInTrack) => {
        result.push({ levelId: level.id, trackId: track.id, openingId, indexInTrack });
      });
    }
  }
  return result;
}

export function findLesson(openingId: string) {
  return flatLessons().find((item) => item.openingId === openingId);
}

export function trackOf(openingId: string) {
  for (const level of CURRICULUM) {
    for (const track of level.tracks) {
      if (track.openingIds.includes(openingId)) {
        return { level, track };
      }
    }
  }
  return null;
}

export function neighborLessons(openingId: string): { prev: string | null; next: string | null } {
  const place = findLesson(openingId);
  if (!place) return { prev: null, next: null };
  const track = CURRICULUM.flatMap((level) => level.tracks).find((item) => item.id === place.trackId);
  if (!track) return { prev: null, next: null };
  const prev = track.openingIds[place.indexInTrack - 1] ?? null;
  const next = track.openingIds[place.indexInTrack + 1] ?? null;
  return { prev, next };
}
