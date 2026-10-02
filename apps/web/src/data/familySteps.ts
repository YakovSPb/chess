import { Chess } from 'chess.js';
import type { Opening, OpeningLine, OpponentMove, Side, UserMove } from '../types';

function user(san: string, say: string, hint: string, why: string, plan?: string): UserMove {
  return { san, by: 'user', say, hint, why, ...(plan ? { plan } : {}) };
}

function opponent(san: string, say: string): OpponentMove {
  return { san, by: 'opponent', say };
}

function U(san: string, idea?: string): UserMove {
  return user(
    san,
    idea ? `${idea} Ход: ${san}.` : `Играем ${san}.`,
    idea ?? 'Сделай ход по идее линии — без подсказки нотации.',
    idea ?? 'В этой линии нужен ход схемы.',
    'Держись схемы урока.',
  );
}

function O(san: string, idea?: string): OpponentMove {
  return opponent(san, idea ?? `Соперник сыграл ${san}.`);
}

function makeLine(
  id: string,
  name: string,
  intro: string,
  summary: string,
  moves: OpeningLine['moves'],
): OpeningLine {
  return {
    id,
    name,
    intro,
    summary,
    moves,
    next: [
      { san: 'a3', why: 'placeholder', best: true },
      { san: 'h3', why: 'placeholder' },
    ],
  };
}

function opening(
  id: string,
  name: string,
  description: string,
  side: Opening['side'],
  preview: string,
  lines: OpeningLine[],
  anti: OpeningLine[],
): Opening {
  return { id, name, description, side, preview, lines, anti };
}

function finalizeLine(line: OpeningLine, side: Side): OpeningLine {
  const chess = new Chess();
  const moves = line.moves.map((move, index) => {
    let played = null;
    try {
      played = chess.move(move.san);
    } catch {
      played = null;
    }
    if (!played) {
      try {
        played = chess.move(`${move.san.replace('+', '')}+`);
      } catch {
        played = null;
      }
    }
    if (!played) {
      throw new Error(`${line.id} #${index}: нелегальный ${move.san} из ${chess.fen()}`);
    }
    return { ...move, san: played.san };
  });

  const color = side === 'white' ? 'w' : 'b';
  const parts = chess.fen().split(' ');
  parts[1] = color;
  parts[3] = '-';
  const probe = new Chess();
  probe.load(parts.join(' '));
  const legal = probe.moves();
  const quiet = legal.filter((san) => !san.includes('x') && !san.includes('='));
  const pool = quiet.length >= 2 ? quiet : legal;
  return {
    ...line,
    moves,
    next: [
      { san: pool[0], why: 'логический следующий ход схемы', best: true },
      { san: pool[1] ?? pool[0], why: 'запасной полезный ход' },
    ],
  };
}

function finalizeOpening(item: Opening): Opening {
  const against: Side = item.side === 'white' ? 'black' : 'white';
  return {
    ...item,
    lines: item.lines.map((line) => finalizeLine(line, item.side)),
    anti: item.anti.map((line) => finalizeLine(line, against)),
  };
}

