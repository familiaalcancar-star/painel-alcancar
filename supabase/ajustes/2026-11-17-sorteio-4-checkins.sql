-- ---------- Sorteio dos 4 check-ins (17/11/2026; aplicado pelo Claude do chat: migração "sorteio_4_checkins") ----------
alter table sorteios add column if not exists tipo text not null default 'dia';
alter table sorteio_estado add column if not exists modo text not null default 'dia';
alter table sorteio_estado alter column premio set default '';

-- quem fez check-in em TODOS os dias do evento
create or replace function public.sorteio_elegiveis_4dias(p_evento text)
returns table(id uuid, nome text) language sql stable security definer set search_path to 'public' as $$
  select p.id, p.nome
    from evento_participantes p
   where p.evento = p_evento
     and (pode_sortear() or pode_checkin_evento(p_evento))
     and (select count(distinct pr.dia) from evento_presencas pr
           where pr.participante = p.id
             and pr.dia in (select jsonb_array_elements_text(e.d->'dias') from eventos e where e.id = p_evento))
         = (select jsonb_array_length(e.d->'dias') from eventos e where e.id = p_evento)
     and not exists (select 1 from sorteios s where s.participante = p.id and s.tipo = '4dias'
                      and s.status in ('sorteado','ganhador','retirado','ausente'))
   order by p.nome
$$;

-- sorteio do dia ignora o resultado do sorteio dos 4 check-ins (são independentes)
create or replace function public.sorteio_elegiveis(p_evento text, p_dia text)
returns table(id uuid, nome text) language sql stable security definer set search_path to 'public' as $$
  select p.id, p.nome
    from evento_participantes p
    join evento_presencas pr on pr.participante = p.id and pr.dia = p_dia
   where p.evento = p_evento
     and (pode_sortear() or pode_checkin_evento(p_evento))
     and not exists (select 1 from sorteios s where s.participante = p.id and s.tipo = 'dia'
                      and (s.status in ('sorteado','ganhador','retirado') or (s.status = 'ausente' and s.dia = p_dia)))
   order by p.nome
$$;

drop function if exists public.sortear(text, text, text);
create or replace function public.sortear(p_evento text, p_dia text, p_premio text default '', p_tipo text default 'dia')
returns sorteios language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_nome text; v_total int; v_rodada int; r sorteios; v_tipo text := coalesce(nullif(p_tipo,''),'dia');
begin
  if not pode_sortear() then raise exception 'Sem permissão para sortear.'; end if;
  if v_tipo not in ('dia','4dias') then raise exception 'Tipo de sorteio inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('sorteio:'||p_evento));
  if exists (select 1 from sorteios where evento = p_evento and status = 'sorteado') then
    raise exception 'Confirme (ganhador / retirou / ausente) o sorteado atual antes de sortear de novo.';
  end if;
  if v_tipo = '4dias' then
    select count(*) into v_total from sorteio_elegiveis_4dias(p_evento);
    if v_total = 0 then raise exception 'Ninguém fez check-in em todos os dias (ou todos já foram sorteados).'; end if;
    select e.id, e.nome into v_id, v_nome from sorteio_elegiveis_4dias(p_evento) e order by gen_random_uuid() limit 1;
  else
    select count(*) into v_total from sorteio_elegiveis(p_evento, p_dia);
    if v_total = 0 then raise exception 'Ninguém disponível para sortear neste dia.'; end if;
    select e.id, e.nome into v_id, v_nome from sorteio_elegiveis(p_evento, p_dia) e order by gen_random_uuid() limit 1;
  end if;
  select coalesce(max(rodada), 0) + 1 into v_rodada from sorteios where evento = p_evento;
  insert into sorteios (evento, dia, participante, nome, premio, rodada, elegiveis, por, tipo)
  values (p_evento, p_dia, v_id, v_nome, coalesce(trim(p_premio), ''), v_rodada, v_total, auth.uid(), v_tipo)
  returning * into r;
  return r;
end $function$;

-- modo que o telão mostra: 'dia' ou '4dias'
create or replace function public.sorteio_definir_modo(p_evento text, p_modo text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  if p_modo not in ('dia','4dias') then raise exception 'Modo inválido.'; end if;
  insert into sorteio_estado (evento, premio, modo, por, em) values (p_evento, '', p_modo, auth.uid(), now())
  on conflict (evento) do update set modo = excluded.modo, por = excluded.por, em = excluded.em;
end $$;

create or replace function public.sorteio_modo(p_evento text) returns text
language sql stable security definer set search_path to 'public' as $$
  select case when pode_sortear() or pode_checkin_evento(p_evento)
    then coalesce((select modo from sorteio_estado where evento = p_evento), 'dia') end
$$;

create or replace function public.sorteio_tela(p_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare v_evento text; v_titulo text; v_dia text := hoje_sp(); ult sorteios; nomes jsonb; v_modo text;
begin
  select st.evento, coalesce(e.d->>'titulo', '') into v_evento, v_titulo
    from sorteio_telas st join eventos e on e.id = st.evento where st.token = p_token;
  if v_evento is null then return jsonb_build_object('ok', false); end if;
  v_modo := coalesce((select modo from sorteio_estado where evento = v_evento), 'dia');
  select * into ult from sorteios where evento = v_evento order by em desc limit 1;
  if v_modo = '4dias' then
    select coalesce(jsonb_agg(p.nome order by p.nome), '[]'::jsonb) into nomes
      from evento_participantes p
     where p.evento = v_evento
       and (select count(distinct pr.dia) from evento_presencas pr where pr.participante = p.id
             and pr.dia in (select jsonb_array_elements_text(e.d->'dias') from eventos e where e.id = v_evento))
           = (select jsonb_array_length(e.d->'dias') from eventos e where e.id = v_evento)
       and not exists (select 1 from sorteios s where s.participante = p.id and s.tipo = '4dias'
                        and s.status in ('sorteado','ganhador','retirado','ausente'));
  else
    select coalesce(jsonb_agg(p.nome order by p.nome), '[]'::jsonb) into nomes
      from evento_participantes p join evento_presencas pr on pr.participante = p.id and pr.dia = v_dia
     where p.evento = v_evento
       and not exists (select 1 from sorteios s where s.participante = p.id and s.tipo = 'dia'
                        and (s.status in ('sorteado','ganhador','retirado') or (s.status = 'ausente' and s.dia = v_dia)));
  end if;
  return jsonb_build_object('ok', true, 'evento', v_evento, 'titulo', v_titulo, 'dia', v_dia, 'modo', v_modo,
    'concorrendo', jsonb_array_length(nomes), 'nomes', nomes,
    'premio', coalesce((select premio from sorteio_estado where evento = v_evento), ''),
    'ultimo', case when ult.id is null then null else jsonb_build_object(
      'id', ult.id, 'nome', ult.nome, 'premio', ult.premio, 'status', ult.status, 'rodada', ult.rodada, 'em', ult.em, 'tipo', ult.tipo) end);
end $function$;

grant execute on function public.sorteio_elegiveis_4dias(text), public.sortear(text,text,text,text), public.sorteio_definir_modo(text,text), public.sorteio_modo(text) to authenticated;
