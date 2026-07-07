from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    puzzle_rating: float
    puzzle_streak: int

    class Config:
        from_attributes = True


class GameCreate(BaseModel):
    mode: str = "bot"
    bot_elo: int | None = 1200
    time_control: str | None = None
    player_color: str = "white"


class GameUpdate(BaseModel):
    pgn: str | None = None
    result: str | None = None
    analysis: dict[str, Any] | None = None
    coach_summary: str | None = None


class GameResponse(BaseModel):
    id: int
    mode: str
    bot_elo: int | None
    time_control: str | None
    pgn: str
    result: str | None
    player_color: str
    analysis: dict[str, Any] | None
    coach_summary: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class MoveAnalysis(BaseModel):
    move_number: int
    move_san: str
    eval_before: float
    eval_after: float
    best_move: str | None
    cpl_loss: float
    classification: str


class GameAnalysisRequest(BaseModel):
    moves: list[MoveAnalysis]


class PuzzleResponse(BaseModel):
    id: int
    lichess_id: str
    fen: str
    rating: int
    themes: str
    moves: str | None = None
    solved: bool | None = None

    class Config:
        from_attributes = True


class PuzzleLevelResponse(BaseModel):
    id: str
    label: str
    min_rating: int
    max_rating: int
    total: int
    solved: int


class PuzzleListItem(BaseModel):
    id: int
    lichess_id: str
    rating: int
    themes: str
    solved: bool
    index: int


class PuzzleSolveRequest(BaseModel):
    moves: list[str]
    time_ms: int | None = None


class PuzzleSolveResponse(BaseModel):
    correct: bool
    puzzle_rating_change: float
    new_rating: float
    streak: int


class CoachHintRequest(BaseModel):
    fen: str
    last_move: str | None = None
    eval_cp: float | None = None
    best_line: list[str] | None = None
    hint_level: int = Field(default=1, ge=1, le=3)
    user_rating: int = 1200
    pgn: str | None = None


class CoachExplainRequest(BaseModel):
    fen: str
    move_san: str
    eval_before: float
    eval_after: float
    best_move: str | None = None
    best_line: list[str] | None = None
    user_rating: int = 1200


class CoachResponse(BaseModel):
    message: str


class CoachChatMessage(BaseModel):
    role: str
    content: str


class CoachChatRequest(BaseModel):
    message: str
    page: str = ""
    fen: str | None = None
    details: str | None = None
    history: list[CoachChatMessage] = Field(default_factory=list)


class SummarizeGameRequest(BaseModel):
    pgn: str
    analysis_summary: str = ""


class LessonResponse(BaseModel):
    id: int
    title: str
    category: str
    description: str
    difficulty: int
    steps_count: int

    class Config:
        from_attributes = True


class LessonDetailResponse(LessonResponse):
    steps: list[dict[str, Any]]


class LessonProgressUpdate(BaseModel):
    current_step: int
    completed: bool = False


class OpeningResponse(BaseModel):
    id: int
    title: str
    eco: str
    description: str
    popularity: int
    player_color: str
    steps_count: int
    completed: bool = False

    class Config:
        from_attributes = True


class OpeningDetailResponse(OpeningResponse):
    steps: list[dict[str, Any]]
    pros: list[dict[str, Any]]
    cons: list[str]


class DashboardStats(BaseModel):
    puzzle_rating: float
    puzzle_streak: int
    games_played: int
    avg_accuracy: float | None
    weak_themes: list[str]
    recommendation: str
    recent_games: list[GameResponse]
