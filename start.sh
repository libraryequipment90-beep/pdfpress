#!/bin/bash
# Start backend server in background
cd "$(dirname "$0")/server" || exit 1
npm ci
node server.js &
BACKEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT

# Start frontend server (exposed port)
cd ..
npm ci
npm run dev
