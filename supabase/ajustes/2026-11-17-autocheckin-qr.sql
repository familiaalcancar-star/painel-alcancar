-- ---------- Auto check-in por QR Code (17/11/2026; aplicado pelo Claude do chat: migração "autocheckin_qr") ----------
-- Página pública checkin/?e=<evento>: a pessoa busca o próprio nome (nome e sobrenome) e confirma.
-- 1 check-in por celular por dia; a presença fica com por_nome = 'QR Code (auto check-in)'.
create table if not exists public.evento_autocheckin (
  evento text not null, dia text not null, aparelho text not null,
  participante uuid not null references evento_participantes(id) on delete cascade,
  em timestamptz not null default now(),
  primary key (evento, dia, aparelho)
);
alter table public.evento_autocheckin enable row level security;
drop policy if exists autocheckin_admin_le on public.evento_autocheckin;
create policy autocheckin_admin_le on public.evento_autocheckin for select to authenticated using (is_admin());

-- presença via QR: mantém o rótulo quando não há usuário logado
create or replace function public.evento_quem() returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_table_name = 'evento_presencas' then
    if auth.uid() is not null then new.por := auth.uid(); new.por_nome := notif_nome(auth.uid());
    else new.por := null; new.por_nome := coalesce(new.por_nome, 'Sistema'); end if;
    new.em := now();
  else new.criado_por := coalesce(auth.uid(), new.criado_por); new.nome := trim(regexp_replace(new.nome, '\s+', ' ', 'g')); end if;
  return new;
end $function$;

create or replace function public.autocheckin_hoje(p_evento text) returns text
language sql stable security definer set search_path to 'public' as $$
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
   where exists (select 1 from eventos e where e.id = p_evento
                   and coalesce(e.d->>'autoCheckin','false') = 'true'
                   and (e.d->'dias') ? to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
$$;

-- informações públicas da página do QR
create or replace function public.autocheckin_info(p_evento text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('titulo', e.d->>'titulo', 'img', e.d->>'img', 'hoje', autocheckin_hoje(p_evento),
                            'aberto', autocheckin_hoje(p_evento) is not null)
    from eventos e where e.id = p_evento;
$$;

-- busca pelo nome e sobrenome (mín. 2 palavras), devolve no máx. 3 nomes
create or replace function public.autocheckin_buscar(p_evento text, p_nome text) returns table(id uuid, nome text, ja_presente boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_dia text := autocheckin_hoje(p_evento);
begin
  if v_dia is null then raise exception 'O check-in pelo QR Code só funciona nos dias do evento.'; end if;
  return query
    select p.id, p.nome, exists (select 1 from evento_presencas pr where pr.participante = p.id and pr.dia = v_dia)
      from evento_participantes p
     where p.evento = p_evento and nome_bate(p_nome, null, p.nome)
     order by p.nome limit 3;
end $$;

-- confirma: 1 check-in por celular por dia
create or replace function public.autocheckin_confirmar(p_evento text, p_participante uuid, p_aparelho text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_dia text := autocheckin_hoje(p_evento); v_nome text; v_usado uuid;
begin
  if v_dia is null then raise exception 'O check-in pelo QR Code só funciona nos dias do evento.'; end if;
  if coalesce(length(p_aparelho),0) < 16 then raise exception 'Aparelho inválido.'; end if;
  select nome into v_nome from evento_participantes where id = p_participante and evento = p_evento;
  if v_nome is null then raise exception 'Participante não encontrado.'; end if;
  select participante into v_usado from evento_autocheckin where evento = p_evento and dia = v_dia and aparelho = p_aparelho;
  if v_usado is not null and v_usado <> p_participante then
    raise exception 'Este celular já fez o check-in de outra pessoa hoje. Procure a equipe de Check-in.';
  end if;
  if exists (select 1 from evento_presencas where participante = p_participante and dia = v_dia) then
    return jsonb_build_object('ok', true, 'nome', v_nome, 'ja', true, 'dia', v_dia);
  end if;
  insert into evento_autocheckin (evento, dia, aparelho, participante) values (p_evento, v_dia, p_aparelho, p_participante)
    on conflict do nothing;
  insert into evento_presencas (participante, dia, por_nome) values (p_participante, v_dia, 'QR Code (auto check-in)');
  return jsonb_build_object('ok', true, 'nome', v_nome, 'ja', false, 'dia', v_dia);
end $$;

revoke all on function public.autocheckin_buscar(text,text), public.autocheckin_confirmar(text,uuid,text), public.autocheckin_info(text), public.autocheckin_hoje(text) from public;
grant execute on function public.autocheckin_buscar(text,text), public.autocheckin_confirmar(text,uuid,text), public.autocheckin_info(text) to anon, authenticated;

update eventos set d = d || '{"autoCheckin": true}' where id = 'ev-2026-11-18-desperta';
