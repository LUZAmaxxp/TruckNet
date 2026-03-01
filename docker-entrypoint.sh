#!/bin/sh
# docker-entrypoint.sh — runs before the app starts inside the container.
# Applies any pending Drizzle migrations, then hands off to the main process.
set -e

echo "[entrypoint] Running database migrations..."
node_modules/.bin/drizzle-kit migrate

echo "[entrypoint] Migrations complete. Starting server..."
exec "$@"
