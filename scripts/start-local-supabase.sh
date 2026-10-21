#!/usr/bin/env bash
# Start the in-repo Supabase stack (Postgres, Kong, Auth, Storage, etc.) for local development.
# Requires: docker compose, and supabase/.env (copy from supabase/.env.example).
set -e
cd "$(dirname "$0")/.."

if [[ ! -f supabase/.env ]]; then
  echo "Missing supabase/.env. Copy from supabase/.env.example and set at least POSTGRES_PASSWORD."
  echo "  cp supabase/.env.example supabase/.env"
  exit 1
fi

echo "Starting Supabase stack (project name: supabase, network: supabase_default)..."
docker compose -f supabase/docker-compose.yml -p supabase up -d

echo ""
echo "Next steps:"
echo "  1. Apply Hanover schema:"
echo "     docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/001_initial_schema.sql"
echo "  2. In root .env set: POSTGRES_HOST=supabase-db, POSTGRES_PASSWORD (from supabase/.env),"
echo "     SUPABASE_URL=http://supabase-kong:8000, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from supabase/.env,"
echo "     and NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000"
echo "  3. Start main stack: docker compose up -d"
echo ""
echo "Supabase Studio (Kong API): http://localhost:8000"
