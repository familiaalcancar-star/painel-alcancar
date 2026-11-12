-- ---------- Contas duplicadas (12/11/2026) ----------
-- Quem entra com outra conta (ex.: iCloud com senha e depois Google/Gmail) vira um usuário novo e cai no cadastro de novo.
-- 1) conta_do_whatsapp: no cadastro, avisa se o WhatsApp já está em outra conta (mostra só o e-mail mascarado e como entra).
create or replace function public.conta_do_whatsapp(p_whats text)
returns table(email text, provedor text)
language plpgsql stable security definer set search_path = public, auth as $$
declare w text := right(regexp_replace(coalesce(p_whats,''), '\D', '', 'g'), 11);
begin
  if auth.uid() is null or length(w) < 10 then return; end if;
  return query
  select regexp_replace(u.email, '^(.{2})[^@]*(@.*)$', '\1•••\2')::text,
         (case when u.raw_app_meta_data->'providers' ? 'google' and not (u.raw_app_meta_data->'providers' ? 'email') then 'google'
              when u.raw_app_meta_data->'providers' ? 'google' then 'ambos' else 'email' end)::text
    from (select id, whatsapp, 1 as pri from pessoas where status in ('aprovado','pendente')
          union all select id, whatsapp, 2 from cadastros) x
    join auth.users u on u.id = x.id
   where x.id <> auth.uid() and right(regexp_replace(x.whatsapp, '\D', '', 'g'), 11) = w
   order by x.pri, u.last_sign_in_at desc nulls last
   limit 1;
end $$;
revoke execute on function public.conta_do_whatsapp(text) from public, anon;
grant execute on function public.conta_do_whatsapp(text) to authenticated;

-- 2) transferir_pessoa (só admin): passa nome, WhatsApp, função, conexão e extras da conta antiga para a nova
--    (que já entrou no painel). A nova fica aprovada; a antiga fica "removido". O histórico continua.
create or replace function public.transferir_pessoa(p_de uuid, p_para uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v pessoas;
begin
  if not is_admin() then raise exception 'só administradores'; end if;
  if p_de = p_para then raise exception 'contas iguais'; end if;
  select * into v from pessoas where id = p_de;
  if v.id is null then raise exception 'conta antiga sem cadastro'; end if;
  if not exists (select 1 from auth.users where id = p_para) then raise exception 'conta nova não existe'; end if;
  insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, midia, banco, status, aprovado_em)
  values (p_para, (select email from auth.users where id = p_para), v.nome, v.apelido, v.whatsapp, v.conexao, v.papel,
          v.gestao, v.ministro, v.avisos, v.escala, v.midia, v.banco, 'aprovado', now())
  on conflict (id) do update set nome = excluded.nome, apelido = excluded.apelido, whatsapp = excluded.whatsapp,
    conexao = excluded.conexao, papel = excluded.papel, gestao = excluded.gestao, ministro = excluded.ministro,
    avisos = excluded.avisos, escala = excluded.escala, midia = excluded.midia, banco = excluded.banco,
    status = 'aprovado', aprovado_em = now();
  delete from cadastros where id = p_para;
  update pessoas set status = 'removido' where id = p_de;
end $$;
revoke execute on function public.transferir_pessoa(uuid, uuid) from public, anon;
grant execute on function public.transferir_pessoa(uuid, uuid) to authenticated;
