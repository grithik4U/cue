#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -r requirements.txt
printf '\nCue is starting at http://127.0.0.1:8000\n'
exec .venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
