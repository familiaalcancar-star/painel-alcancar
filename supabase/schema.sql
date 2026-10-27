-- =====================================================================
-- Painel Família Alcançar — esquema do banco (Supabase / Postgres)
-- Rodar inteiro no Supabase: SQL Editor → New query → colar → Run.
-- Todas as permissões ficam aqui (Row Level Security), não só na tela.
-- =====================================================================

-- ---------- Tabelas ----------

-- Configuração pública (conexões, cultos, áreas, endereço, redes).
-- Linha única com id = 'geral'. Não guardar dados de pessoas aqui.
create table if not exists config (
  id text primary key,
  d jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- Configuração só para quem está logado (ex.: WhatsApp do administrador).
create table if not exists config_privada (
  id text primary key,
  d jsonb not null default '{}'::jsonb
);

-- Pessoas aprovadas. Uma linha por conta (auth.users).
create table if not exists pessoas (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text not null default '',
  apelido text not null default '',
  whatsapp text not null default '',
  conexao text,
  papel text not null default 'leitura'
    check (papel in ('admin','lider','auxiliar','organizacao','leitura')),
  gestao boolean not null default false,
  ministro boolean not null default false,
  avisos boolean not null default false,
  escala boolean not null default false,   -- extra "Escala": preenche Direção/Super Kids de qualquer conexão
  criado_em timestamptz not null default now()
);

-- Pedidos de cadastro ainda não aprovados (a própria pessoa preenche).
create table if not exists cadastros (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text not null,
  apelido text not null default '',
  whatsapp text not null,
  conexao text not null,
  papel text not null check (papel in ('lider','auxiliar','organizacao')),
  em timestamptz not null default now()
);

-- Lista antiga de pessoas (do painel no Claude), só para o admin associar.
create table if not exists pessoas_referencia (
  id_antigo text primary key,
  d jsonb not null
);

-- Último acesso de cada conta (substitui a coleção "membros").
create table if not exists acessos (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  visto timestamptz not null default now()
);

-- Lista de conexões de uma escala: "conexoes[]" ou, nos registros antigos, "conexao".
create or replace function conexoes_de(d jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(d->'conexoes') = 'array' and jsonb_array_length(d->'conexoes') > 0
              then d->'conexoes'
              when d->>'conexao' is not null then to_jsonb(array[d->>'conexao'])
              else '[]'::jsonb end
$$;

-- Escalas: um registro por data + culto + área. "d" guarda o documento
-- completo (data, culto, area, conexao, conexoes[], funcoes[], obs).
create table if not exists escalas (
  id text primary key,                      -- ex.: 2026-10-04_manha_direcao
  d jsonb not null,
  data text generated always as (d->>'data') stored,
  culto text generated always as (d->>'culto') stored,
  area text generated always as (d->>'area') stored,
  conexoes jsonb generated always as (conexoes_de(d)) stored,
  autor uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index if not exists escalas_data_idx on escalas (data);

create table if not exists avisos (
  id text primary key,
  d jsonb not null,
  autor uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists eventos (
  id text primary key,
  d jsonb not null,
  data text generated always as (d->>'data') stored,
  autor uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists eventos_data_idx on eventos (data);

-- Marcas do check-in (em tempo real entre aparelhos).
create table if not exists checkin_marcas (
  data text not null,
  culto text not null,
  chave text not null,
  ci boolean not null default false,
  ret boolean not null default false,
  dev boolean not null default false,
  nome text not null default '',
  escalado text not null default '',
  area text not null default '',
  funcao text not null default '',
  por uuid references auth.users(id) on delete set null,
  em timestamptz not null default now(),
  primary key (data, culto, chave)
);

-- Histórico: quem criou/editou/excluiu o quê.
create table if not exists historico (
  id bigint generated always as identity primary key,
  acao text not null,
  tipo text not null,
  resumo text not null default '',
  antes jsonb,
  depois jsonb,
  por uuid default auth.uid(),
  por_nome text not null default '',
  em timestamptz not null default now()
);
create index if not exists historico_em_idx on historico (em desc);

-- ---------- Funções de permissão ----------
-- "security definer" para lerem a tabela pessoas sem cair na própria RLS.

create or replace function minha_pessoa() returns pessoas
language sql stable security definer set search_path = public as $$
  select * from pessoas where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' from pessoas where id = auth.uid()), false)
$$;

create or replace function eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('lider','auxiliar','organizacao') from pessoas where id = auth.uid()), false)
$$;

-- Conexão da pessoa, só se ela for Líder / Auxiliar / Organização.
create or replace function minha_conexao() returns text
language sql stable security definer set search_path = public as $$
  select conexao from pessoas
   where id = auth.uid() and papel in ('lider','auxiliar','organizacao')
$$;

create or replace function tem_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' or gestao from pessoas where id = auth.uid()), false)
$$;

create or replace function tem_avisos() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' or avisos from pessoas where id = auth.uid()), false)
$$;

-- Extra "Escala": preenche Direção do culto e Super Kids de qualquer conexão.
create or replace function tem_escala() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select escala from pessoas where id = auth.uid()), false)
$$;

-- Louvor: extra "Ministro" ou equipe das conexões Flechas, Forasteiros, Heróis.
create or replace function pode_louvor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ministro
      or (papel in ('lider','auxiliar','organizacao') and conexao in ('flechas','forasteiros','herois'))
    from pessoas where id = auth.uid()), false)
