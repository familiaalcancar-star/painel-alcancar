-- Formulário da Mídia (08/11/2026; aplicado no Supabase pelo Claude, migração "formulario_midia").
-- Levanta o perfil de quem serve ou quer servir na Mídia. Link público, sem login: /formulario-midia/
--
-- O que este ajuste cria:
--   formulario_midia_conhecimentos  lista de conhecimentos (Holyrics, ATEM...). Todos leem os ativos; só admin altera.
--   formulario_midia_ministerios    lista de outros ministérios (Coro, Louvor...). Mesma regra.
--   formulario_midia_respostas      uma resposta por e-mail. SÓ administradores leem (e podem excluir).
--   formulario_midia_envios         registro de envios para o limite contra envios em massa (ninguém lê).
--   enviar_formulario_midia(p)      única forma de enviar: confere tudo, aplica o limite e grava/atualiza pelo e-mail.
--   formulario_midia_valida         gatilho que confere todos os campos (vale para qualquer gravação, não só a tela).
--   notif_formulario_midia          aviso (notificação) aos administradores a cada envio.

-- ---------- Listas editáveis pelo administrador ----------
create table if not exists public.formulario_midia_conhecimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists formulario_midia_conhecimentos_nome on public.formulario_midia_conhecimentos (lower(trim(nome)));

create table if not exists public.formulario_midia_ministerios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists formulario_midia_ministerios_nome on public.formulario_midia_ministerios (lower(trim(nome)));

