-- ---------- Lista de presença de eventos com vários dias (16/11/2026) ----------
-- Ex.: Congresso (18 a 21/11). Uma linha por pessoa; "dias" guarda as noites em que ela veio: {"2026-11-18": true, ...}.
-- Quem marca: os mesmos que acessam a aba Check-in (admin, Gestão, Organização, escalados no check-in).
create table if not exists public.presencas (
  lista text not null,
  id text not null,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  dias jsonb not null default '{}'::jsonb,
  por uuid,
  por_nome text,
  em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  primary key (lista, id)
);
alter table public.presencas enable row level security;
revoke all on public.presencas from anon;
grant select, insert, update, delete on public.presencas to authenticated;
drop policy if exists presencas_checkin on public.presencas;
create policy presencas_checkin on public.presencas for all to authenticated
  using (is_admin() or acessa_checkin()) with check (is_admin() or acessa_checkin());
drop policy if exists status_banco_inserir on public.presencas;
create policy status_banco_inserir on public.presencas as restrictive for insert to authenticated with check (public.sessao_pode_escrever());
drop policy if exists status_banco_editar on public.presencas;
create policy status_banco_editar on public.presencas as restrictive for update to authenticated using (public.sessao_pode_escrever()) with check (public.sessao_pode_escrever());
drop policy if exists status_banco_apagar on public.presencas;
create policy status_banco_apagar on public.presencas as restrictive for delete to authenticated using (public.sessao_pode_escrever());

-- Quem mexeu por último (gravado pelo banco).
create or replace function public.presencas_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.por := auth.uid(); new.por_nome := notif_nome(auth.uid()); new.em := now();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  return new;
end $$;
revoke execute on function public.presencas_guarda() from public, anon, authenticated;
drop trigger if exists presencas_guarda on public.presencas;
create trigger presencas_guarda before insert or update on public.presencas
  for each row execute function public.presencas_guarda();

do $$ begin
  begin alter publication supabase_realtime add table public.presencas; exception when others then null; end;
end $$;
