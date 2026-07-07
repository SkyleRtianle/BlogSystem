#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.blogsystem-run"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

is_pid() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

kill_process_tree() {
  local pid="$1"

  if ! is_pid "$pid" || ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  local children
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    kill_process_tree "$child"
  done

  kill "$pid" 2>/dev/null || true
}

wait_until_stopped() {
  local pid="$1"
  local attempts=20

  if ! is_pid "$pid"; then
    return
  fi

  while kill -0 "$pid" 2>/dev/null && (( attempts > 0 )); do
    sleep 0.2
    attempts=$((attempts - 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "${name} 未记录 PID，跳过。"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "${name} 未运行，清理 PID 文件。"
    rm -f "$pid_file"
    return
  fi

  echo "正在关闭 ${name}，PID: $pid"
  kill_process_tree "$pid"
  wait_until_stopped "$pid"
  rm -f "$pid_file"
  echo "${name} 已关闭。"
}

stop_port() {
  local name="$1"
  local port="$2"
  local pids

  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "发现 ${name} 端口 $port 仍被占用，清理残留进程: $pids"
  for pid in $pids; do
    kill_process_tree "$pid"
  done
  for pid in $pids; do
    wait_until_stopped "$pid"
  done
}

stop_service "前端" "$FRONTEND_PID_FILE"
stop_service "后端" "$BACKEND_PID_FILE"

for port in 3000 3001 3002; do
  stop_port "前端" "$port"
done

for port in 8000 8001; do
  stop_port "后端" "$port"
done

echo "关闭完成。"
