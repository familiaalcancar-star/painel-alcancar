-- Cadastro com campos obrigatórios e novas funções (08/11/2026).
-- Funções novas: midia (consulta + extra Mídia), louvor e coro (só consulta). "Membro" = papel leitura (só consulta).
-- O cadastro é validado no banco: nome completo, e-mail válido, WhatsApp com DDD (10+ dígitos), conexão da lista e função.
-- Pessoa com papel midia tem o extra Mídia ligado automaticamente.

alter table public.pessoas drop constraint if exists pessoas_papel_check;
alter table public.pessoas add constraint pessoas_papel_check
  check (papel in ('admin','lider','auxiliar','organizacao','leitura','midia','louvor','coro'));
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check
  check (papel in ('admin','lider','auxiliar','organizacao','leitura','midia','louvor','coro'));
alter table public.cadastros drop constraint if exists cadastros_papel_check;
alter table public.cadastros add constraint cadastros_papel_check
  check (papel in ('lider','auxiliar','organizacao','leitura','midia','louvor','coro'));

-- Validação do cadastro (vale para cadastros novos e alterados; os antigos ficam como estão).
create or replace function public.cadastros_valida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nome := trim(coalesce(new.nome, '')); new.email := lower(trim(coalesce(new.email, ''))); new.whatsapp := trim(coalesce(new.whatsapp, ''));
  if new.nome = '' then raise exception 'Preencha o nome completo.' using errcode = '23514'; end if;
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.' using errcode = '23514'; end if;
  if length(regexp_replace(new.whatsapp, '\D', '', 'g')) < 10 then raise exception 'Informe o WhatsApp com DDD.' using errcode = '23514'; end if;
  if not exists (select 1 from config c, jsonb_array_elements(c.d->'conexoes') x where c.id = 'geral' and x->>'id' = new.conexao) then
    raise exception 'Escolha a conexão.' using errcode = '23514'; end if;
  if new.papel is null then raise exception 'Escolha a função na igreja.' using errcode = '23514'; end if;
  return new;
end $$;
revoke execute on function public.cadastros_valida() from public, anon, authenticated;
create or replace trigger cadastros_valida before insert or update on public.cadastros
  for each row execute function public.cadastros_valida();

-- Função Mídia liga o extra Mídia (na aprovação, no convite ou em qualquer alteração).
create or replace function public.pessoas_papel_midia() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.papel = 'midia' then new.midia := true; end if;
  return new;
end $$;
revoke execute on function public.pessoas_papel_midia() from public, anon, authenticated;
create or replace trigger pessoas_papel_midia before insert or update on public.pessoas
  for each row execute function public.pessoas_papel_midia();
