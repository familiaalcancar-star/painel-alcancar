-- Bate-papo sem histórico anterior (28/10/2026): cada pessoa só lê as mensagens enviadas
-- depois que ela foi aprovada. Administradores leem tudo (para moderar).
alter table public.pessoas add column if not exists aprovado_em timestamptz;
update public.pessoas set aprovado_em = coalesce(aprovado_em, criado_em) where status = 'aprovado';

-- Data da aprovação: marcada pelo banco quando o status vira "aprovado" (o site não consegue mudar).
create or replace function public.pessoas_aprovado_em() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'aprovado' then
    if tg_op = 'INSERT' or old.status is distinct from 'aprovado' then new.aprovado_em := now();
    else new.aprovado_em := old.aprovado_em; end if;
  else
    new.aprovado_em := null;
  end if;
  return new;
end $$;
drop trigger if exists pessoas_aprovado_em on public.pessoas;
create trigger pessoas_aprovado_em before insert or update on public.pessoas
  for each row execute function public.pessoas_aprovado_em();
revoke execute on function public.pessoas_aprovado_em() from public, anon, authenticated;

drop policy if exists chat_ler on public.chat;
create policy chat_ler on public.chat for select to authenticated
  using (exists (select 1 from public.pessoas p where p.id = auth.uid() and p.status = 'aprovado'
                   and (p.papel = 'admin' or chat.em >= p.aprovado_em)));
