import type { CurriculumLevel } from '../types';

/**
 * Школьная лестница до гроссмейстерского репертуара.
 * Уроки открываются строго по порядку: предыдущий дебют сдан (все линии SRS step≥1).
 */
export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 'level-01-italian',
    name: '1 · Новичок · Итальянская',
    description: '1.e4 e5. Спокойный центр, двухконей и первая острая атака на f7.',
    tracks: [
      {
        id: 'track-italian',
        name: 'Итальянская семья',
        description: 'От спокойной итальянской к двухконям и жареной печени.',
        openingIds: ['italian', 'two-knights', 'fegatello'],
      },
    ],
  },
  {
    id: 'level-02-open-neighbors',
    name: '2 · Новичок+ · Соседи e4 e5',
    description: 'Шотландская, испанская и четырёх коней — соседние открытые схемы.',
    tracks: [
      {
        id: 'track-open-neighbors',
        name: 'Другие открытые',
        description: 'После итальянской — соседние 1.e4 e5 без лавины теории.',
        openingIds: ['scotch', 'spanish', 'four-knights'],
      },
    ],
  },
  {
    id: 'level-03-open-tactics',
    name: '3 · Тактика открытых',
    description: 'Гамбиты и русская партия: темп, жертва, симметрия.',
    tracks: [
      {
        id: 'track-open-tactics',
        name: 'Острые и крепкие',
        description: 'Эванс и королевский гамбит за белых, русская за чёрных.',
        openingIds: ['evans', 'kings-gambit', 'petrov'],
      },
    ],
  },
  {
    id: 'level-04-white-systems',
    name: '4 · Системы белых',
    description: 'Одна схема на разные ответы: лондон, Колле, Йобава.',
    tracks: [
      {
        id: 'track-d4-systems',
        name: 'd4-системы',
        description: 'Мало ветвей — много понимания планов.',
        openingIds: ['london', 'colle', 'jobava'],
      },
    ],
  },
  {
    id: 'level-05-vs-e4-solid',
    name: '5 · Крепость на 1.e4',
    description: 'Каро-Канн, французская и разбор скандинавской за белых.',
    tracks: [
      {
        id: 'track-vs-e4-solid',
        name: 'Полуоткрытые крепкие',
        description: 'Без сицилианской лавины — сначала стена.',
        openingIds: ['caro', 'french', 'scandinavian'],
      },
    ],
  },
  {
    id: 'level-06-vs-d4-classic',
    name: '6 · Классика на 1.d4',
    description: 'd5: отказанный/славянская и принятый ферзевый гамбит.',
    tracks: [
      {
        id: 'track-vs-d4-classic',
        name: 'Ферзевые структуры',
        description: 'Центр пешками, понятные планы.',
        openingIds: ['queens', 'qga'],
      },
    ],
  },
  {
    id: 'level-07-indian',
    name: '7 · Индийские защиты',
    description: 'Нимцович и новоиндийская — борьба за e4 без раннего …d5.',
    tracks: [
      {
        id: 'track-indian',
        name: 'Индийские',
        description: 'Связка Bb4 и фианкетто ферзевого слона.',
        openingIds: ['nimzo', 'queens-indian'],
      },
    ],
  },
  {
    id: 'level-08-hypermodern',
    name: '8 · Гипермодерн',
    description: 'Староиндийская и Грюнфельд — уступи центр, бей фигурами.',
    tracks: [
      {
        id: 'track-hypermodern',
        name: 'КИД и Грюнфельд',
        description: 'Классика гроссмейстерского ответа на 1.d4.',
        openingIds: ['kid', 'grunfeld'],
      },
    ],
  },
  {
    id: 'level-09-sicilian-base',
    name: '9 · Сицилианка · база',
    description: '…c5 за чёрных и спокойный Алапин за белых.',
    tracks: [
      {
        id: 'track-sicilian-base',
        name: 'Сицилианская база',
        description: 'Сначала схевенинген/надорф-lite и антисицилианка c3.',
        openingIds: ['sicilian-black', 'alapin'],
      },
    ],
  },
  {
    id: 'level-10-sicilian-sharp',
    name: '10 · Сицилианка · острая',
    description: 'Дракон и югославская атака — гонка флангов.',
    tracks: [
      {
        id: 'track-sicilian-sharp',
        name: 'Дракон',
        description: 'Острый миттельшпиль из дебюта.',
        openingIds: ['dragon'],
      },
    ],
  },
  {
    id: 'level-11-flank',
    name: '11 · Фланговые начала',
    description: 'Английское, Рети и голландская — игра вне 1.e4/1.d4 шаблона.',
    tracks: [
      {
        id: 'track-flank',
        name: 'Фланги',
        description: 'Гипермодерн за белых и острый …f5 за чёрных.',
        openingIds: ['english', 'reti', 'dutch'],
      },
    ],
  },
  {
    id: 'level-12-spanish-deep',
    name: '12 · Испанская глубоко',
    description: 'Берлин — эндшпильный уклон и антиберлин за белых.',
    tracks: [
      {
        id: 'track-spanish-deep',
        name: 'Берлин',
        description: 'От открытой испанской к гроссмейстерской крепости.',
        openingIds: ['berlin'],
      },
    ],
  },
  {
    id: 'level-13-modern-white',
    name: '13 · Современные белые',
    description: 'Каталон и Тромповский — давление без ранней тактики.',
    tracks: [
      {
        id: 'track-modern-white',
        name: 'Каталон и Тромп',
        description: 'Репертуар 1.d4 для сильного любителя и выше.',
        openingIds: ['catalan', 'trompowsky'],
      },
    ],
  },
  {
    id: 'level-14-vs-e4-flex',
    name: '14 · Гибкий ответ на e4',
    description: 'Пирц, современная и Алехин — уступи центр осознанно.',
    tracks: [
      {
        id: 'track-vs-e4-flex',
        name: 'Полуоткрытые гибкие',
        description: 'Асимметрия без сицилианской энциклопедии.',
        openingIds: ['pirc', 'modern', 'alekhine'],
      },
    ],
  },
  {
    id: 'level-15-gm',
    name: '15 · Гроссмейстер',
    description: 'Полуславянская и Бенони — острые структуры топ-уровня.',
    tracks: [
      {
        id: 'track-gm',
        name: 'GM-структуры',
        description: 'Последняя ступень школьной лестницы.',
        openingIds: ['semi-slav', 'benoni'],
      },
    ],
  },
];

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
