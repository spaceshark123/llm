#!/usr/bin/env bash
set -euo pipefail

# Simple cross-platform helper to run the full stack:
# - creates/activates a Python venv for backend
# - installs backend requirements
# - installs frontend deps
# - creates .env from .env.sample (prompts for GROQ_API_KEY if missing)
# - starts backend and frontend (backgrounded) and opens the browser
# Works in Linux/macOS and Windows environments with Git Bash / WSL.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; exit 1; }

# Track PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""
PID_FILE="$ROOT/.dev_pids"

cleanup() {
  if [ -f "$PID_FILE" ]; then
    info "Cleaning up background processes..."
    while read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}

trap cleanup EXIT INT TERM

# Detect python and check version
if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  err "Python is not installed. Please install Python 3.8+."
fi

# Verify Python version
PY_VERSION=$($PYTHON -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 8 ]; }; then
  err "Python 3.8+ required, found $PY_VERSION"
fi

info "Using Python $PY_VERSION"

# Create backend venv
VENV_DIR="$ROOT/backend/.venv"
if [ ! -d "$VENV_DIR" ]; then
  info "Creating Python virtual environment at $VENV_DIR"
  $PYTHON -m venv "$VENV_DIR"
fi

# Activate venv (works for Unix and Git Bash/WSL)
if [ -f "$VENV_DIR/bin/activate" ]; then
  # Unix-like
  source "$VENV_DIR/bin/activate"
elif [ -f "$VENV_DIR/Scripts/activate" ]; then
  # Windows (Git Bash)
  source "$VENV_DIR/Scripts/activate"
else
  warn "Could not find venv activation script. Continuing without virtualenv activation."
fi

# Verify pip is available
if ! command -v pip >/dev/null 2>&1; then
  err "pip is not available. Please ensure pip is installed."
fi

# Install backend requirements
if [ -f "backend/requirements.txt" ]; then
  info "Installing backend Python packages..."
  pip install --upgrade pip setuptools wheel >/dev/null
  pip install -r backend/requirements.txt
else
  warn "backend/requirements.txt not found. Skipping pip install."
fi

# Install frontend dependencies
if command -v npm >/dev/null 2>&1 && [ -f "frontend/package.json" ]; then
  info "Installing frontend NPM packages..."
  (cd frontend && npm install)
else
  warn "npm not found or frontend/package.json missing. Skipping npm install."
fi

# Ensure .env exists, prompt for GROQ_API_KEY if not present
if [ ! -f .env ]; then
  if [ -f .env.sample ]; then
    cp .env.sample .env
    info "Created .env from .env.sample"
  else
    warn ".env.sample not found; creating minimal .env"
    cat > .env <<EOF
GROQ_API_KEY=
DATA_PATH="data"
TEMP_PATH="temp"
CHROMA_PATH="chroma"
BACKEND_PORT=5050
VITE_API_URL=http://localhost:5050/api
USER_AGENT="Mozilla/5.0"
EOF
  fi
fi

# Ensure GROQ_API_KEY is set; prompt user if empty
GROQ_VAL="$(grep -E '^GROQ_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [ -z "$GROQ_VAL" ]; then
  printf "\n\033[1;33mGROQ_API_KEY is not set in .env.\033[0m\n"
  read -r -p "Paste your GROQ_API_KEY (leave blank to skip): " USER_KEY
  if [ -n "$USER_KEY" ]; then
    # Use cross-platform approach: create temp file
    grep -v '^GROQ_API_KEY=' .env > .env.tmp 2>/dev/null || touch .env.tmp
    echo "GROQ_API_KEY=$USER_KEY" >> .env.tmp
    mv .env.tmp .env
    info "Wrote GROQ_API_KEY to .env"
  else
    warn "GROQ_API_KEY not set. Some features (LLM) will not work without it."
  fi
fi

# Start backend
info "Starting backend..."
BACKEND_LOG="$ROOT/backend.log"
cd backend
$PYTHON app.py > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"
cd "$ROOT"
info "Backend started (PID: $BACKEND_PID, logs -> $BACKEND_LOG)"

# Wait for backend to be ready
info "Waiting for backend to start..."
BACKEND_PORT=$(grep -E '^BACKEND_PORT=' .env 2>/dev/null | cut -d= -f2 || echo "5050")
for i in {1..30}; do
  if curl -s "http://localhost:$BACKEND_PORT/" >/dev/null 2>&1; then
    info "Backend is ready!"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    err "Backend process died. Check $BACKEND_LOG for errors."
  fi
  sleep 1
done

# Start frontend
if [ -f "frontend/package.json" ]; then
  info "Starting frontend (Vite)..."
  FRONTEND_LOG="$ROOT/frontend.log"
  if command -v npm >/dev/null 2>&1; then
    cd frontend
    npm run dev > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" >> "$PID_FILE"
    cd "$ROOT"
    info "Frontend started (PID: $FRONTEND_PID, logs -> $FRONTEND_LOG)"
  else
    warn "npm not available; frontend not started."
  fi
else
  warn "frontend/package.json not found; skipping frontend start."
fi

# Wait for frontend to be ready and extract actual port
info "Waiting for frontend to start..."
FRONTEND_URL=""
for i in {1..30}; do
  if [ -n "$FRONTEND_PID" ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    warn "Frontend process died. Check $FRONTEND_LOG for errors."
    break
  fi
  
  # Extract the actual URL from Vite output
  if [ -f "$FRONTEND_LOG" ]; then
    FRONTEND_URL=$(grep -oE 'http://localhost:[0-9]+' "$FRONTEND_LOG" | head -1 || true)
    if [ -n "$FRONTEND_URL" ]; then
      info "Frontend is ready at $FRONTEND_URL"
      break
    fi
  fi
  sleep 1
done

# Fallback to default if URL not detected
if [ -z "$FRONTEND_URL" ]; then
  FRONTEND_URL="http://localhost:5173"
  warn "Could not detect frontend URL from logs. Using default: $FRONTEND_URL"
fi

# Open browser
info "Attempting to open $FRONTEND_URL in your default browser..."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FRONTEND_URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$FRONTEND_URL" >/dev/null 2>&1 || true
elif command -v start >/dev/null 2>&1; then
  start "$FRONTEND_URL" >/dev/null 2>&1 || true
else
  warn "Could not auto-open browser. Visit $FRONTEND_URL manually."
fi

info "Setup/launch complete!"
info "Backend logs: $BACKEND_LOG"
info "Frontend logs: $FRONTEND_LOG"
info ""
info "To stop the servers, run: kill \$(cat $PID_FILE)"
info "Or press Ctrl+C to stop this script and clean up processes."

# Keep script running to maintain trap
wait