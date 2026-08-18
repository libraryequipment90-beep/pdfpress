#!/bin/bash
# Start backend server in background
cd "$(dirname "$0")/server" || exit 1
npm install
node server.js &
BACKEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT

# Start frontend server (exposed port)
cd ..
npm install
npm run dev
