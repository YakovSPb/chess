#!/usr/bin/env bash
set -euo pipefail

ROOT="/root/chess"
cd "$ROOT"

git fetch --all
git reset --hard origin/main

# --- API ---
cd "$ROOT/apps/api"
if [ ! -d .venv ]; then
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
