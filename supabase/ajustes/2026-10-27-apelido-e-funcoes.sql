-- Ajuste de 27/10/2026 (já incluído no schema.sql).
-- 1) As funções novas (tem_escala e chat_guarda) nasceram liberadas para todos;
--    deixa igual às outras: só quem está logado usa tem_escala, ninguém chama chat_guarda direto.
revoke execute on function public.tem_escala() from public, anon;
grant execute on function public.tem_escala() to authenticated;
revoke execute on function public.chat_guarda() from public, anon, authenticated;

-- 2) Histórico grava só o apelido; sem apelido, só o primeiro nome.
create or replace function public.historico_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.por := auth.uid();
  new.em := now();
  new.por_nome := coalesce((select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from pessoas where id = auth.uid()),
                           (select coalesce(nullif(apelido,''), split_part(trim(nome),' ',1)) from cadastros where id = auth.uid()), '');
  return new;
end $$;
revoke execute on function public.historico_guarda() from public, anon, authenticated;

-- 3) Corrige nomes já gravados no histórico.
update public.historico h set por_nome = coalesce(nullif(p.apelido,''), split_part(trim(p.nome),' ',1))
  from public.pessoas p where p.id = h.por;
