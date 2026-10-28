-- Notificações no celular (28/10/2026).
-- Avisa: cadastro novo (admins), bate-papo (aprovados), escala adicionada/alterada
-- (admins + quem tem ligação com ela) e importação de escala (um aviso só, para todos).
-- O banco grava o aviso em "notificacoes" e chama a função "notificar" (Edge Function),
-- que envia para os aparelhos inscritos em "push_inscricoes".

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponível: %', sqlerrm; end $$;

-- Aparelhos que tocaram em "Ativar notificações".
create table if not exists public.push_inscricoes (
  endpoint text primary key,
  usuario uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  aparelho text not null default '',
  em timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;

-- Fila de avisos (só o banco e a Edge Function leem).
create table if not exists public.notificacoes (
  id bigserial primary key,
  tipo text not null,
  titulo text not null,
  corpo text not null default '',
  url text not null default '/',
  para uuid[] not null,
  em timestamptz not null default now(),
  enviada_em timestamptz,
  resultado jsonb
);
alter table public.notificacoes enable row level security;
revoke all on public.notificacoes from anon, authenticated;

-- Chaves do envio (geradas pela própria Edge Function na primeira vez).
create table if not exists public.push_chaves (
  id int primary key default 1 check (id = 1),
  publica text not null,
  privada text not null
);
alter table public.push_chaves enable row level security;
revoke all on public.push_chaves from anon, authenticated;

-- Importação em andamento: enquanto existir, as escalas gravadas não geram um aviso cada.
create table if not exists public.notif_importando (
  usuario uuid primary key references auth.users(id) on delete cascade,
  ate timestamptz not null
);
alter table public.notif_importando enable row level security;
revoke all on public.notif_importando from anon, authenticated;

-- Inscrever / cancelar este aparelho (a pessoa logada).
create or replace function public.push_inscrever(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into push_inscricoes (endpoint, usuario, p256dh, auth, aparelho)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_aparelho,''), 160))
  on conflict (endpoint) do update set usuario = excluded.usuario, p256dh = excluded.p256dh,
    auth = excluded.auth, aparelho = excluded.aparelho, em = now();
end $$;
create or replace function public.push_cancelar(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_inscricoes where endpoint = p_endpoint and usuario = auth.uid();
$$;
revoke execute on function public.push_inscrever(text,text,text,text) from public, anon;
revoke execute on function public.push_cancelar(text) from public, anon;
grant execute on function public.push_inscrever(text,text,text,text) to authenticated;
grant execute on function public.push_cancelar(text) to authenticated;

-- Grava o aviso e chama a Edge Function. Nunca impede a gravação original.
create or replace function public.notificar(p_tipo text, p_titulo text, p_corpo text, p_url text, p_para uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_para uuid[]; v_id bigint;
begin
  select array_agg(distinct u) into v_para from unnest(p_para) u
   where u is not null and u is distinct from auth.uid()
     and exists (select 1 from push_inscricoes i where i.usuario = u);
  if v_para is null then return; end if;
  insert into notificacoes (tipo, titulo, corpo, url, para)
  values (p_tipo, left(p_titulo, 120), left(coalesce(p_corpo,''), 240), coalesce(p_url,'/'), v_para)
  returning id into v_id;
  perform net.http_post(
    url := 'https://znuxdxwnunagvkjekmgc.supabase.co/functions/v1/notificar',
    body := jsonb_build_object('id', v_id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
exception when others then
  raise warning 'notificar: %', sqlerrm;
end $$;
revoke execute on function public.notificar(text,text,text,text,uuid[]) from public, anon, authenticated;

create or replace function public.notif_nome(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from pessoas where id = u),
                  (select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from cadastros where id = u), 'Alguém')
$$;
revoke execute on function public.notif_nome(uuid) from public, anon, authenticated;

create or replace function public.notif_admins() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from pessoas where papel = 'admin' and status = 'aprovado'
$$;
revoke execute on function public.notif_admins() from public, anon, authenticated;

-- 1) Cadastro novo → administradores (roda depois do cadastro_auto).
create or replace function public.notif_cadastro() returns trigger
language plpgsql security definer set search_path = public as $$
declare auto boolean := exists (select 1 from pessoas where id = new.id and status = 'aprovado');
  con text := coalesce((select x->>'nome' from config c, jsonb_array_elements(c.d->'conexoes') x
                          where c.id = 'geral' and x->>'id' = new.conexao limit 1), new.conexao);
begin
  perform notificar('cadastro', '🔔 Novo cadastro',
    trim(new.nome)||' · '||initcap(case new.papel when 'organizacao' then 'organização' else new.papel end)||' · '||coalesce(con,'')
      ||case when auto then ' (aprovado automaticamente)' else '. Toque para revisar.' end,
    '/#ajustes', notif_admins());
  return new;
end $$;
drop trigger if exists notif_cadastro on public.cadastros;
create trigger notif_cadastro after insert on public.cadastros for each row execute function public.notif_cadastro();
revoke execute on function public.notif_cadastro() from public, anon, authenticated;

-- 2) Bate-papo → todos os aprovados, menos quem enviou.
create or replace function public.notif_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notificar('chat', '💬 '||notif_nome(new.por), new.texto, '/#chat',
    (select coalesce(array_agg(id), '{}') from pessoas where status = 'aprovado'));
  return new;
end $$;
drop trigger if exists notif_chat on public.chat;
create trigger notif_chat after insert on public.chat for each row execute function public.notif_chat();
revoke execute on function public.notif_chat() from public, anon, authenticated;

-- 3) Escala adicionada ou alterada (cultos de hoje em diante).
create or replace function public.notif_escala() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := (select d from config where id = 'geral');
  area_nome text; culto_nome text; para uuid[]; dia text;
