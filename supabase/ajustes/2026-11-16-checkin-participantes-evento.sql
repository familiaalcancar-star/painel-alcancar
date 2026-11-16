-- ---------- Check-in de PARTICIPANTES de eventos (16/11/2026; aplicado pelo Claude do chat: migrações
-- "checkin_participantes_evento" e "checkin_participantes_dia") ----------
-- Ex.: Congresso de Homens 18 a 21/11. Lista de nomes por evento + presença por dia.

update eventos set d = d || '{"checkinParticipantes": true, "dias": ["2026-11-18","2026-11-19","2026-11-20","2026-11-21"]}'::jsonb
 where id = 'ev-2026-11-18-desperta';

create table if not exists public.evento_participantes (
  id uuid primary key default gen_random_uuid(),
  evento text not null references public.eventos(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create unique index if not exists evento_participantes_nome_uniq on public.evento_participantes (evento, norm_nome(nome));

create table if not exists public.evento_presencas (
  participante uuid not null references public.evento_participantes(id) on delete cascade,
  dia text not null,
  por uuid default auth.uid(),
  em timestamptz not null default now(),
  primary key (participante, dia)
);

-- Quem pode usar: admin, extra Gestão, Organização, ou escalado no Check-in/Gestão de culto em algum dia do evento.
create or replace function public.pode_checkin_evento(p_evento text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or tem_gestao() or eh_organizacao()
      or exists (select 1 from eventos e, jsonb_array_elements_text(coalesce(e.d->'dias', jsonb_build_array(e.data))) dia
                  where e.id = p_evento and checkin_escalado(dia))
$$;
revoke execute on function public.pode_checkin_evento(text) from public, anon;
grant execute on function public.pode_checkin_evento(text) to authenticated;

alter table public.evento_participantes enable row level security;
alter table public.evento_presencas enable row level security;
grant select, insert, update, delete on public.evento_participantes, public.evento_presencas to authenticated;
revoke all on public.evento_participantes, public.evento_presencas from anon;

drop policy if exists evp_tudo on public.evento_participantes;
create policy evp_tudo on public.evento_participantes for all to authenticated
  using (pode_checkin_evento(evento)) with check (pode_checkin_evento(evento));

drop policy if exists evpres_ler on public.evento_presencas;
create policy evpres_ler on public.evento_presencas for select to authenticated
  using (pode_checkin_evento((select evento from evento_participantes p where p.id = participante)));
-- Marcar: só no próprio dia (admin, qualquer dia).
drop policy if exists evpres_marcar on public.evento_presencas;
create policy evpres_marcar on public.evento_presencas for insert to authenticated
  with check (is_admin() or (pode_checkin_evento((select evento from evento_participantes p where p.id = participante)) and dia = hoje_sp()));
drop policy if exists evpres_desmarcar on public.evento_presencas;
create policy evpres_desmarcar on public.evento_presencas for delete to authenticated
  using (is_admin() or (pode_checkin_evento((select evento from evento_participantes p where p.id = participante)) and dia = hoje_sp()));

-- Gatilho: grava quem marcou/criou.
create or replace function public.evento_quem() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'evento_presencas' then new.por := auth.uid(); new.em := now();
  else new.criado_por := coalesce(auth.uid(), new.criado_por); new.nome := trim(regexp_replace(new.nome, '\s+', ' ', 'g')); end if;
  return new;
end $$;
drop trigger if exists evento_quem on public.evento_presencas;
create trigger evento_quem before insert on public.evento_presencas for each row execute function public.evento_quem();
drop trigger if exists evento_quem on public.evento_participantes;
create trigger evento_quem before insert or update on public.evento_participantes for each row execute function public.evento_quem();
revoke execute on function public.evento_quem() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='evento_presencas') then
    alter publication supabase_realtime add table public.evento_presencas; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='evento_participantes') then
    alter publication supabase_realtime add table public.evento_participantes; end if;
end $$;
