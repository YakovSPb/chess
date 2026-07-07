LESSONS = [
    {
        "title": "Эндшпиль: король и пешка против короля",
        "category": "endgame",
        "description": "Правило квадрата, оппозиция и продвижение проходной пешки.",
        "difficulty": 2,
        "steps": [
            {
                "fen": "8/8/8/8/8/4K3/8/3P3k w - - 0 1",
                "expected_move": "Kd4",
                "explanation": "Король идёт вперёд, сопровождая проходную пешку.",
            },
            {
                "fen": "8/8/8/3K4/8/8/3P4/4k3 w - - 0 1",
                "expected_move": "Kc5",
                "explanation": "Король занимает ключевые поля перед пешкой.",
            },
        ],
    },
    {
        "title": "Ладейный эндшпиль: 7-я горизонталь",
        "category": "endgame",
        "description": "Ладья на 7-й горизонтали создаёт сильное давление на пешки соперника.",
        "difficulty": 2,
        "steps": [
            {
                "fen": "6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1",
                "expected_move": "Re1",
                "explanation": "Ладья выходит на открытую линию.",
            },
            {
                "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
                "expected_move": "Re7",
                "explanation": "Ладья на 7-й горизонтале атакует пешки f7 и g7.",
            },
        ],
    },
    {
        "title": "Тактика: вилка",
        "category": "tactics",
        "description": "Вилка — одна фигура атакует две или более фигур соперника одновременно.",
        "difficulty": 1,
        "steps": [
            {
                "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
                "expected_move": "Ng5",
                "explanation": "Конь атакует слабую пешку f7, создавая угрозы.",
            },
        ],
    },
    {
        "title": "Тактика: связка",
        "category": "tactics",
        "description": "Связка — фигура не может уйти, потому что за ней стоит более ценная фигура.",
        "difficulty": 1,
        "steps": [
            {
                "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4",
                "expected_move": "Bc5",
                "explanation": "Слон связывает коня f3 с королём (если король на e1).",
            },
        ],
    },
    {
        "title": "Тактика: мат на последней горизонтали",
        "category": "tactics",
        "description": "Классический мат ладьёй на 8-й (или 1-й) горизонтали при запертом короле.",
        "difficulty": 2,
        "steps": [
            {
                "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
                "expected_move": "Re8",
                "explanation": "Ладья даёт мат на 8-й горизонтали.",
            },
        ],
    },
]
