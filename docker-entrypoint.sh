#!/bin/sh
# docker-entrypoint.sh
# Push schema; seed only if the Task table is empty (so persisted volumes
# survive container restarts without losing user data).

set -e

DB_PATH="${DB_PATH:-/app/data/dev.db}"
mkdir -p "$(dirname "$DB_PATH")"

# Detect whether the database has any tasks BEFORE we push/seed.
HAS_DATA="no"
if [ -s "$DB_PATH" ]; then
  COUNT="$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.task.count().then(c=>{console.log(c);return p.\$disconnect();}).catch(()=>{console.log(0);process.exit(0);});" 2>/dev/null || echo 0)"
  if [ "$COUNT" -gt 0 ] 2>/dev/null; then
    HAS_DATA="yes"
  fi
fi

echo "[opstwin] applying prisma schema..."
npx prisma db push --skip-generate --accept-data-loss

if [ "$HAS_DATA" = "no" ] || [ -n "${OPSTWIN_FORCE_SEED:-}" ]; then
  echo "[opstwin] seeding initial data..."
  npx tsx prisma/seed.ts || echo "[opstwin] seed failed (continuing)"
else
  echo "[opstwin] existing data detected — skipping seed"
fi

echo "[opstwin] starting next on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}"
