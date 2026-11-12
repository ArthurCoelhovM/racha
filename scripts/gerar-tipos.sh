#!/usr/bin/env bash
# Gera src/lib/banco.ts com os tipos do banco, a partir das migrações.
# Precisa de um Postgres local: PGHOST, PGPORT e PGUSER (o mesmo dos testes do banco).
# Uso: npm run tipos:banco
set -euo pipefail

pasta="$(cd "$(dirname "$0")/.." && pwd)"
banco="tipos_organizador"

psql -q -d postgres -c "drop database if exists $banco" -c "create database $banco"
psql -q -v ON_ERROR_STOP=1 -d "$banco" -f "$pasta/supabase/testes/00_simular_supabase.sql"
for arquivo in "$pasta"/supabase/migrations/*.sql; do
  [[ "$arquivo" == *agendamentos* ]] && continue
  psql -q -v ON_ERROR_STOP=1 -d "$banco" -f "$arquivo"
done

if [[ "${PGHOST:-localhost}" == /* ]]; then
  url="postgresql://${PGUSER:-postgres}@localhost:${PGPORT:-5432}/$banco?sslmode=disable&host=$PGHOST"
else
  url="postgresql://${PGUSER:-postgres}:${PGPASSWORD:-}@${PGHOST:-localhost}:${PGPORT:-5432}/$banco?sslmode=disable"
fi

saida="$pasta/src/lib/banco.ts"
{
  echo "// Gerado por scripts/gerar-tipos.sh a partir das migrações. Não edite à mão."
  npx -y supabase@2.122.1 gen types typescript --db-url "$url" --schema public 2>/dev/null
} > "$saida"
npx -y prettier@3.6.2 --log-level warn --write "$saida"
psql -q -d postgres -c "drop database $banco"
echo "tipos gerados em src/lib/banco.ts"
