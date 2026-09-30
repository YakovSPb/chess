#!/usr/bin/env bash
set -euo pipefail

ROOT="/root/chess"
cd "$ROOT"

git fetch --all
git reset --hard origin/main

# --- Stockfish (не в git) ---
SF_DIR="$ROOT/tools/stockfish"
SF_BIN="$SF_DIR/stockfish-ubuntu-x86-64-avx2"
if [ ! -x "$SF_BIN" ] && [ ! -x "$SF_DIR/stockfish" ]; then
  echo "Downloading Stockfish…"
  mkdir -p "$SF_DIR"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/stockfish.tar" \
    "https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-ubuntu-x86-64-avx2.tar"
  tar -xf "$TMP/stockfish.tar" -C "$TMP"
  FOUND="$(find "$TMP" -type f -name 'stockfish-ubuntu-x86-64-avx2' | head -n1)"
  if [ -z "$FOUND" ]; then
    echo "Stockfish binary not found in archive" >&2
    exit 1
  fi
  cp "$FOUND" "$SF_BIN"
  chmod +x "$SF_BIN"
  ln -sfn "stockfish-ubuntu-x86-64-avx2" "$SF_DIR/stockfish"
  rm -rf "$TMP"
fi

# --- API ---
cd "$ROOT/apps/api"
if [ ! -x .venv/bin/pip ]; then
  rm -rf .venv
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt

# --- Frontend ---
cd "$ROOT/apps/web"
npm ci --no-audit --no-fund
npm run build

# --- Static files for nginx ---
mkdir -p /var/www/chess.diabal.ru
rsync -a --delete "$ROOT/apps/web/dist/" /var/www/chess.diabal.ru/

# --- PM2 ---
cd "$ROOT/apps/api"
if pm2 describe chess-api >/dev/null 2>&1; then
  pm2 restart chess-api
else
  pm2 start .venv/bin/uvicorn \
    --name chess-api \
    --interpreter none \
    --cwd "$ROOT/apps/api" \
  -- app.main:app --host 127.0.0.1 --port 8000
fi

pm2 save

echo "Deploy complete: https://chess.diabal.ru"
