#!/bin/sh
set -e  # any failure below stops the script — container won't start uvicorn on a broken migration

echo "Running database migrations..."
alembic upgrade head

echo "Migrations complete. Starting Clarix backend..."
exec uvicorn backend.app:app --host 0.0.0.0 --port 8000