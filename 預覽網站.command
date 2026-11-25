#!/bin/bash
# IHS Lab 網站本機預覽（macOS）
# 雙擊此檔：啟動本機伺服器並以預設瀏覽器開啟網站。
# 結束預覽：關閉這個終端機視窗，或按 Control + C。
# 第一次使用若出現「沒有權限」，請在終端機執行一次：chmod +x 預覽網站.command

cd "$(dirname "$0")" || exit 1
PORT=8123

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "找不到 Python。請先安裝：https://www.python.org/downloads/"
  read -r -p "按 Enter 關閉…"
  exit 1
fi

# 若埠號已被占用，直接開啟瀏覽器即可
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "伺服器已在執行中，直接開啟 http://localhost:$PORT/"
  open "http://localhost:$PORT/"
  exit 0
fi

(sleep 1 && open "http://localhost:$PORT/") &
echo "網站預覽：http://localhost:$PORT/"
echo "結束預覽請按 Control + C 或關閉此視窗。"
"$PY" -m http.server "$PORT"
