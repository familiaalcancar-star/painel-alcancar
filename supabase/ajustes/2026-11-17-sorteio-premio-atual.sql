-- ---------- Sorteio: prêmio atual (digitado no controle, mostrado na faixa do telão) (17/11/2026) ----------
create table if not exists public.sorteio_estado (
  evento text primary key references public.eventos(id) on delete cascade,
  premio text not null default '',
  por uuid,
  em timestamptz not null default now()
);
alter table public.sorteio_estado enable row level security;
revoke all on public.sorteio_estado from anon, authenticated;

-- Quem conduz o sorteio define o prêmio (vazio = sem prêmio).
create or replace function public.sorteio_definir_premio(p_evento text, p_premio text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  insert into sorteio_estado (evento, premio, por, em) values (p_evento, left(coalesce(trim(p_premio), ''), 120), auth.uid(), now())
  on conflict (evento) do update set premio = excluded.premio, por = excluded.por, em = excluded.em;
end $$;
revoke execute on function public.sorteio_definir_premio(text, text) from public, anon;
grant execute on function public.sorteio_definir_premio(text, text) to authenticated;

-- Prêmio atual (telão logado e controle).
create or replace function public.sorteio_premio(p_evento text)
returns text language sql stable security definer set search_path = public as $$
  select case when pode_sortear() or pode_checkin_evento(p_evento)
    then coalesce((select premio from sorteio_estado where evento = p_evento), '') end
$$;
revoke execute on function public.sorteio_premio(text) from public, anon;
grant execute on function public.sorteio_premio(text) to authenticated;

-- Telão pelo link (sem login): devolve também o prêmio atual.
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
    'premio', coalesce((select premio from sorteio_estado where evento = v_evento), ''),
    'ultimo', case when ult.id is null then null else jsonb_build_object(
      'id', ult.id, 'nome', ult.nome, 'premio', ult.premio, 'status', ult.status, 'rodada', ult.rodada, 'em', ult.em) end);
end $$;
revoke execute on function public.sorteio_tela(text) from public;
grant execute on function public.sorteio_tela(text) to anon, authenticated;
