#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.blogsystem-run"
LOG_DIR="$RUN_DIR/logs"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://localhost:3000"
FRONTEND_RUNNER=""
UV_BIN=""
PNPM_BIN=""
COREPACK_BIN=""
NPM_BIN=""

mkdir -p "$LOG_DIR"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少命令: $command_name"
    exit 1
  fi
}

detect_frontend_runner() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_BIN="$(command -v pnpm)"
    FRONTEND_RUNNER="pnpm"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    COREPACK_BIN="$(command -v corepack)"
    FRONTEND_RUNNER="corepack-pnpm"
    return
  fi

  if command -v npm >/dev/null 2>&1; then
    NPM_BIN="$(command -v npm)"
    FRONTEND_RUNNER="npm"
    return
  fi

  echo "缺少前端包管理器: pnpm/corepack/npm"
  exit 1
}

check_dependencies() {
  UV_BIN="$(command -v uv)"
  detect_frontend_runner
}

install_frontend_dependencies() {
  case "$FRONTEND_RUNNER" in
    pnpm)
      (cd "$FRONTEND_DIR" && pnpm install)
      ;;
    corepack-pnpm)
      (cd "$FRONTEND_DIR" && corepack pnpm install)
      ;;
    npm)
      echo "未找到 pnpm，使用 npm 安装前端依赖。"
      (cd "$FRONTEND_DIR" && npm install --no-package-lock)
      ;;
  esac
}

run_frontend_dev() {
  case "$FRONTEND_RUNNER" in
    pnpm)
      exec pnpm dev
      ;;
    corepack-pnpm)
      exec corepack pnpm dev
      ;;
    npm)
      exec npm run dev
      ;;
  esac
}

start_backend() {
  if is_running "$BACKEND_PID_FILE"; then
    echo "后端已在运行，PID: $(cat "$BACKEND_PID_FILE")"
    return
  fi

  if [[ ! -f "$BACKEND_DIR/.env" && -f "$BACKEND_DIR/.env.example" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "已创建 backend/.env"
  fi

  if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
    echo "正在安装后端依赖..."
    (cd "$BACKEND_DIR" && "$UV_BIN" sync)
  fi

  echo "正在启动后端..."
  nohup sh -c "cd \"$BACKEND_DIR\" && exec \"$UV_BIN\" run uvicorn main:app --reload --host 127.0.0.1 --port 8000" \
    >"$LOG_DIR/backend.log" 2>&1 </dev/null &
  echo "$!" >"$BACKEND_PID_FILE"
  echo "后端 PID: $(cat "$BACKEND_PID_FILE")"
}

start_frontend() {
  if is_running "$FRONTEND_PID_FILE"; then
    echo "前端已在运行，PID: $(cat "$FRONTEND_PID_FILE")"
    return
  fi

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "正在安装前端依赖..."
    install_frontend_dependencies
  fi

  echo "正在启动前端..."
  case "$FRONTEND_RUNNER" in
    pnpm)
      NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-$BACKEND_URL/api}" nohup sh -c "cd \"$FRONTEND_DIR\" && exec \"$PNPM_BIN\" dev" \
        >"$LOG_DIR/frontend.log" 2>&1 </dev/null &
      ;;
    corepack-pnpm)
      NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-$BACKEND_URL/api}" nohup sh -c "cd \"$FRONTEND_DIR\" && exec \"$COREPACK_BIN\" pnpm dev" \
        >"$LOG_DIR/frontend.log" 2>&1 </dev/null &
      ;;
    npm)
      NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-$BACKEND_URL/api}" nohup sh -c "cd \"$FRONTEND_DIR\" && exec \"$NPM_BIN\" run dev" \
        >"$LOG_DIR/frontend.log" 2>&1 </dev/null &
      ;;
  esac
  echo "$!" >"$FRONTEND_PID_FILE"
  echo "前端 PID: $(cat "$FRONTEND_PID_FILE")"
}

check_dependencies
start_backend
start_frontend

cat <<EOF

启动完成。
前端地址: $FRONTEND_URL
后端地址: $BACKEND_URL
接口文档: $BACKEND_URL/api/docs

日志目录: $LOG_DIR
关闭服务: ./stop.sh
EOF