do $$ declare t text; begin
  foreach t in array array['formulario_midia_conhecimentos', 'formulario_midia_ministerios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon', t);
    -- Sem "delete": para tirar um item do formulário, o administrador desativa (as respostas antigas continuam com o nome).
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('drop policy if exists fm_ler_anon on public.%I', t);
    execute format('create policy fm_ler_anon on public.%I for select to anon using (ativo)', t);
    execute format('drop policy if exists fm_ler on public.%I', t);
    execute format('create policy fm_ler on public.%I for select to authenticated using (ativo or is_admin())', t);
    execute format('drop policy if exists fm_admin on public.%I', t);
    execute format('create policy fm_admin on public.%I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

insert into public.formulario_midia_conhecimentos (nome, ordem)
select n, o from (values
  ('Holyrics', 10), ('ATEM', 20), ('YouTube Studio', 30), ('OBS', 40), ('Windows', 50), ('iOS', 60),
  ('Câmera', 70), ('Canva', 80), ('CapCut', 90), ('Formulários (Google Forms)', 100),
  ('Criação/Edição de vídeos', 110), ('Criação/Edição de fotos', 120)
) v(n, o)
where not exists (select 1 from public.formulario_midia_conhecimentos);

insert into public.formulario_midia_ministerios (nome, ordem)
select n, o from (values ('Coro', 10), ('Louvor', 20), ('Organização', 30), ('Gravação', 40), ('Som', 50), ('Iluminação', 60)) v(n, o)
where not exists (select 1 from public.formulario_midia_ministerios);

-- ---------- Respostas ----------
create table if not exists public.formulario_midia_respostas (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text not null,
  nascimento date not null,
  whatsapp text not null,
  conhecimentos jsonb not null default '{}'::jsonb,      -- { "<id do conhecimento>": "nenhum" | "basico" | "intermediario" | "avancado" }
  funcoes text[] not null default '{}',                  -- Projeção, Transmissão, Câmera, Apoio
  disponibilidade text[] not null default '{}',          -- manha (domingo manhã), noite (domingo noite)
  iphone boolean not null,
  conexao text not null,                                 -- id da conexão (config.geral.conexoes)
  outro_ministerio boolean not null,
  ministerios uuid[] not null default '{}',              -- ids de formulario_midia_ministerios
  autorizo boolean not null check (autorizo),
  enviado_em timestamptz not null default now(),         -- primeiro envio
  atualizado_em timestamptz,                             -- último reenvio com o mesmo e-mail
  envios int not null default 1
);
alter table public.formulario_midia_respostas enable row level security;
revoke all on public.formulario_midia_respostas from anon, authenticated;
grant select, delete on public.formulario_midia_respostas to authenticated;  -- gravação só pela função enviar_formulario_midia
drop policy if exists fm_resp_ler on public.formulario_midia_respostas;
create policy fm_resp_ler on public.formulario_midia_respostas for select to authenticated using (is_admin());
drop policy if exists fm_resp_apagar on public.formulario_midia_respostas;
create policy fm_resp_apagar on public.formulario_midia_respostas for delete to authenticated using (is_admin());

-- Confere todos os campos (insert e update). Mensagens em português, mostradas na tela.
create or replace function public.formulario_midia_valida() returns trigger
language plpgsql security definer set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; k record; nivel text;
begin
  new.nome := regexp_replace(trim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  new.email := lower(trim(coalesce(new.email, '')));
  new.whatsapp := trim(coalesce(new.whatsapp, ''));
  if new.nome = '' then raise exception 'Preencha o nome completo.' using errcode = '23514'; end if;
  if char_length(new.nome) > 150 then raise exception 'Nome muito longo.' using errcode = '23514'; end if;
  if new.nascimento is null then raise exception 'Preencha a data de nascimento.' using errcode = '23514'; end if;
  if new.nascimento < date '1900-01-01' or new.nascimento > hoje then raise exception 'Data de nascimento inválida.' using errcode = '23514'; end if;
  if new.nascimento > (hoje - interval '14 years')::date then
    raise exception 'É preciso ter 14 anos ou mais para preencher este formulário.' using errcode = '23514'; end if;
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(new.email) > 200 then raise exception 'Informe um e-mail válido.' using errcode = '23514'; end if;
  if length(regexp_replace(new.whatsapp, '\D', '', 'g')) not between 10 and 13 then raise exception 'Informe o WhatsApp com DDD.' using errcode = '23514'; end if;

  -- Conhecimentos: um nível para CADA item ativo da lista; itens desconhecidos são descartados.
  if new.conhecimentos is null or jsonb_typeof(new.conhecimentos) <> 'object' then new.conhecimentos := '{}'; end if;
  new.conhecimentos := coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(new.conhecimentos) e
    where exists (select 1 from formulario_midia_conhecimentos c where c.id::text = e.key)), '{}');
  for k in select id, nome from formulario_midia_conhecimentos where ativo loop
    nivel := new.conhecimentos->>k.id::text;
    if nivel is null or nivel not in ('nenhum','basico','intermediario','avancado') then
      raise exception 'Escolha o seu nível em "%".', k.nome using errcode = '23514'; end if;
  end loop;

  new.funcoes := array(select distinct x from unnest(coalesce(new.funcoes, '{}')) x);
  if cardinality(new.funcoes) = 0 then raise exception 'Escolha pelo menos uma função para servir.' using errcode = '23514'; end if;
  if not new.funcoes <@ array['Projeção','Transmissão','Câmera','Apoio'] then raise exception 'Função inválida.' using errcode = '23514'; end if;

  new.disponibilidade := array(select distinct x from unnest(coalesce(new.disponibilidade, '{}')) x);
  if cardinality(new.disponibilidade) = 0 then raise exception 'Escolha pelo menos uma disponibilidade.' using errcode = '23514'; end if;
  if not new.disponibilidade <@ array['manha','noite'] then raise exception 'Disponibilidade inválida.' using errcode = '23514'; end if;

  if new.iphone is null then raise exception 'Responda se tem iPhone.' using errcode = '23514'; end if;
  if not exists (select 1 from config c, jsonb_array_elements(c.d->'conexoes') x where c.id = 'geral' and x->>'id' = new.conexao) then
    raise exception 'Escolha a sua conexão.' using errcode = '23514'; end if;

  if new.outro_ministerio is null then raise exception 'Responda se serve em outro ministério.' using errcode = '23514'; end if;
  new.ministerios := array(select distinct x from unnest(coalesce(new.ministerios, '{}')) x);
  if new.outro_ministerio then
    if cardinality(new.ministerios) = 0 then raise exception 'Marque pelo menos um ministério.' using errcode = '23514'; end if;
    if exists (select 1 from unnest(new.ministerios) x where not exists (select 1 from formulario_midia_ministerios m where m.id = x and m.ativo)) then
      raise exception 'Ministério inválido.' using errcode = '23514'; end if;
  else
    new.ministerios := '{}';
  end if;

  if new.autorizo is distinct from true then
    raise exception 'É preciso autorizar a Família Alcançar a guardar estes dados.' using errcode = '23514'; end if;
  return new;
end $$;
revoke execute on function public.formulario_midia_valida() from public, anon, authenticated;
drop trigger if exists formulario_midia_valida on public.formulario_midia_respostas;
create trigger formulario_midia_valida before insert or update on public.formulario_midia_respostas
  for each row execute function public.formulario_midia_valida();

-- ---------- Limite contra envios em massa ----------
create table if not exists public.formulario_midia_envios (
  id bigserial primary key,
  em timestamptz not null default now(),
  origem text not null default '',   -- código (md5) do endereço de internet, não o endereço em si
  email text not null default ''
);
create index if not exists formulario_midia_envios_em on public.formulario_midia_envios (em);
alter table public.formulario_midia_envios enable row level security;
revoke all on public.formulario_midia_envios from anon, authenticated;

