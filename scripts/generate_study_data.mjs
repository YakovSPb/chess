#!/usr/bin/env node
/** Генерация данных раздела «Учёба» с проверкой FEN и UCI-линий. */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../apps/web/node_modules/chess.js/dist/cjs/chess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../apps/web/src/data/study/studyData.ts');

/** @param {string} fen @param {string} moves */
function validatePuzzle(fen, moves) {
  const board = new Chess(fen);
  for (const uci of moves.trim().split(/\s+/)) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4];
    const move = board.move({ from, to, promotion });
    if (!move) throw new Error(`Illegal move ${uci} in ${fen}\n${moves}`);
  }
}

/** @param {string} categoryId @param {number} index */
function pid(categoryId, index) {
  return `${categoryId}-p${String(index + 1).padStart(2, '0')}`;
}

/** @param {string} categoryId @param {number} pIndex @param {number} exIndex */
function puzzleId(categoryId, pIndex, exIndex) {
  return `${pid(categoryId, pIndex)}-e${exIndex + 1}`;
}

const POOL = [
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'f3g5 d7d5 e4d5 f6d5 g5f7', tags: ['calculation', 'tactics', 'opening'] },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: 'e1e8', tags: ['tactics', 'endgame', 'check'] },
  { fen: '8/8/8/3K4/8/8/3P4/4k3 w - - 0 1', moves: 'd5c5 e1d2 c5c4', tags: ['endgame', 'king', 'pawn'] },
  { fen: '8/5k2/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: 'e1e7', tags: ['endgame', 'check', 'rook'] },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2', moves: 'f3e5 b8c6 e5c6', tags: ['fork', 'tactics', 'opening'] },
  { fen: '6k1/5n1p/5p2/8/8/5N2/5PPP/4R1K1 w - - 0 1', moves: 'e1e8', tags: ['mate', 'endgame', 'backrank'] },
  { fen: '5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: 'e1e8', tags: ['mate', 'tactics', 'backrank'] },
  { fen: 'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N5/PP2PPPP/R1BQKN1R w KQkq - 0 4', moves: 'c4d5 c6d5', tags: ['positional', 'isolated', 'pawn'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N1PN2/PPP2PPP/R1BQK2R w KQkq - 0 4', moves: 'c3d5', tags: ['positional', 'knight', 'center'] },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd2d4 e5d4 c2c3', tags: ['opening', 'center', 'positional'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'b1c3', tags: ['opening', 'development', 'positional'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'e1g1', tags: ['opening', 'castling', 'safety'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd2d3', tags: ['opening', 'quiet', 'positional'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'h2h3', tags: ['prophylaxis', 'opening', 'safety'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'g2g3', tags: ['opening', 'fianchetto', 'bishop'] },
  { fen: '4k3/8/8/8/8/8/4p3/4K3 w - - 0 1', moves: 'e1d2', tags: ['endgame', 'opposition', 'quiet'] },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: 'e1e2', tags: ['endgame', 'quiet', 'rook'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd1e2', tags: ['opening', 'quiet', 'development'] },
  { fen: '8/8/8/3K4/8/8/3P4/4k3 w - - 0 1', moves: 'd5c5 e1d2', tags: ['endgame', 'opposition', 'king'] },
  { fen: '8/8/8/8/8/4K3/3P4/4k3 w - - 0 1', moves: 'e3d4', tags: ['endgame', 'king', 'pawn'] },
  { fen: '4k3/3n4/8/8/3p4/8/4N3/4K3 w - - 0 1', moves: 'e2c3', tags: ['endgame', 'blockade', 'knight'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4', moves: 'f8c5', tags: ['pin', 'opening', 'prophylaxis'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'h1f1', tags: ['opening', 'development', 'rook'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'b1c3', tags: ['opening', 'development', 'knight'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'c2c3', tags: ['opening', 'center', 'pawn'] },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1', moves: 'f1e1', tags: ['positional', 'rook', 'seventh'] },
  { fen: '7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: 'e1e7', tags: ['positional', 'rook', 'seventh'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'f3e5', tags: ['tactics', 'opening', 'check'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd2d4', tags: ['opening', 'center', 'pawn'] },
  { fen: '8/8/3k4/3p4/4K3/2N5/8/8 w - - 0 1', moves: 'c3d5', tags: ['endgame', 'blockade', 'knight'] },
  { fen: '8/8/4k3/4p3/4N3/8/4K3/8 w - - 0 1', moves: 'e4c5', tags: ['endgame', 'blockade', 'knight'] },
  { fen: '8/8/8/8/8/8/4P3/4K2k w - - 0 1', moves: 'e2e4', tags: ['endgame', 'pawn', 'king'] },
  { fen: '8/8/4k3/8/8/8/3P4/4K3 w - - 0 1', moves: 'e1e2', tags: ['endgame', 'opposition', 'king'] },
  { fen: '8/3k4/8/8/8/8/4P3/4K3 w - - 0 1', moves: 'e1d2', tags: ['endgame', 'opposition', 'king'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'a2a4', tags: ['opening', 'flank', 'quiet'] },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'c2c3', tags: ['opening', 'quiet', 'safety'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd2d3', tags: ['opening', 'quiet', 'development'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'h2h3', tags: ['prophylaxis', 'opening', 'safety'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'g2g3', tags: ['opening', 'fianchetto', 'bishop'] },
  { fen: 'r1bqk2r/pppp1ppp/2n1bn2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'a2a3', tags: ['opening', 'bishop', 'development'] },
];

const CATEGORY_THEMES = {
  calculation: ['calculation', 'tactics', 'long', 'fork', 'check', 'opening'],
  positional: ['positional', 'pawn', 'rook', 'knight', 'bishop', 'center', 'opening'],
  prophylaxis: ['prophylaxis', 'safety', 'opening', 'quiet', 'pin'],
  opening: ['opening', 'development', 'center', 'fianchetto', 'castling', 'pawn'],
  endgame: ['endgame', 'king', 'pawn', 'rook', 'opposition', 'blockade'],
  practical: ['opening', 'endgame', 'quiet', 'check', 'tactics', 'safety'],
  psychology: ['tactics', 'endgame', 'quiet', 'opening'],
  analysis: ['tactics', 'positional', 'opening', 'endgame'],
  training: ['tactics', 'fork', 'mate', 'endgame', 'opening'],
  computer: ['opening', 'tactics', 'positional'],
  tournament: ['tactics', 'opening', 'endgame', 'check'],
  technical: ['tactics', 'positional', 'endgame', 'opening', 'pawn'],
  growth: ['opening', 'positional', 'endgame', 'tactics'],
  wisdom: ['tactics', 'positional', 'quiet', 'endgame', 'opening'],
};

const CATEGORIES = [
  {
    id: 'calculation',
    title: 'Мышление и расчёт вариантов',
    principles: [
      'Считайте «ход-за-себя, ход-за-соперника». Не просто «я сюда, он сюда», а проговаривайте угрозы противника на каждом шагу.',
      'Правило блохи. В критической позиции ищите самый неочевидный, парадоксальный ход — он часто оказывается сильнейшим.',
      'Проверяйте все шахи, взятия и нападения. Даже те, что кажутся глупыми. Это 80% тактических ударов.',
      'Никогда не останавливайте расчёт на первом же форсированном варианте. Найдите минимум два, а лучше три пути и сравните их.',
      'Оценивайте позицию в конце расчёта. «Позиция после 12-го хода: у меня лучше пешечная структура, но его конь активен». Без такой оценки расчёт бесполезен.',
      'Смотрите на доску глазами соперника. Буквально переверните картинку в голове. Это лучший способ найти угрозы.',
      'Не додумывайте за соперника то, что вам выгодно. Если очень хочется, чтобы он пошёл сюда, он почти наверняка пойдёт в другое место.',
      'Тренируйте «быстрый счёт». 15 минут в день решайте несложные тактики на скорость — это ставит «автоматизм» на шахи и связки.',
      'В длинных вариантах считайте «деревом». Ствол — главная линия, ветки — возможные ответвления, которые нужно проверить.',
      'Если не видите форсированного выигрыша, не ищите его любой ценой. Часто достаточно позиционного усиления.',
    ],
  },
  {
    id: 'positional',
    title: 'Позиционная игра и стратегия',
    principles: [
      'План рождается из пешечной структуры. Определите, какая структура на доске (Карлсбад, висячие пешки, изолятор), и следуйте типовому плану.',
      'Улучшайте худшую фигуру. Найдите свою самую пассивную фигуру и сделайте ход, который повышает её активность. Это и есть план.',
      'Принцип двух слабостей. Выиграть одну слабость трудно. Создайте или используйте вторую, чтобы растянуть оборону соперника.',
      'Не ходите пешками на фланге, где вы слабее. Это открывает линии для атаки соперника.',
      'Конь — лучший блокер. Если у соперника проходная, ставьте перед ней коня: он лишит пешку подвижности и сам станет активным.',
      'Меняйте активные фигуры соперника, а не свои пассивные. Убирайте того, кто «жжёт», даже ценой своей пассивной фигуры.',
      'Открытая линия сама по себе ничего не стоит без пункта вторжения. Ладья должна куда-то войти, иначе это просто украшение.',
      'Избыточная защита (по Нимцовичу). Самый важный стратегический пункт защитите с запасом — это освобождает фигуры для манёвра.',
      'У слона должны быть свободные диагонали. Если ваши пешки перекрывают слона, это хроническая болезнь. Меняйте пешечную структуру или слона.',
      'Два слона — реальное преимущество в полуоткрытых позициях. Не разменивайте их без серьёзной причины.',
    ],
  },
  {
    id: 'prophylaxis',
    title: 'Профилактика и чувство опасности',
    principles: [
      'Перед каждым ходом спрашивайте: «Что грозит?». Даже в выигранной позиции. Особенно в выигранной.',
      'Следите за «форточкой». Если король запатован после вторжения, вы проиграете даже в лучшей позиции.',
      'Не ослабляйте поля вокруг короля без крайней нужды. Каждый h/h/g-пешка от короля — это шрам, который не заживает.',
      'Бойтесь контригры соперника. В атаке всегда думайте, какую жертву или прорыв он может предпринять, чтобы перехватить инициативу.',
      'Профилактика — это не трусость. Сделать ход, который заодно мешает плану соперника, эффективнее чисто активного хода.',
    ],
  },
  {
    id: 'opening',
    title: 'Дебют и подготовка',
    principles: [
      'Играйте то, что понимаете, а не то, что модно. Лучше глубоко знать одну систему, чем поверхностно десять.',
      'В дебюте учите идеи, а не варианты. Почему конь идёт на d2, а не на c3? Потому что защищает пешку e4 и готовит подрыв c3. Вариант забудется, идея останется.',
      'Раз в месяц пересматривайте свой дебютный репертуар. Убирайте линии, в которых чувствуете себя неуверенно, и добавляйте новые, подсмотренные у сильных игроков.',
      'Смотрите классические партии на ваш дебют. Поймите, как играли мастера прошлого — там всегда видна суть схемы.',
      'Не увлекайтесь дебютной теорией в ущерб другим стадиям. Разрядник тратит на дебют 20% времени, а не 80%.',
    ],
  },
  {
    id: 'endgame',
    title: 'Эндшпиль — фундамент силы',
    principles: [
      'Активизируйте короля. В эндшпиле король — боевая единица, смело ведите его в центр.',
      'Изучите базовые ладейные окончания. Позиция Лусены и Филидора — ваша азбука.',
      'В окончаниях считайте пешки, а не фигуры. Часто проходная пешка ценнее слона.',
      'Принцип Тarrasch: ладьи лучше ставить позади проходных — и своих, и чужих.',
      'Не торопитесь с ходами в эндшпиле. Здесь цена ошибки фатальна, а точный расчёт важнее интуиции.',
      'Разноцветные слоны в миттельшпиле — атакующий фактор, в эндшпиле — ничейный. Знайте это при разменах.',
      'Тренируйте эндшпиль на 4–5 фигур против компьютера. Добейтесь 100% точности в матовании, оппозиции, квадрате пешки.',
      'Выигранный эндшпиль — самый трудный психологически. Будьте максимально собраны, не расслабляйтесь раньше времени.',
    ],
  },
  {
    id: 'practical',
    title: 'Практическая игра и тайм-менеджмент',
    principles: [
      'Не играйте в дебюте на автомате. Даже знакомые ходы проверяйте на тактические идеи соперника.',
      'В цейтноте не поддавайтесь панике. Делайте безопасные, укрепляющие ходы: улучшайте короля, сдваивайте ладьи, избегайте резких движений.',
      'Оставляйте себе время на эндшпиль. Лучше потратить 10 минут сейчас, чем проиграть выигранное окончание в цейтноте.',
      'Думайте в то время, когда ходит соперник. Он обдумывает ход — вы обдумываете его угрозы и ваш ответ.',
      'Записывайте ходы до того, как их сделали. Это даёт паузу «глубокого взгляда» и снижает зевки.',
      'Если чувствуете усталость, встаньте из-за стола. Пройдитесь, умойтесь. Свежая голова важнее лишних пяти минут на расчёт.',
      'Следите за часами соперника. Если у него цейтнот, играйте энергичнее, ставьте проблемы, но не «зевоблиц».',
    ],
  },
  {
    id: 'psychology',
    title: 'Психология и характер',
    principles: [
      'Проиграли — дайте себе 10 минут эмоций, потом холодный анализ. Никакого самоедства, только факты: где ошибся и почему.',
      'Не сдавайтесь рано. В худшей позиции ищите практические шансы: ловушки, осложнения, переход в эндшпиль с шансами на ошибку.',
      'В выигранной позиции бойтесь больше, чем в проигранной. Расслабление наказывается мгновенно.',
      'Относитесь к сопернику с уважением. Недооценка — прямой путь к просмотру его угроз.',
      'Не бойтесь репутации соперника. Рейтинг — это цифры. За доской вы равны, и решает качество мышления здесь и сейчас.',
      'Играйте свою игру. Если соперник играет остро, а вы позиционно, не пытайтесь его переигрывать в его стиле. Навязывайте свой.',
      'Держите покерфейс. Не выказывайте эмоций после ходов. Радость или ужас дают сопернику информацию.',
      'В перерыве между партиями отвлекайтесь. Кино, прогулка, сон. Запрещено анализировать с друзьями — сожжёте энергию.',
    ],
  },
  {
    id: 'analysis',
    title: 'Анализ и работа над ошибками',
    principles: [
      'Анализируйте каждую турнирную партию дважды: без движка, потом с движком. Сначала вы должны сами понять, где ошиблись.',
      'Ищите момент, когда позиция изменила оценку. Конкретный ход, после которого всё пошло не так. Это и есть точка роста.',
      'Заведите дневник ошибок. Группируйте их по темам: «зевки в ладейных окончаниях», «недооценка жертвы на f7», «неправильный размен». Повторяйте перед турниром.',
      'Не верьте движку слепо. Он говорит «+0.7», но это для точной игры. В практической партии это может быть проиграно за 5 ходов.',
      'Смотрите свои партии не только с точки зрения плохих ходов, но и хороших. «Почему этот ход силён?» Понимание своих сильных сторон закрепляет их.',
      'Проигрывайте партии классиков. Возьмите партию Капабланки или Карпова и попробуйте угадывать их ходы. Это развивает позиционное чутьё.',
    ],
  },
  {
    id: 'training',
    title: 'Тренировки',
    principles: [
      'Тактика, тактика и ещё раз тактика. Ежедневно 30–60 минут. Без этого «чутья на удар» не будет.',
      'Изучайте типовые позиции миттельшпиля. Изолятор, Карлсбад, симметричные структуры — каждая имеет свой план. Знание типовых планов ускоряет игру в разы.',
      'Решайте этюды. Они учат находить красоту и нестандартные геометрические идеи, которые не снились тактическим задачникам.',
      'Играйте классические партии с контролем не менее 15+10. Блиц тренирует, но закрепляет поверхностное мышление.',
      'Тренируйте счёт вслепую. Держите в уме позицию после 3–4 ходов варианта, не передвигая фигуры на доске.',
      'Каждую неделю уделяйте время «физике» шахмат: пешечным структурам и эндшпилю. Это скелет игры.',
      'Используйте spaced repetition (интервальное повторение) для типовых позиций. Карточки Anki с ключевыми схемами творят чудеса.',
    ],
  },
  {
    id: 'computer',
    title: 'Работа с компьютером и базами',
    principles: [
      'Движок — для проверки, а не для анализа «с нуля». Сначала голова, потом «рыба».',
      'Ищите в базе партии, где игрок с вашим рейтингом обыграл более сильного в вашем дебюте. Это кладезь практических идей.',
      'Не играйте тренировочные партии против движка на максимуме. Это деморализует и не учит. Лучше ставить уровень чуть выше вашего и бороться.',
      'Создайте свою базу «идеальных партий». 30–50 эталонных партий на ваши дебюты с комментариями. Пересматривайте их перед соревнованиями.',
    ],
  },
  {
    id: 'tournament',
    title: 'Перед турниром и во время него',
    principles: [
      'Выспитесь за два дня до турнира. Сон в ночь перед игрой может быть хуже из-за волнения, поэтому важен запас.',
      'Питание: сложные углеводы и белок. Никакого сахара перед партией — через час будет спад энергии.',
      'Приходите за 10–15 минут. Чтобы настроиться, а не врываться с улицы в панике.',
      'Перед партией разомните мозг. Решите 5–10 лёгких тактик, чтобы «завести» расчёт.',
      'Не пейте кофе, если не привыкли. Тахикардия мешает считать длинные варианты.',
      'Ведите турнирный дневник. После каждого тура записывайте эмоции, физическое состояние, оценку игры. Это поможет понять свои пики и спады.',
    ],
  },
  {
    id: 'technical',
    title: 'Специфические технические советы',
    principles: [
      'В позициях с закрытым центром не торопитесь. Здесь бал правят манёвры, фланговая игра и выжидание ошибки.',
      'При пешечном штурме на короля считайте количество защитников. У кого в том секторе больше фигур, тот и прав.',
      'Не бойтесь жертвовать качество (ладью за коня/слона). Часто это разрушает пешечную структуру соперника и даёт долгую инициативу.',
      'Форсированный переход в эндшпиль — мощное оружие. Если видите, что окончание выиграно или сильно лучше, смело разменивайте ферзей.',
      'Учитесь держать равновесие в худших позициях без упрощений. Размен фигур может облегчить реализацию перевеса сопернику.',
      'Пат — последний рубеж защиты. Всегда проверяйте патовые конструкции в безнадёжном эндшпиле.',
      'При атаке на ферзевом фланге следите за контрударом в центре. Атака на фланге эффективна только при стабильном центре.',
      'Не меняйте автоматически ферзей в лучшей позиции. Иногда ферзь — главный инструмент добивания.',
      'Если у соперника слабый король, избегайте размена ферзей. И наоборот.',
    ],
  },
  {
    id: 'growth',
    title: 'Психология роста',
    principles: [
      'Не сравнивайте свой рейтинг с чужим. Сравнивайте свой уровень понимания сегодня и месяц назад.',
      'Плато — это нормально. Если прогресс остановился, значит, накопился объём, который скоро перейдёт в качество. Работайте дальше.',
      'Играйте с теми, кто сильнее. Поражения с ними учат больше, чем победы над слабыми.',
      'Объясняйте материал другому. Когда вы учите товарища, вы сами начинаете понимать глубже.',
      'Записывайте свои лекции/разборы на видео. Просмотр себя со стороны убирает иллюзию знания.',
      'Делайте перерывы. Одна неделя без шахмат в 2–3 месяца перезагружает мозг и лечит «замыленность».',
    ],
  },
  {
    id: 'wisdom',
    title: 'Финальная десятка — мудрость чемпионов',
    principles: [
      '«Лучше плохой план, чем никакого» (Шпильман). Без плана вы будете метаться и терять темпы.',
      '«Никогда не прерывайте противника, когда он ошибается» (Нанн). Не надо «спасать» соперника от его ошибок.',
      '«В шахматах учатся только на ошибках» (Ботвинник). Каждый зевок — урок. Усвойте его.',
      '«Угроза сильнее исполнения» (Нимцович). Иногда сама возможность удара парализует соперника сильнее, чем сам удар.',
      '«Труднее всего выиграть выигранную позицию» (Ласкер). Психологическая ловушка, помните о ней.',
      '«Атака — лучшая защита» работает, только если она обоснована.',
      '«Быстро сыгранная партия редко бывает хорошей» (Капабланка). Дайте себе время на раздумья.',
      '«Играйте ровно столько, сколько нужно, чтобы найти лучший ход, но не больше» (Фишер). Тренируйте чувство времени.',
      'Любите процесс, а не результат. Тогда рейтинг станет лишь приятным побочным эффектом роста.',
    ],
  },
];

const EXPLANATION_HINTS = [
  'Позиция иллюстрирует принцип на практике.',
  'Найдите лучший ход с учётом этого правила.',
  'Примените утверждение к расчёту варианта.',
];

/** @param {string} categoryId @param {number} principleIndex */
function pickPuzzles(categoryId, principleIndex) {
  const themes = CATEGORY_THEMES[categoryId] ?? ['tactics'];
  const scored = POOL.map((item, i) => {
    const score =
      item.tags.reduce((s, t) => s + (themes.includes(t) ? 3 : 0), 0) +
      ((principleIndex + i) % 7);
    return { score, item };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ha = createHash('md5').update(`${categoryId}-${principleIndex}-${a.item.fen}`).digest('hex');
    const hb = createHash('md5').update(`${categoryId}-${principleIndex}-${b.item.fen}`).digest('hex');
    return ha.localeCompare(hb);
  });

  /** @type {typeof POOL} */
  const chosen = [];
  const usedFens = new Set();
  for (const { item } of scored) {
    if (usedFens.has(item.fen)) continue;
    chosen.push(item);
    usedFens.add(item.fen);
    if (chosen.length === 3) break;
  }
  while (chosen.length < 3) {
    const item = POOL[(principleIndex + chosen.length) % POOL.length];
    if (!chosen.includes(item)) chosen.push(item);
  }
  return chosen;
}

/** @param {string} text @param {typeof POOL[0]} poolItem @param {number} exampleIndex */
function buildExplanation(text, poolItem, exampleIndex) {
  const firstSentence = text.split('.')[0].trim();
  const moveCount = poolItem.moves.trim().split(/\s+/).length;
  return `${EXPLANATION_HINTS[exampleIndex % EXPLANATION_HINTS.length]} «${firstSentence}». Линия из ${moveCount} ход(ов) показывает применение правила.`;
}

function buildCategories() {
  return CATEGORIES.map((category) => ({
    id: category.id,
    title: category.title,
    principles: category.principles.map((text, pIndex) => {
      const puzzlesRaw = pickPuzzles(category.id, pIndex);
      const puzzles = puzzlesRaw.map((poolItem, eIndex) => {
        validatePuzzle(poolItem.fen, poolItem.moves);
        return {
          id: puzzleId(category.id, pIndex, eIndex),
          title: `Пример ${eIndex + 1}`,
          fen: poolItem.fen,
          moves: poolItem.moves,
          explanation: buildExplanation(text, poolItem, eIndex),
        };
      });
      return { id: pid(category.id, pIndex), text, puzzles };
    }),
  }));
}

/** @param {ReturnType<typeof buildCategories>} categories */
function emitTs(categories) {
  const body = JSON.stringify(categories, null, 2);
  return `import type { StudyCategory } from './types';

export const STUDY_CATEGORIES: StudyCategory[] = ${body} as StudyCategory[];

export function getStudyStats() {
  const principles = STUDY_CATEGORIES.reduce((n, c) => n + c.principles.length, 0);
  const puzzles = STUDY_CATEGORIES.reduce(
    (n, c) => n + c.principles.reduce((m, p) => m + p.puzzles.length, 0),
    0,
  );
  return { categories: STUDY_CATEGORIES.length, principles, puzzles };
}
`;
}

for (const item of POOL) {
  try {
    validatePuzzle(item.fen, item.moves);
  } catch (e) {
    console.error('POOL FAIL', item.fen, item.moves, e.message);
    process.exit(1);
  }
}

const categories = buildCategories();
const totalPrinciples = categories.reduce((n, c) => n + c.principles.length, 0);
const totalPuzzles = categories.reduce(
  (n, c) => n + c.principles.reduce((m, p) => m + p.puzzles.length, 0),
  0,
);
console.log(`Categories: ${categories.length}, principles: ${totalPrinciples}, puzzles: ${totalPuzzles}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, emitTs(categories), 'utf8');
console.log(`Written: ${OUT}`);
