-- Check-in e Checklist amarrados (09/11/2026; migração "checkin_e_checklist_amarrados", aplicada pelo Claude do chat).
-- 1) checkin_escalado: vale para quem está no Staff em "Check-in" OU "Gestão de culto" (semana do culto).
-- 2) eh_organizacao + política ck_organizacao: papel Organização aprovado acessa o check-in.
-- 3) fez_checkin + ckl_marcas_marcar: o Checklist da Mídia só é marcado depois que a pessoa recebeu check-in
--    (ci = true em checkin_marcas, mesmo dia e culto, nome batendo com o cadastro).

create or replace function public.checkin_escalado(p_data text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from pessoas p
      join escalas e on e.area = 'staff' and e.data = p_data
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where p.id = auth.uid() and p.status = 'aprovado' and not p.banco
       and p.papel in ('admin','lider','auxiliar','organizacao')
       and norm_nome(f->>'nome') in (norm_nome('Check-in'), norm_nome('Gestão de culto'))
       and p_data between to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
                      and to_char((now() at time zone 'America/Sao_Paulo') + interval '6 days', 'YYYY-MM-DD')
       and nome_bate(n, p.apelido, p.nome))
$$;

create or replace function public.eh_organizacao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoas where id = auth.uid() and status = 'aprovado' and not banco and papel = 'organizacao')
$$;
grant execute on function public.eh_organizacao() to authenticated;

drop policy if exists ck_organizacao on public.checkin_marcas;
create policy ck_organizacao on public.checkin_marcas for all to authenticated
  using (public.eh_organizacao()) with check (public.eh_organizacao());

create or replace function public.fez_checkin(p_data text, p_culto text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from checkin_marcas cm join pessoas p on p.id = auth.uid()
     where cm.data = p_data and cm.culto = p_culto and cm.ci
       and midia_nome_bate(coalesce(nullif(cm.nome,''), cm.escalado), p.apelido, p.nome))
$$;
revoke execute on function public.fez_checkin(text, text) from public, anon;
grant execute on function public.fez_checkin(text, text) to authenticated;

drop policy if exists ckl_marcas_marcar on public.checklist_marcas;
create policy ckl_marcas_marcar on public.checklist_marcas for insert to authenticated
  with check (is_admin() or (public.tem_midia() and data = public.hoje_sp()
    and public.midia_escalado(data, culto, (select i.funcao from checklist_itens i where i.id = item and i.ativo))
    and public.fez_checkin(data, culto)));