-- ---------- Envio (única porta de entrada, sem login) ----------
create or replace function public.enviar_formulario_midia(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p->>'email', ''))); v_origem text; v_nasc date; v_min uuid[]; v_novo boolean;
  arr text[]; v_hdr text := nullif(current_setting('request.headers', true), '');
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Envio inválido.' using errcode = '22023'; end if;
  -- Limite simples: por endereço de internet, por e-mail e no total (janela de 10 minutos).
  begin v_origem := md5(coalesce(trim(split_part(v_hdr::json->>'x-forwarded-for', ',', 1)), ''));
  exception when others then v_origem := md5(''); end;
  delete from formulario_midia_envios where em < now() - interval '1 day';
  if (select count(*) from formulario_midia_envios where em > now() - interval '10 minutes' and origem = v_origem) >= 10
     or (select count(*) from formulario_midia_envios where em > now() - interval '10 minutes' and email = v_email) >= 3
     or (select count(*) from formulario_midia_envios where em > now() - interval '10 minutes') >= 100 then
    raise exception 'Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.' using errcode = 'P0001';
  end if;
  insert into formulario_midia_envios (origem, email) values (v_origem, v_email);

  begin v_nasc := nullif(p->>'nascimento', '')::date;
  exception when others then raise exception 'Data de nascimento inválida.' using errcode = '23514'; end;
  begin v_min := array(select jsonb_array_elements_text(case when jsonb_typeof(p->'ministerios') = 'array' then p->'ministerios' else '[]' end)::uuid);
  exception when others then raise exception 'Ministério inválido.' using errcode = '23514'; end;

  insert into formulario_midia_respostas as r (email, nome, nascimento, whatsapp, conhecimentos, funcoes, disponibilidade, iphone,
      conexao, outro_ministerio, ministerios, autorizo)
  values (v_email, p->>'nome', v_nasc, p->>'whatsapp',
      case when jsonb_typeof(p->'conhecimentos') = 'object' then p->'conhecimentos' else '{}' end,
      array(select jsonb_array_elements_text(case when jsonb_typeof(p->'funcoes') = 'array' then p->'funcoes' else '[]' end)),
      array(select jsonb_array_elements_text(case when jsonb_typeof(p->'disponibilidade') = 'array' then p->'disponibilidade' else '[]' end)),
      case when jsonb_typeof(p->'iphone') = 'boolean' then (p->>'iphone')::boolean end,
      p->>'conexao',
      case when jsonb_typeof(p->'outro_ministerio') = 'boolean' then (p->>'outro_ministerio')::boolean end,
      v_min,
      coalesce(case when jsonb_typeof(p->'autorizo') = 'boolean' then (p->>'autorizo')::boolean end, false))
  on conflict (email) do update set
      nome = excluded.nome, nascimento = excluded.nascimento, whatsapp = excluded.whatsapp, conhecimentos = excluded.conhecimentos,
      funcoes = excluded.funcoes, disponibilidade = excluded.disponibilidade, iphone = excluded.iphone, conexao = excluded.conexao,
      outro_ministerio = excluded.outro_ministerio, ministerios = excluded.ministerios, autorizo = excluded.autorizo,
      atualizado_em = now(), envios = r.envios + 1
  returning (xmax = 0) into v_novo;
  return case when v_novo then 'criado' else 'atualizado' end;
end $$;
revoke execute on function public.enviar_formulario_midia(jsonb) from public;
grant execute on function public.enviar_formulario_midia(jsonb) to anon, authenticated;

-- ---------- Aviso aos administradores ----------
create or replace function public.notif_formulario_midia() returns trigger
language plpgsql security definer set search_path = public as $$
declare con text := coalesce((select x->>'nome' from config c, jsonb_array_elements(c.d->'conexoes') x
                                where c.id = 'geral' and x->>'id' = new.conexao limit 1), new.conexao);
begin
  perform notificar('formulario', '📝 Formulário da Mídia',
    new.nome||' · '||coalesce(con, '')||case when tg_op = 'UPDATE' then ' (atualizou a resposta)' else '' end,
    '/#formmidia', notif_admins());
  return null;
exception when others then return null;
end $$;
revoke execute on function public.notif_formulario_midia() from public, anon, authenticated;
drop trigger if exists notif_formulario_midia on public.formulario_midia_respostas;
create trigger notif_formulario_midia after insert or update on public.formulario_midia_respostas
  for each row execute function public.notif_formulario_midia();
