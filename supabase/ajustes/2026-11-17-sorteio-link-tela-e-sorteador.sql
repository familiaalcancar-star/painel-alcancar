-- ---------- Sorteio: extra "Sorteador" e link da TELA sem login (17/11/2026; aplicado pelo Claude do chat: migração
-- "sorteio_link_tela_e_sorteador"; o trecho do cadastro_auto no fim foi acrescentado depois) ----------

-- 1) Extra "Sorteador": pode conduzir o sorteio (além de admin, Gestão e Organização).
alter table public.pessoas add column if not exists sorteador boolean not null default false;
alter table public.convites add column if not exists sorteador boolean not null default false;

create or replace function public.pode_sortear() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or tem_gestao() or eh_organizacao()
      or exists (select 1 from pessoas where id = auth.uid() and status = 'aprovado' and not banco and sorteador)
$$;

-- 2) Link secreto só da TELA do telão (sem login): mostra a animação e o sorteado, nada mais.
create table if not exists public.sorteio_telas (
  evento text primary key references public.eventos(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  criado_em timestamptz not null default now()
);
alter table public.sorteio_telas enable row level security;
revoke all on public.sorteio_telas from anon;
grant select on public.sorteio_telas to authenticated;
drop policy if exists sorteio_telas_ler on public.sorteio_telas;
create policy sorteio_telas_ler on public.sorteio_telas for select to authenticated using (pode_sortear());

-- Gera (ou troca) o link da tela. Trocar invalida o link antigo.
create or replace function public.sorteio_link_tela(p_evento text, p_trocar boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  if p_trocar then delete from sorteio_telas where evento = p_evento; end if;
  insert into sorteio_telas (evento) values (p_evento) on conflict (evento) do nothing;
  select token into t from sorteio_telas where evento = p_evento;
  return t;
end $$;
revoke execute on function public.sorteio_link_tela(text, boolean) from public, anon;
grant execute on function public.sorteio_link_tela(text, boolean) to authenticated;

-- Estado da tela pelo código (pode ser chamado SEM login). Devolve só o necessário para projetar.
create or replace function public.sorteio_tela(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_evento text; v_titulo text; v_dia text := hoje_sp(); ult sorteios; nomes jsonb;
begin
  select st.evento, coalesce(e.d->>'titulo', '') into v_evento, v_titulo
    from sorteio_telas st join eventos e on e.id = st.evento where st.token = p_token;
  if v_evento is null then return jsonb_build_object('ok', false); end if;
  select * into ult from sorteios where evento = v_evento order by em desc limit 1;
  select coalesce(jsonb_agg(p.nome order by p.nome), '[]'::jsonb) into nomes
    from evento_participantes p join evento_presencas pr on pr.participante = p.id and pr.dia = v_dia
   where p.evento = v_evento
     and not exists (select 1 from sorteios s where s.participante = p.id
                      and (s.status in ('sorteado','ganhador','retirado') or (s.status = 'ausente' and s.dia = v_dia)));
  return jsonb_build_object('ok', true, 'evento', v_evento, 'titulo', v_titulo, 'dia', v_dia,
    'concorrendo', jsonb_array_length(nomes), 'nomes', nomes,
    'ultimo', case when ult.id is null then null else jsonb_build_object(
      'id', ult.id, 'nome', ult.nome, 'premio', ult.premio, 'status', ult.status, 'rodada', ult.rodada, 'em', ult.em) end);
end $$;
revoke execute on function public.sorteio_tela(text) from public;
grant execute on function public.sorteio_tela(text) to anon, authenticated;

-- 3) Convite por e-mail também leva o extra Sorteador.
-- Convite por e-mail também leva os extras Mídia e Sorteador.
create or replace function public.cadastro_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare r pessoas_referencia; c convites; w text := right(regexp_replace(new.whatsapp, '\D', '', 'g'), 11);
  email_login text := (select lower(trim(u.email)) from auth.users u where u.id = new.id);
begin
  if exists (select 1 from pessoas where id = new.id) then return new; end if;
  select * into c from convites cv where cv.email = email_login;
  if found then
    insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, banco, midia, sorteador, status)
    values (new.id, email_login, new.nome, coalesce(new.apelido,''), new.whatsapp, coalesce(c.conexao, new.conexao), c.papel,
            c.gestao, c.ministro, c.avisos, c.escala, c.banco, c.midia, coalesce(c.sorteador, false), 'aprovado');
    delete from convites cv where cv.email = email_login;
    insert into historico (acao, tipo, resumo, por, por_nome)
      values ('criou', 'config', 'Aprovado pelo convite por e-mail: '||coalesce(nullif(new.apelido,''), split_part(trim(new.nome),' ',1)), new.id, 'Sistema');
    return new;
  end if;
  if length(w) < 10 then return new; end if;
  select * into r from pessoas_referencia
   where right(regexp_replace(coalesce(d->>'whatsapp',''), '\D', '', 'g'), 11) = w
     and coalesce(d->>'papel','') in ('lider','auxiliar','organizacao','leitura')
     and d->>'usado_por' is null
   limit 1;
  if not found then return new; end if;
  insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, status, banco)
  values (new.id, coalesce(email_login, new.email), new.nome, coalesce(nullif(new.apelido,''), r.d->>'apelido', ''), new.whatsapp,
          r.d->>'conexao', r.d->>'papel',
          coalesce((r.d->>'gestao')::boolean,false), coalesce((r.d->>'ministro')::boolean,false),
          coalesce((r.d->>'avisos')::boolean,false), coalesce((r.d->>'escala')::boolean,false), 'aprovado', false);
  update pessoas_referencia set d = d || jsonb_build_object('usado_por', new.id) where id_antigo = r.id_antigo;
  insert into historico (acao, tipo, resumo, por, por_nome)
    values ('criou', 'config', 'Aprovado automaticamente (painel antigo): '||coalesce(nullif(new.apelido,''), split_part(trim(new.nome),' ',1)), new.id, 'Sistema');
  return new;
end $$;
