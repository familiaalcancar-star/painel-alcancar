-- ---------- Auto check-in: horário (abre/fecha) e modo teste (17/11/2026; funções alteradas pelo Claude do chat) ----------
-- Aberto só nos dias do evento (d.dias), entre d.autoCheckinAbre e d.autoCheckinFecha (padrão 19:30–22:00).
-- Modo teste: d.autoCheckinTesteAte (data/hora) libera antes disso. Para fechar o teste: update eventos set d = d - 'autoCheckinTesteAte' where id = '…';
create or replace function public.autocheckin_hoje(p_evento text) returns text
language sql stable security definer set search_path to 'public' as $function$
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
    from eventos e
   where e.id = p_evento
     and coalesce(e.d->>'autoCheckin','false') = 'true'
     and (
       -- modo teste: liberado até o horário indicado
       (e.d ? 'autoCheckinTesteAte' and now() < (e.d->>'autoCheckinTesteAte')::timestamptz)
       or (
         (e.d->'dias') ? to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
         and (now() at time zone 'America/Sao_Paulo')::time
             between coalesce(e.d->>'autoCheckinAbre','19:30')::time and coalesce(e.d->>'autoCheckinFecha','22:00')::time
       )
     );
$function$;

create or replace function public.autocheckin_info(p_evento text) returns jsonb
language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object('titulo', e.d->>'titulo', 'img', e.d->>'img', 'hoje', autocheckin_hoje(p_evento),
                            'aberto', autocheckin_hoje(p_evento) is not null,
                            'abre', coalesce(e.d->>'autoCheckinAbre','19:30'), 'fecha', coalesce(e.d->>'autoCheckinFecha','22:00'))
    from eventos e where e.id = p_evento;
$function$;

-- 16/11/2026: teste encerrado (o Congresso usa só 18 a 21/11, 19:30–22:00).
update public.eventos set d = (d - 'autoCheckinTesteAte') || '{"autoCheckinAbre":"19:30","autoCheckinFecha":"22:00"}'::jsonb where id = 'ev-2026-11-18-desperta';
