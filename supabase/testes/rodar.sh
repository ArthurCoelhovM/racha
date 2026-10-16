#!/usr/bin/env bash
# Roda as migrações e os testes num banco Postgres limpo.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/testes/rodar.sh
set -euo pipefail

pasta="$(cd "$(dirname "$0")/.." && pwd)"
banco="teste_organizador"

psql -q -d postgres -c "drop database if exists $banco" -c "create database $banco"
psql -q -v ON_ERROR_STOP=1 -d "$banco" -f "$pasta/testes/00_simular_supabase.sql"
for arquivo in "$pasta"/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$banco" -f "$arquivo"
done
psql -q -v ON_ERROR_STOP=1 -d "$banco" -f "$pasta/testes/01_testes.sql"