begin
  if auth.uid() is null then return new; end if;
  if new.data < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') then return new; end if;
  if tg_op = 'UPDATE' and (old.d - 'atualizadoEm' - 'atualizadoPor') = (new.d - 'atualizadoEm' - 'atualizadoPor') then return new; end if;
  if exists (select 1 from notif_importando where usuario = auth.uid() and ate > now()) then return new; end if;
  area_nome := coalesce((select x->>'nome' from jsonb_array_elements(cfg->'areas') x where x->>'id' = new.area limit 1), new.area);
  culto_nome := coalesce((select x->>'nome' from jsonb_array_elements(cfg->'cultos') x where x->>'id' = new.culto limit 1), new.culto);
  dia := to_char(new.data::date, 'DD/MM');
  select coalesce(array_agg(p.id), '{}') into para from pessoas p
   where p.status = 'aprovado' and (
         p.papel = 'admin'
      or (p.conexao is not null and new.conexoes ? p.conexao)
      or (p.escala and area_por_conexao(new.area))
      or (new.area = 'louvor' and (p.ministro or p.conexao in ('flechas','forasteiros','herois'))));
  perform notificar('escala',
    case when tg_op = 'INSERT' then '📋 Escala adicionada' else '📋 Escala alterada' end,
    area_nome||' · '||culto_nome||' de '||dia||' — por '||notif_nome(auth.uid()),
    '/#escala', para);
  return new;
end $$;
drop trigger if exists notif_escala on public.escalas;
create trigger notif_escala after insert or update on public.escalas for each row execute function public.notif_escala();
revoke execute on function public.notif_escala() from public, anon, authenticated;

-- 4) Importação de arquivo: um aviso só, com o resumo, para todos os aprovados.
create or replace function public.notif_importacao_inicio() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return; end if;
  insert into notif_importando (usuario, ate) values (auth.uid(), now() + interval '10 minutes')
  on conflict (usuario) do update set ate = excluded.ate;
end $$;
create or replace function public.notif_importacao_fim(p_qtd int, p_meses text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from notif_importando where usuario = auth.uid();
  if not is_admin() or coalesce(p_qtd,0) < 1 then return; end if;
  perform notificar('importacao', '📋 Escala atualizada',
    p_qtd||' escala'||case when p_qtd > 1 then 's' else '' end||' importada'||case when p_qtd > 1 then 's' else '' end
      ||case when coalesce(p_meses,'') <> '' then ' ('||left(p_meses,60)||')' else '' end||' por '||notif_nome(auth.uid())||'. Confira a sua.',
    '/#escala', (select coalesce(array_agg(id), '{}') from pessoas where status = 'aprovado'));
end $$;
revoke execute on function public.notif_importacao_inicio() from public, anon;
revoke execute on function public.notif_importacao_fim(int,text) from public, anon;
grant execute on function public.notif_importacao_inicio() to authenticated;
grant execute on function public.notif_importacao_fim(int,text) to authenticated;
