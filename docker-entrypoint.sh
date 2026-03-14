#!/bin/sh
# docker-entrypoint.sh — runs before the app starts inside the container.
# Applies any pending Drizzle migrations, then hands off to the main process.

echo "[entrypoint] Running database migrations..."
if ! node_modules/.bin/drizzle-kit migrate; then
  echo "[entrypoint] ERROR: Database migration failed. Check DATABASE_URL and DB connectivity."
  exit 1
fi

echo "[entrypoint] Migrations complete. Starting server..."
exec "$@"
