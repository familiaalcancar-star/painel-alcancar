"""Gera o SQL de importação a partir de dados-exportados/ (rodar no computador, nunca commitar a saída).
Uso: python3 -I supabase/importacao/gerar_sql.py dados-exportados > importacao.sql
As imagens (imagens/*.webp) são servidas pelo próprio site em public/imagens/."""
import json, os, sys

pasta = sys.argv[1]
ler = lambda n: json.load(open(os.path.join(pasta, n), encoding='utf8'))
q = lambda o: "'" + json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("'", "''") + "'::jsonb"
s = lambda v: "'" + str(v).replace("'", "''") + "'"

cfg = ler('config.json')
cfg.pop('pessoas', None); cfg.pop('lideres', None)   # pessoas vão se cadastrar de novo
print('begin;')
print(f"insert into config (id, d) values ('geral', {q(cfg)}) on conflict (id) do update set d = excluded.d, atualizado_em = now();")
print("insert into config_privada (id, d) values ('geral', '{\"whatsAdm\":\"5511958800779\"}'::jsonb) on conflict (id) do nothing;")
for x in ler('escalas.json'):
    i = x.pop('id')
    print(f"insert into escalas (id, d) values ({s(i)}, {q(x)}) on conflict (id) do update set d = excluded.d;")
for tab in ('avisos', 'eventos'):
    for x in ler(tab + '.json'):
        i = x.pop('id'); x.pop('autor', None)        # ids antigos do Claude não valem aqui
        criado = x.get('criadoEm') or x.get('atualizadoEm')
        extra = f", criado_em" if criado else ''
        val = f", {s(criado)}" if criado else ''
        print(f"insert into {tab} (id, d{extra}) values ({s(i)}, {q(x)}{val}) on conflict (id) do update set d = excluded.d;")
print('commit;')
