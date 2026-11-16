-- ---------- Sorteio: remover um registro e limpar tudo (17/11/2026; aplicado pelo Claude do chat: migração "sorteio_remover_e_limpar") ----------
-- Remove UM registro do sorteio (a pessoa volta a concorrer).
create or replace function public.sorteio_remover(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r sorteios;
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  delete from sorteios where id = p_id returning * into r;
  if r.id is null then raise exception 'Registro não encontrado.'; end if;
  insert into historico (acao, tipo, resumo)
  values ('excluiu', 'sorteio', 'Sorteio: removido do registro '||r.nome||' (rodada '||r.rodada||', '||r.dia||', '||r.status||')');
end $$;
revoke execute on function public.sorteio_remover(uuid) from public, anon;
grant execute on function public.sorteio_remover(uuid) to authenticated;

-- Limpa TODO o registro de sorteios do evento (todos voltam a concorrer; rodadas recomeçam do 1).
create or replace function public.sorteio_limpar_tudo(p_evento text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not pode_sortear() then raise exception 'Sem permissão.'; end if;
  delete from sorteios where evento = p_evento;
  get diagnostics n = row_count;
  insert into historico (acao, tipo, resumo)
  values ('excluiu', 'sorteio', 'Sorteio: registro limpo ('||n||' sorteio(s) apagado(s))');
  return n;
end $$;
revoke execute on function public.sorteio_limpar_tudo(text) from public, anon;
grant execute on function public.sorteio_limpar_tudo(text) to authenticated;
