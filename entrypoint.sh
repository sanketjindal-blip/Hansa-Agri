#!/bin/bash
set -e

echo "[ENTRYPOINT] Starting HANSA Agriculture application..."

# Start Nginx
echo "[ENTRYPOINT] Starting Nginx..."
nginx

# Start backend
echo "[ENTRYPOINT] Starting FastAPI backend..."
cd /app/backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 &
BACKEND_PID=$!

# Build and serve frontend
echo "[ENTRYPOINT] Building React frontend..."
cd /app/frontend

# Build the frontend
npm run build

# Serve the built frontend using a simple HTTP server
echo "[ENTRYPOINT] Serving built frontend..."
npx serve -s dist -l 3000 &
FRONTEND_PID=$!

echo "[ENTRYPOINT] All services started"
echo "[ENTRYPOINT] Backend PID: $BACKEND_PID"
echo "[ENTRYPOINT] Frontend PID: $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID
wait $FRONTEND_PID