$$;

-- A área é "por conexão" (Direção do culto, Super Kids)? Lê da config.
create or replace function area_por_conexao(a text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (x->>'porConexao')::boolean
      from config c, jsonb_array_elements(c.d->'areas') x
     where c.id = 'geral' and x->>'id' = a limit 1), false)
$$;

create or replace function pode_editar_escala(a text, cons jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
      or (a = 'louvor' and pode_louvor())
      or (area_por_conexao(a) and tem_escala())
      or (area_por_conexao(a) and minha_conexao() is not null and cons ? minha_conexao())
$$;

-- ---------- Travas extras (gatilhos) ----------

-- Quem não é admin não muda data, culto, área nem conexões de uma escala.
create or replace function escalas_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not is_admin() then
    if (new.d->>'data') is distinct from (old.d->>'data')
       or (new.d->>'culto') is distinct from (old.d->>'culto')
       or (new.d->>'area') is distinct from (old.d->>'area')
       or conexoes_de(new.d) is distinct from conexoes_de(old.d) then
      raise exception 'Data, culto, área e conexão ficam travados para quem não é administrador.';
    end if;
    new.autor := old.autor;
  end if;
  if tg_op = 'INSERT' then new.autor := coalesce(new.autor, auth.uid()); end if;
  new.atualizado_por := auth.uid();
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists escalas_guarda on escalas;
create trigger escalas_guarda before insert or update on escalas
  for each row execute function escalas_guarda();

-- Avisos/eventos: o autor é sempre quem criou; não dá para "trocar" o dono.
create or replace function autoria_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Sem usuário logado = script de importação: mantém autor e data originais.
    if auth.uid() is not null then
      if not is_admin() or new.autor is null then new.autor := auth.uid(); end if;
      new.criado_em := now();
    end if;
  else
    new.autor := old.autor;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists avisos_autoria on avisos;
create trigger avisos_autoria before insert or update on avisos
  for each row execute function autoria_guarda();
drop trigger if exists eventos_autoria on eventos;
create trigger eventos_autoria before insert or update on eventos
  for each row execute function autoria_guarda();

-- Check-in: grava quem marcou e quando.
create or replace function checkin_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.por := auth.uid(); new.em := now(); return new;
end $$;
drop trigger if exists checkin_guarda on checkin_marcas;
create trigger checkin_guarda before insert or update on checkin_marcas
  for each row execute function checkin_guarda();

-- Histórico: "por" é sempre a própria conta (ninguém registra em nome de outro).
create or replace function historico_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.por := auth.uid();
  new.em := now();
  -- Mostra só o apelido; sem apelido, só o primeiro nome.
  new.por_nome := coalesce((select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from pessoas where id = auth.uid()),
                           (select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from cadastros where id = auth.uid()), '');
  return new;
end $$;
drop trigger if exists historico_guarda on historico;
create trigger historico_guarda before insert on historico
  for each row execute function historico_guarda();

-- ---------- Row Level Security ----------

alter table config            enable row level security;
alter table config_privada    enable row level security;
alter table pessoas           enable row level security;
alter table cadastros         enable row level security;
alter table pessoas_referencia enable row level security;
alter table acessos           enable row level security;
alter table escalas           enable row level security;
alter table avisos            enable row level security;
alter table eventos           enable row level security;
alter table checkin_marcas    enable row level security;
alter table historico         enable row level security;

-- config: todos leem (inclusive sem login); só admin altera.
drop policy if exists config_ler on config;
create policy config_ler on config for select using (true);
drop policy if exists config_admin on config;
create policy config_admin on config for all to authenticated using (is_admin()) with check (is_admin());

-- config_privada: quem está logado lê; só admin altera.
drop policy if exists cfgp_ler on config_privada;
create policy cfgp_ler on config_privada for select to authenticated using (true);
drop policy if exists cfgp_admin on config_privada;
create policy cfgp_admin on config_privada for all to authenticated using (is_admin()) with check (is_admin());

-- pessoas: cada um lê a própria linha; admin lê e altera todas.
drop policy if exists pessoas_ler on pessoas;
create policy pessoas_ler on pessoas for select to authenticated using (id = auth.uid() or is_admin());
drop policy if exists pessoas_admin on pessoas;
create policy pessoas_admin on pessoas for all to authenticated using (is_admin()) with check (is_admin());

-- Nomes (sem WhatsApp) para mostrar autores, para quem está logado.
drop view if exists pessoas_nomes;
create or replace function pessoas_nomes() returns table (id uuid, nome text, apelido text)
language sql stable security definer set search_path = public as $$
  select id, nome, apelido from pessoas where auth.uid() is not null
$$;

-- cadastros: a pessoa cria/edita/apaga o próprio pedido; admin vê e apaga todos.
drop policy if exists cad_ler on cadastros;
create policy cad_ler on cadastros for select to authenticated using (id = auth.uid() or is_admin());
drop policy if exists cad_criar on cadastros;
create policy cad_criar on cadastros for insert to authenticated
  with check (id = auth.uid() and not exists (select 1 from pessoas where id = auth.uid() and papel <> 'leitura'));
drop policy if exists cad_editar on cadastros;
create policy cad_editar on cadastros for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists cad_apagar on cadastros;
create policy cad_apagar on cadastros for delete to authenticated using (id = auth.uid() or is_admin());

-- pessoas_referencia: só admin.
drop policy if exists ref_admin on pessoas_referencia;
create policy ref_admin on pessoas_referencia for all to authenticated using (is_admin()) with check (is_admin());

-- acessos: cada um grava o próprio; admin lê todos.
drop policy if exists acessos_ler on acessos;
create policy acessos_ler on acessos for select to authenticated using (id = auth.uid() or is_admin());
drop policy if exists acessos_gravar on acessos;
create policy acessos_gravar on acessos for insert to authenticated with check (id = auth.uid());
drop policy if exists acessos_atualizar on acessos;
create policy acessos_atualizar on acessos for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists acessos_apagar on acessos;
create policy acessos_apagar on acessos for delete to authenticated using (id = auth.uid() or is_admin());

-- escalas: todos leem; criar = admin (ou Louvor para quem pode);
-- editar = regra pode_editar_escala; excluir = admin.
drop policy if exists esc_ler on escalas;
create policy esc_ler on escalas for select using (true);
drop policy if exists esc_criar on escalas;
create policy esc_criar on escalas for insert to authenticated
  with check (is_admin() or (d->>'area' = 'louvor' and pode_louvor()));
drop policy if exists esc_editar on escalas;
create policy esc_editar on escalas for update to authenticated
  using (pode_editar_escala(area, conexoes))
  with check (pode_editar_escala(d->>'area', conexoes_de(d)));
drop policy if exists esc_apagar on escalas;
create policy esc_apagar on escalas for delete to authenticated using (is_admin());

-- avisos e eventos: todos leem; criar = admin ou extra Avisos/Eventos;
-- editar/excluir = admin, ou o próprio autor com o extra.
drop policy if exists av_ler on avisos;
create policy av_ler on avisos for select using (true);
drop policy if exists av_criar on avisos;
create policy av_criar on avisos for insert to authenticated with check (tem_avisos());
drop policy if exists av_editar on avisos;
create policy av_editar on avisos for update to authenticated
  using (is_admin() or (tem_avisos() and autor = auth.uid())) with check (tem_avisos());
drop policy if exists av_apagar on avisos;
create policy av_apagar on avisos for delete to authenticated
  using (is_admin() or (tem_avisos() and autor = auth.uid()));

drop policy if exists ev_ler on eventos;
create policy ev_ler on eventos for select using (true);
drop policy if exists ev_criar on eventos;
create policy ev_criar on eventos for insert to authenticated with check (tem_avisos());
drop policy if exists ev_editar on eventos;
create policy ev_editar on eventos for update to authenticated
  using (is_admin() or (tem_avisos() and autor = auth.uid())) with check (tem_avisos());
drop policy if exists ev_apagar on eventos;
create policy ev_apagar on eventos for delete to authenticated
  using (is_admin() or (tem_avisos() and autor = auth.uid()));

-- check-in: só Gestão e admin.
drop policy if exists ck_gestao on checkin_marcas;
create policy ck_gestao on checkin_marcas for all to authenticated using (tem_gestao()) with check (tem_gestao());

-- histórico: quem está logado registra o que fez; só admin lê.
drop policy if exists hist_gravar on historico;
create policy hist_gravar on historico for insert to authenticated with check (true);
drop policy if exists hist_ler on historico;
create policy hist_ler on historico for select to authenticated using (is_admin());

-- ---------- Bate-papo ----------
-- Só pessoas aprovadas (com linha em "pessoas", de qualquer função) leem e escrevem.
-- Cada um apaga as próprias mensagens; admin apaga qualquer uma.
create table if not exists chat (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 1 and 1000),
  por uuid default auth.uid() references auth.users(id) on delete set null,
  em timestamptz not null default now()
);
create index if not exists chat_em_idx on chat (em desc);
alter table chat enable row level security;

