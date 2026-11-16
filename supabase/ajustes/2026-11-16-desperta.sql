-- ---------- Extra "Desperta" e presença com hora (16/11/2026) ----------
-- Quem tem o extra Desperta usa a lista de presença (aba Check-in): adiciona, renomeia e remove pessoas e marca presença.
-- Presença marcada não pode ser desmarcada (só administrador). Cada marcação guarda a hora e quem marcou:
--   dias = {"2026-11-18": {"em": "2026-11-18T23:05:10Z", "por": "Lima"}, ...}
alter table public.pessoas add column if not exists desperta boolean not null default false;

create or replace function public.tem_desperta() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' or desperta from pessoas where id = auth.uid() and status = 'aprovado' and not banco), false)
$$;
revoke execute on function public.tem_desperta() from public, anon;
grant execute on function public.tem_desperta() to authenticated;

alter policy presencas_checkin on public.presencas
  using (is_admin() or acessa_checkin() or tem_desperta()) with check (is_admin() or acessa_checkin() or tem_desperta());

create or replace function public.presencas_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare quem text := notif_nome(auth.uid()); k text; novos jsonb := '{}'::jsonb;
  agora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  velhos jsonb := case when tg_op = 'UPDATE' and jsonb_typeof(old.dias) = 'object' then old.dias else '{}'::jsonb end;
begin
  new.por := auth.uid(); new.por_nome := quem; new.em := now();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  if jsonb_typeof(new.dias) <> 'object' then new.dias := '{}'::jsonb; end if;
  -- Desmarcar presença: só administrador.
  if not is_admin() and exists (select 1 from jsonb_object_keys(velhos) v where not (new.dias ? v)) then
    raise exception 'Presença já marcada não pode ser desmarcada (só um administrador).';
  end if;
  -- Hora e quem marcou: o banco carimba as novas; as antigas continuam como estavam.
  for k in select jsonb_object_keys(new.dias) loop
    if velhos ? k then novos := novos || jsonb_build_object(k, velhos->k);
    else novos := novos || jsonb_build_object(k, jsonb_build_object('em', agora, 'por', quem)); end if;
  end loop;
  new.dias := novos;
  return new;
end $$;
