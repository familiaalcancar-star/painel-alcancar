#!/bin/sh
# Testa as permissões (RLS) num Postgres local que simula o Supabase.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres sh supabase/testes/rodar.sh
# A config de teste é lida de dados-exportados/config.json (não vai para o GitHub).
set -e
cd "$(dirname "$0")"
python3 -I -c "
import json; c=json.load(open('../../dados-exportados/config.json'))
print(\"insert into config values ('geral', '\"+json.dumps(c,ensure_ascii=False).replace(\"'\",\"''\")+\"'::jsonb);\")" > /tmp/config-teste.sql
psql -q -c 'drop database if exists painel_teste' -c 'create database painel_teste'
psql -q -v ON_ERROR_STOP=1 -d painel_teste -f 01-simula-supabase.sql -f ../schema.sql -f 02-permissoes-padrao.sql -f /tmp/config-teste.sql -f 03-dados-de-teste.sql >/dev/null
psql -q -t -A -d painel_teste -f 04-testes.sql | awk '{print} /FALHOU/{f++} END{print NR" testes, "f+0" falhas"; exit f>0}'