/** Промежуточные шаги семей: схемы, фишки, жертвы внутри блока. */
const RAW: Opening[] = [
  opening(
    'scotch-gambit',
    'Шотландский гамбит',
    'После 3.d4 exd4 белые не берут коня сразу — Bc4 и темп. Фишка шотландской семьи.',
    'white',
    '1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4',
    [
      makeLine('scotch-gambit-main', 'Принятый', 'Отдай пешку за развитие: Bc4, c3, O-O.', 'Фигуры выведены, центр под давлением.', [
        U('e4'), O('e5'), U('Nf3'), O('Nc6'), U('d4'), O('exd4'),
        U('Bc4', 'Гамбит: слон раньше взятия на d4.'), O('Bc5'),
        U('c3'), O('dxc3'), U('Bxf7+', 'Типичная фишка — удар на f7.'), O('Kxf7'), U('Qd5+'),
      ]),
      makeLine('scotch-gambit-nf6', 'На …Nf6', 'Если чёрные развивают коня — держи темп и центр.', 'Развитие с инициативой.', [
        U('e4'), O('e5'), U('Nf3'), O('Nc6'), U('d4'), O('exd4'),
        U('Bc4'), O('Nf6'), U('e5'), O('d5'), U('Bb5'), O('Ne4'), U('Nxd4'),
      ]),
    ],
    [
      makeLine('anti-scotch-gambit', 'Против шотландского гамбита', 'Не жадничай: верни темпы развитием, короля убери из центра.', 'Король в безопасности.', [
        O('e4'), U('e5'), O('Nf3'), U('Nc6'), O('d4'), U('exd4'),
        O('Bc4'), U('Nf6'), O('e5'), U('d5'), O('Bb5'), U('Ne4'), O('Nxd4'), U('Bd7'),
      ]),
    ],
  ),

  opening(
    'spanish-open',
    'Открытая испанская',
    'После Ba4 …Nxe4 — открытый центр. Схема и тактические мотивы испанской семьи.',
    'black',
    '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4',
    [
      makeLine('spanish-open-main', 'Главная', 'Бери на e4, потом …b5 и …d5 — классика открытой.', 'Центр вскрыт по схеме.', [
        O('e4'), U('e5'), O('Nf3'), U('Nc6'), O('Bb5'), U('a6'),
        O('Ba4'), U('Nf6'), O('O-O'), U('Nxe4'), O('d4'), U('b5'),
        O('Bb3'), U('d5'), O('dxe5'), U('Be6'),
      ]),
      makeLine('spanish-open-dilworth', 'Идея размена', 'Иногда размены на d4/c3 упрощают — знай мотив.', 'Позиция упрощена осознанно.', [
        O('e4'), U('e5'), O('Nf3'), U('Nc6'), O('Bb5'), U('a6'),
        O('Ba4'), U('Nf6'), O('O-O'), U('Nxe4'), O('d4'), U('Be7'),
        O('Re1'), U('b5'), O('Bb3'), U('d5'),
      ]),
    ],
    [
      makeLine('anti-spanish-open', 'За белых против открытой', 'd4 и давление на e4/e5. Не зевай …d5.', 'Инициатива в открытом центре.', [
        U('e4'), O('e5'), U('Nf3'), O('Nc6'), U('Bb5'), O('a6'),
        U('Ba4'), O('Nf6'), U('O-O'), O('Nxe4'), U('d4'), O('b5'),
        U('Bb3'), O('d5'), U('dxe5'),
      ]),
    ],
  ),

  opening(
    'marshall',
    'Атака Маршалла',
    'В испанской жертва пешки …d5 за атаку. Фишка чёрных в закрытой испанской.',
    'black',
    '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5',
    [
      makeLine('marshall-main', 'Жертва …d5', 'После подготовки сыграй …d5 и атакуй королевский фланг.', 'Жертва принята/отклонена — план ясен.', [
        O('e4'), U('e5'), O('Nf3'), U('Nc6'), O('Bb5'), U('a6'),
        O('Ba4'), U('Nf6'), O('O-O'), U('Be7'), O('Re1'), U('b5'),
        O('Bb3'), U('O-O'), O('c3'), U('d5', 'Маршалл: жертва пешки.'),
      ]),
      makeLine('marshall-anti', 'Если не пускают', 'На антимаршалл (a4/h3) играй спокойную испанскую.', 'План без жертвы найден.', [
        O('e4'), U('e5'), O('Nf3'), U('Nc6'), O('Bb5'), U('a6'),
        O('Ba4'), U('Nf6'), O('O-O'), U('Be7'), O('Re1'), U('b5'),
        O('Bb3'), U('O-O'), O('a4'), U('Bb7'),
      ]),
    ],
    [
      makeLine('anti-marshall', 'Антимаршалл за белых', 'a4 или h3 — не пускай …d5 бесплатно.', 'Центр устойчив.', [
        U('e4'), O('e5'), U('Nf3'), O('Nc6'), U('Bb5'), O('a6'),
        U('Ba4'), O('Nf6'), U('O-O'), O('Be7'), U('Re1'), O('b5'),
        U('Bb3'), O('O-O'), U('a4'),
      ]),
    ],
  ),

  opening(
    'vienna',
    'Венская партия',
    '1.e4 e5 2.Nc3 — спокойный сосед королевского гамбита, иногда с f4.',
    'white',
    '1.e4 e5 2.Nc3 Nf6',
    [
      makeLine('vienna-quiet', 'Спокойная', 'Nc3, Bc4, d3 — развитие без раннего хаоса.', 'Фигуры на местах.', [
        U('e4'), O('e5'), U('Nc3'), O('Nf6'), U('Bc4'), O('Nc6'),
        U('d3'), O('Bb4'), U('Nf3'), O('d6'), U('O-O'), O('O-O'), U('Ne2'),
      ]),
      makeLine('vienna-gambit', 'С f4', 'После подготовки можно ударить f4 — мост к гамбиту.', 'Королевский фланг вскрыт по плану.', [
        U('e4'), O('e5'), U('Nc3'), O('Nf6'), U('f4'), O('d5'),
        U('fxe5'), O('Nxe4'), U('Nf3'), O('Be7'), U('d3'), O('Nxc3'), U('bxc3'),
      ]),
    ],
    [
      makeLine('anti-vienna', 'Против венской', '…Nf6 и …d5 оспаривают центр.', 'Чёрные уравняли.', [
        O('e4'), U('e5'), O('Nc3'), U('Nf6'), O('Bc4'), U('Nc6'),
        O('d3'), U('Bb4'), O('Nf3'), U('d6'), O('O-O'), U('O-O'), O('Ne2'), U('Ba5'),
      ]),
    ],
  ),

  opening(
    'caro-panov',
    'Атака Панова',
    'Против Каро: c4 и давление на d5. Частая схема, которую надо знать с обеих сторон.',
    'white',
    '1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4',
    [
      makeLine('caro-panov-main', 'Изолятор', 'После разменов часто получается изолятор d4 — играй активно.', 'План против изолятора ясен.', [
        U('e4'), O('c6'), U('d4'), O('d5'), U('exd5'), O('cxd5'),
        U('c4'), O('Nf6'), U('Nc3'), O('e6'), U('Nf3'), O('Be7'), U('cxd5'),
      ]),
      makeLine('caro-panov-g6', 'На …g6', 'Фианкетто чёрных — держи центр и развивайся.', 'Давление сохранено.', [
        U('e4'), O('c6'), U('d4'), O('d5'), U('exd5'), O('cxd5'),
        U('c4'), O('Nf6'), U('Nc3'), O('g6'), U('cxd5'), O('Nxd5'), U('Nf3'),
      ]),
    ],
    [
      makeLine('anti-caro-panov', 'Каро против Панова', '…Nf6 …e6 …Be7 — классика. Не бойся изолятора.', 'Развитие завершено.', [
        O('e4'), U('c6'), O('d4'), U('d5'), O('exd5'), U('cxd5'),
        O('c4'), U('Nf6'), O('Nc3'), U('e6'), O('Nf3'), U('Be7'), O('cxd5'), U('Nxd5'),
      ]),
    ],
  ),

  opening(
    'french-winawer',
    'Французская · Винавер',
    '3…Bb4 во французской — связка и острые пешечные структуры. Ключевая фишка семьи.',
    'black',
    '1.e4 e6 2.d4 d5 3.Nc3 Bb4',
    [
      makeLine('winawer-main', 'Классика', 'Свяжи коня, потом …c5 и игра против центра.', 'Структура Винавера поставлена.', [
        O('e4'), U('e6'), O('d4'), U('d5'), O('Nc3'), U('Bb4'),
        O('e5'), U('c5'), O('a3'), U('Bxc3'), O('bxc3'), U('Ne7'), O('Qg4'), U('Qc7'),
      ]),
      makeLine('winawer-quiet', 'На 4.exd5', 'Размен — играй спокойно …exd5 и развитие.', 'Крепкая позиция.', [
        O('e4'), U('e6'), O('d4'), U('d5'), O('Nc3'), U('Bb4'),
        O('exd5'), U('exd5'), O('Bd3'), U('Nc6'), O('Nf3'), U('Nge7'), O('O-O'), U('O-O'),
      ]),
    ],
    [
      makeLine('anti-winawer', 'За белых против Винавера', 'e5 и a3 — стандарт. Ферзь на g4 бьёт по g7.', 'Инициатива на королевском фланге.', [
        U('e4'), O('e6'), U('d4'), O('d5'), U('Nc3'), O('Bb4'),
        U('e5'), O('c5'), U('a3'), O('Bxc3'), U('bxc3'), O('Ne7'), U('Qg4'),
      ]),
    ],
  ),

  opening(
    'french-tarrasch',
    'Французская · Тарраш',
    '3.Nd2 — белые избегают Винавера. Чёрные учат ответ …c5/…Nf6.',
    'black',
    '1.e4 e6 2.d4 d5 3.Nd2',
    [
      makeLine('tarrasch-c5', 'С …c5', 'Сразу бей центр. Типичный ответ на Nd2.', 'Контригра в центре есть.', [
        O('e4'), U('e6'), O('d4'), U('d5'), O('Nd2'), U('c5'),
        O('exd5'), U('Qxd5'), O('Ngf3'), U('cxd4'), O('Bc4'), U('Qd6'), O('O-O'), U('Nf6'),
      ]),
      makeLine('tarrasch-nf6', 'С …Nf6', 'Закрытый путь: …Nf6 и …c5 позже.', 'Гибкая французская стойка.', [
        O('e4'), U('e6'), O('d4'), U('d5'), O('Nd2'), U('Nf6'),
        O('e5'), U('Nfd7'), O('Bd3'), U('c5'), O('c3'), U('Nc6'), O('Ne2'), U('cxd4'),
      ]),
    ],
    [
      makeLine('anti-tarrasch', 'Тарраш за белых', 'Nd2, потом Ngf3 и давление без ранней связки.', 'Центр под контролем.', [
        U('e4'), O('e6'), U('d4'), O('d5'), U('Nd2'), O('c5'),
        U('exd5'), O('Qxd5'), U('Ngf3'), O('cxd4'), U('Bc4'), O('Qd6'), U('O-O'),
      ]),
    ],
  ),

  opening(
    'bogo-indian',
    'Богоиндийская',
    '…Bb4+ без Nc3 — сосед Нимцовича. Промежуточный шаг индийской семьи.',
    'black',
    '1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+',
    [
      makeLine('bogo-main', 'На Bd2', 'Разменяй или отступи, потом …d6/…O-O.', 'Спокойная индийская структура.', [
        O('d4'), U('Nf6'), O('c4'), U('e6'), O('Nf3'), U('Bb4'),
        O('Bd2'), U('Qe7'), O('g3'), U('Nc6'), O('Bg2'), U('Bxd2'), O('Nbxd2'), U('d6'),
      ]),
      makeLine('bogo-nc3', 'Если всё же Nc3', 'Можно перейти к идеям Нимцовича.', 'Гибкий переход.', [
        O('d4'), U('Nf6'), O('c4'), U('e6'), O('Nf3'), U('Bb4'),
        O('Nc3'), U('O-O'), O('Bg5'), U('h6'), O('Bh4'), U('d5'), O('e3'), U('Nbd7'),
      ]),
    ],
    [
      makeLine('anti-bogo', 'За белых против Бого', 'Bd2 или Nbd2 — не отдавай центр даром.', 'Пара слонов или крепкий центр.', [
        U('d4'), O('Nf6'), U('c4'), O('e6'), U('Nf3'), O('Bb4'),
        U('Bd2'), O('Qe7'), U('g3'), O('Nc6'), U('Bg2'), O('Bxd2'), U('Nbxd2'),
      ]),
    ],
  ),

  opening(
    'torre',
    'Атака Торре',
    'd4, Nf3, Bg5 — система рядом с лондоном/Тромпом. Промежуточный шаг «современных белых».',
    'white',
    '1.d4 Nf6 2.Nf3 e6 3.Bg5',
    [
      makeLine('torre-main', 'Классика', 'Связка Bg5, потом e3, Nbd2, c3.', 'Системная стойка готова.', [
        U('d4'), O('Nf6'), U('Nf3'), O('e6'), U('Bg5'), O('Be7'),
        U('e3'), O('O-O'), U('Nbd2'), O('d5'), U('Bd3'), O('Nbd7'), U('O-O'),
      ]),
      makeLine('torre-ne4', 'На …Ne4', 'Конь прыгнул — бей или гони, не теряй темп.', 'Нестандарт, но здорово.', [
        U('d4'), O('Nf6'), U('Nf3'), O('e6'), U('Bg5'), O('Ne4'),
        U('Bf4'), O('d5'), U('e3'), O('Bd6'), U('Bd3'), O('O-O'), U('O-O'),
      ]),
    ],
    [
      makeLine('anti-torre', 'Против Торре', '…Be7 и …d5 — классика. Можно …Ne4.', 'Развитие без слабостей.', [
        O('d4'), U('Nf6'), O('Nf3'), U('e6'), O('Bg5'), U('Be7'),
        O('e3'), U('O-O'), O('Nbd2'), U('d5'), O('Bd3'), U('Nbd7'), O('O-O'), U('c5'),
      ]),
    ],
  ),

  opening(
    'english-attack',
    'Английская атака',
    'Против сицилианки/Надорфа: Be3, f3, Qd2, O-O-O. Острая фишка белых.',
    'white',
    '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3',
    [
      makeLine('english-attack-main', 'Длинная рокировка', 'Be3, f3, Qd2, O-O-O — гонка флангов.', 'Атака на короля запущена.', [
        U('e4'), O('c5'), U('Nf3'), O('d6'), U('d4'), O('cxd4'),
        U('Nxd4'), O('Nf6'), U('Nc3'), O('a6'), U('Be3'), O('e5'),
        U('Nb3'), O('Be6'), U('f3'),
      ]),
      makeLine('english-attack-e6', 'На …e6', 'Та же схема против схевенингена.', 'План длинной рокировки ясен.', [
        U('e4'), O('c5'), U('Nf3'), O('d6'), U('d4'), O('cxd4'),
        U('Nxd4'), O('Nf6'), U('Nc3'), O('a6'), U('Be3'), O('e6'),
        U('f3'), O('Be7'), U('Qd2'),
      ]),
    ],
    [
      makeLine('anti-english-attack', 'Против английской атаки', '…e5/…e6, …Be6, не зевай жертвы на b5.', 'Контригра на ферзевом фланге.', [
        O('e4'), U('c5'), O('Nf3'), U('d6'), O('d4'), U('cxd4'),
        O('Nxd4'), U('Nf6'), O('Nc3'), U('a6'), O('Be3'), U('e5'),
        O('Nb3'), U('Be6'), O('f3'), U('Be7'),
      ]),
    ],
  ),

  opening(
    'botvinnik',
    'Система Ботвинника',
    'В полуславянской: …g6 и острый центр. GM-фишка после базы полуславянской.',
    'black',
    '1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.Bg5 dxc4',
    [
      makeLine('botvinnik-main', 'Идея …g6', 'После …dxc4 готовь …b5 …g6 и контригру.', 'Острая полуславянская структура.', [
        O('d4'), U('d5'), O('c4'), U('c6'), O('Nf3'), U('Nf6'),
        O('Nc3'), U('e6'), O('Bg5'), U('dxc4'), O('e4'), U('b5'),
        O('e5'), U('h6'), O('Bh4'), U('g5'),
      ]),
      makeLine('botvinnik-quiet', 'Если белые тише', 'На спокойные ходы развивайся классически.', 'Крепкая полуславянская.', [
        O('d4'), U('d5'), O('c4'), U('c6'), O('Nf3'), U('Nf6'),
        O('Nc3'), U('e6'), O('e3'), U('Nbd7'), O('Bd3'), U('Bd6'), O('O-O'), U('O-O'),
      ]),
    ],
    [
      makeLine('anti-botvinnik', 'За белых против Ботвинника', 'e4 и давление. Не зевай …b5-b4.', 'Центр и инициатива.', [
        U('d4'), O('d5'), U('c4'), O('c6'), U('Nf3'), O('Nf6'),
        U('Nc3'), O('e6'), U('Bg5'), O('dxc4'), U('e4'), O('b5'), U('e5'),
      ]),
    ],
  ),
  opening(
    'smith-morra',
    'Гамбит Морра',
    'Против сицилианки: пешка за темпы. GM-практика антисицилианских гамбитов.',
    'white',
    '1.e4 c5 2.d4 cxd4 3.c3',
    [
      makeLine('morra-accepted', 'Принятый', 'После …dxc3 бери Nxc3 и развивайся с темпом.', 'Инициатива за пешку.', [
        U('e4'), O('c5'), U('d4'), O('cxd4'), U('c3'), O('dxc3'),
        U('Nxc3'), O('Nc6'), U('Nf3'), O('d6'), U('Bc4'), O('Nf6'), U('O-O'),
      ]),
      makeLine('morra-declined', 'Отклонённый', 'Если не берут — играй обычный центр.', 'Центр занят без жертвы.', [
        U('e4'), O('c5'), U('d4'), O('cxd4'), U('c3'), O('Nf6'),
        U('e5'), O('Nd5'), U('cxd4'), O('d6'), U('Nf3'), O('Nc6'), U('Bc4'),
      ]),
    ],
    [
      makeLine('anti-morra', 'Против Морра', 'Можно принять и вернуть темпы …d6 …Nf6 …a6.', 'Чёрные завершили развитие.', [
        O('e4'), U('c5'), O('d4'), U('cxd4'), O('c3'), U('dxc3'),
        O('Nxc3'), U('Nc6'), O('Nf3'), U('d6'), O('Bc4'), U('Nf6'), O('O-O'), U('a6'),
      ]),
    ],
  ),
];

export const FAMILY_STEP_OPENINGS: Opening[] = RAW.map(finalizeOpening);