create or replace function chat_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.por := auth.uid(); new.em := now(); return new; end $$;
drop trigger if exists chat_guarda on chat;
create trigger chat_guarda before insert on chat for each row execute function chat_guarda();

drop policy if exists chat_ler on chat;
create policy chat_ler on chat for select to authenticated
  using (exists (select 1 from pessoas where id = auth.uid()));
drop policy if exists chat_enviar on chat;
create policy chat_enviar on chat for insert to authenticated
  with check (exists (select 1 from pessoas where id = auth.uid()));
drop policy if exists chat_apagar on chat;
create policy chat_apagar on chat for delete to authenticated
  using (por = auth.uid() or is_admin());

-- ---------- Tempo real ----------
do $$
declare t text;
begin
  foreach t in array array['config','escalas','avisos','eventos','checkin_marcas','cadastros','pessoas','chat'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ---------- Storage (imagens de avisos, eventos e redes) ----------
insert into storage.buckets (id, name, public)
  values ('imagens', 'imagens', true)
  on conflict (id) do nothing;

drop policy if exists img_ler on storage.objects;
create policy img_ler on storage.objects for select using (bucket_id = 'imagens');
drop policy if exists img_enviar on storage.objects;
create policy img_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and tem_avisos());
drop policy if exists img_alterar on storage.objects;
create policy img_alterar on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (is_admin() or owner_id = auth.uid()::text));
drop policy if exists img_apagar on storage.objects;
create policy img_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (is_admin() or owner_id = auth.uid()::text));

-- ---------- Quem pode chamar as funções ----------
-- Funções de gatilho não precisam ser chamadas por ninguém (o gatilho dispara sozinho).
-- As de permissão só são usadas por quem está logado.
do $$
declare f text;
begin
  foreach f in array array['escalas_guarda()','autoria_guarda()','checkin_guarda()','historico_guarda()','chat_guarda()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['minha_pessoa()','is_admin()','eh_equipe()','minha_conexao()','tem_gestao()','tem_avisos()','tem_escala()',
                           'pode_louvor()','area_por_conexao(text)','pode_editar_escala(text, jsonb)','pessoas_nomes()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Função do próprio Supabase ("Enable automatic RLS"), se existir.
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

