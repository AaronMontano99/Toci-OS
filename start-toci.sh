#!/bin/bash
# Starts the Toci OS backend + mobile app for local Expo Go / Simulator testing.
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Node ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0 is required (see
# mobile/README.md). If a project-scoped Node install exists at this path
# (used to work around a system Node that's out of range without touching
# the machine's default Node), prefer it.
NODE22="$HOME/.local/node22/bin"
if [ -d "$NODE22" ]; then
  export PATH="$NODE22:$PATH"
fi
echo "Using node $(node -v 2>/dev/null || echo 'not found') — see mobile/README.md if expo start fails with a parseEnv error."

LAN_IP=$(ipconfig getifaddr en0)
if [ -z "$LAN_IP" ]; then
  echo "Could not detect a LAN IP on en0 (Wi-Fi). Are you connected to Wi-Fi?"
  exit 1
fi
echo "LAN IP: $LAN_IP"

# --- Backend ---
cd "$REPO/app"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt
  python -m toci.seed
else
  source .venv/bin/activate
fi

if ! curl -s -o /dev/null http://localhost:8000; then
  echo "Starting backend..."
  uvicorn toci.main:app --host 0.0.0.0 --port 8000 > /tmp/toci-backend.log 2>&1 &
  disown
  sleep 2
else
  echo "Backend already running."
fi

# --- Mobile ---
cd "$REPO/mobile"
echo "EXPO_PUBLIC_API_URL=http://$LAN_IP:8000" > .env.local

if [ ! -d node_modules ]; then
  npm install
fi

echo ""
echo "Starting Expo. Options once it's up:"
echo "  - Physical phone in Expo Go: needs your phone and this Mac on the same"
echo "    Wi-Fi with no client/AP isolation (this was the blocker before)."
echo "  - iOS Simulator: press 'i' in this terminal, or it opens automatically"
echo "    with --ios below."
echo ""

# Pin the installed Expo Go client version — do NOT remove this. Without it,
# `expo start` silently auto-upgrades Expo Go to the SDK's "recommended"
# build on every run with no way to opt out non-interactively. That
# auto-upgrade replaced a known-working client with one that segfaulted on
# launch every time on this Mac (see mobile/README.md). EXPO_OFFLINE=1
# skips that version check entirely as long as Expo Go is already
# installed on the simulator, so the working version never gets replaced.
export EXPO_OFFLINE=1
npx expo start --ios
