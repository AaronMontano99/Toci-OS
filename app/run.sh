#!/usr/bin/env bash
# Starts the Toci OS demo. Run from anywhere: ~/Projects/Toci-OS/app/run.sh
set -e
cd "$(dirname "$0")"
source .venv/bin/activate
echo "Starting Toci OS at http://127.0.0.1:8000 (Ctrl+C to stop)"
exec uvicorn toci.main:app --host 127.0.0.1 --port 8000 --reload
