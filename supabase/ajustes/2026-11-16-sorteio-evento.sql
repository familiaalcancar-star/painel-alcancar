-- ---------- SORTEIO dos participantes com check-in no dia (16/11/2026; aplicado pelo Claude do chat: migração "sorteio_evento") ----------
-- Ex.: Congresso "Desperta".
create table if not exists public.sorteios (
  id uuid primary key default gen_random_uuid(),
  evento text not null references public.eventos(id) on delete cascade,
  dia text not null,
  participante uuid not null references public.evento_participantes(id) on delete cascade,
  nome text not null,
  premio text not null default '',
  status text not null default 'sorteado' check (status in ('sorteado','ganhador','retirado','ausente','liberado')),
  rodada int not null,
  elegiveis int not null,
  por uuid default auth.uid(),
  em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists sorteios_evento_idx on public.sorteios (evento, em desc);
alter table public.sorteios enable row level security;
grant select on public.sorteios to authenticated;
revoke all on public.sorteios from anon;

-- Quem conduz o sorteio: admin, Gestão ou Organização.
create or replace function public.pode_sortear() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or tem_gestao() or eh_organizacao()
$$;
revoke execute on function public.pode_sortear() from public, anon;
grant execute on function public.pode_sortear() to authenticated;

drop policy if exists sorteios_ler on public.sorteios;
create policy sorteios_ler on public.sorteios for select to authenticated
  using (pode_sortear() or pode_checkin_evento(evento));

-- Lista de quem pode ser sorteado no dia: fez check-in no dia e ainda não ganhou/retirou prêmio
-- (em nenhum dia do evento), nem está com sorteio pendente, nem foi marcado ausente neste mesmo dia.
create or replace function public.sorteio_elegiveis(p_evento text, p_dia text)
returns table(id uuid, nome text) language sql stable security definer set search_path = public as $$
  select p.id, p.nome
    from evento_participantes p
    join evento_presencas pr on pr.participante = p.id and pr.dia = p_dia
   where p.evento = p_evento
     and (pode_sortear() or pode_checkin_evento(p_evento))
     and not exists (select 1 from sorteios s where s.participante = p.id
                      and (s.status in ('sorteado','ganhador','retirado') or (s.status = 'ausente' and s.dia = p_dia)))
   order by p.nome
$$;
revoke execute on function public.sorteio_elegiveis(text,text) from public, anon;
grant execute on function public.sorteio_elegiveis(text,text) to authenticated;

-- Sorteia 1 nome. Aleatoriedade: gen_random_uuid() (gerador criptográfico do Postgres), sem peso nem regra.
create or replace function public.sortear(p_evento text, p_dia text, p_premio text default '')
returns public.sorteios language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_nome text; v_total int; v_rodada int; r sorteios;
begin
  if not pode_sortear() then raise exception 'Sem permissão para sortear.'; end if;
  perform pg_advisory_xact_lock(hashtext('sorteio:'||p_evento));
  if exists (select 1 from sorteios where evento = p_evento and status = 'sorteado') then
    raise exception 'Confirme (ganhador / retirou / ausente) o sorteado atual antes de sortear de novo.';
  end if;
  select count(*) into v_total from sorteio_elegiveis(p_evento, p_dia);
  if v_total = 0 then raise exception 'Ninguém disponível para sortear neste dia.'; end if;
  select e.id, e.nome into v_id, v_nome from sorteio_elegiveis(p_evento, p_dia) e order by gen_random_uuid() limit 1;
  select coalesce(max(rodada), 0) + 1 into v_rodada from sorteios where evento = p_evento;
  insert into sorteios (evento, dia, participante, nome, premio, rodada, elegiveis, por)
  values (p_evento, p_dia, v_id, v_nome, coalesce(trim(p_premio), ''), v_rodada, v_total, auth.uid())
  returning * into r;
  return r;
end $$;
revoke execute on function public.sortear(text,text,text) from public, anon;
grant execute on function public.sortear(text,text,text) to authenticated;

-- Marca o resultado: 'ganhador', 'retirado' (bloqueiam nos próximos dias), 'ausente' (volta a valer em outro dia).
create or replace function public.sorteio_marcar(p_id uuid, p_status text)
returns public.sorteios language plpgsql security definer set search_path = public as $$
declare r sorteios;
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  if p_status not in ('ganhador','retirado','ausente') then raise exception 'Status inválido.'; end if;
  update sorteios set status = p_status, atualizado_em = now() where id = p_id returning * into r;
  if r.id is null then raise exception 'Sorteio não encontrado.'; end if;
  return r;
end $$;
revoke execute on function public.sorteio_marcar(uuid,text) from public, anon;
grant execute on function public.sorteio_marcar(uuid,text) to authenticated;

-- Botão "Incluir todos de volta": libera todos os sorteados (mantém o histórico com status 'liberado').
create or replace function public.sorteio_reincluir_todos(p_evento text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  update sorteios set status = 'liberado', atualizado_em = now()
   where evento = p_evento and status in ('sorteado','ganhador','retirado','ausente');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.sorteio_reincluir_todos(text) from public, anon;
grant execute on function public.sorteio_reincluir_todos(text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='sorteios') then
    alter publication supabase_realtime add table public.sorteios; end if;
end $$;
