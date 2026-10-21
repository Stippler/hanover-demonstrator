#!/usr/bin/env bash
# Run the integration test (APIs + EDC + DB verification) inside the Docker network.
# Requires: stack running (docker compose up -d), from project root.
set -e
cd "$(dirname "$0")/.."
docker compose run --rm -v "$(pwd)/backend:/app" vendor-api python /app/scripts/integration_test.py
