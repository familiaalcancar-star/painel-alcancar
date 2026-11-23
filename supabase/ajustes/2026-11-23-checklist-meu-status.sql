-- ---------- Checklist: uma só pergunta ao banco (23/11/2026; aplicado pelo Claude do chat: migração "checklist_meu_status") ----------
-- "Neste culto, quais checklists eu posso marcar e por quê?" → {admin, funcoes, hoje, checkin, pode_marcar}
create or replace function public.checklist_meu_status(p_data text, p_culto text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with eu as (select * from pessoas where id = auth.uid() and status = 'aprovado' and not banco),
  fns as (
    select distinct case when norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2')) then 'Apoio' else f->>'nome' end fn
      from eu p
      join escalas e on e.area = 'midia' and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where midia_nome_bate(n, p.apelido, p.nome))
  select jsonb_build_object(
    'admin', coalesce((select papel = 'admin' from eu), false),
    'funcoes', coalesce((select jsonb_agg(fn) from fns), '[]'::jsonb),
    'hoje', p_data = hoje_sp(),
    'checkin', fez_checkin(p_data, p_culto),
    'pode_marcar', coalesce((select papel = 'admin' from eu), false)
                   or (p_data = hoje_sp() and exists (select 1 from fns) and fez_checkin(p_data, p_culto)))
$$;
grant execute on function public.checklist_meu_status(text, text) to authenticated;
