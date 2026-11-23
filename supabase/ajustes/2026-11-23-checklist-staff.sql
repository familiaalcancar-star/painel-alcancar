-- ---------- Checklist também para a Staff (Gestão de culto e Checagem) (23/11/2026; aplicado pelo Claude do chat:
-- migração "checklist_staff_gestao_checagem") ----------
alter table checklist_itens add column if not exists area text not null default 'midia';

-- escalado na função do item (Mídia ou Staff), naquele culto
create or replace function public.checklist_escalado(p_data text, p_culto text, p_item uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from checklist_itens i
      join pessoas p on p.id = auth.uid() and p.status = 'aprovado' and not p.banco
      join escalas e on e.area = i.area and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where i.id = p_item and i.ativo
       and (norm_nome(f->>'nome') = norm_nome(i.funcao)
            or (norm_nome(i.funcao) = norm_nome('Apoio') and norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2'))))
       and midia_nome_bate(n, p.apelido, p.nome))
$$;

-- quem vê os checklists: admin, Mídia, Gestão, ou quem está escalado na Mídia/Staff de hoje até 7 dias
create or replace function public.ve_checklist() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select tem_midia()
      or coalesce((select gestao from pessoas where id = auth.uid() and status = 'aprovado' and not banco), false)
      or exists (
        select 1 from pessoas p
          join escalas e on e.area in ('midia','staff') and e.data between hoje_sp() and to_char(hoje_sp()::date + 7, 'YYYY-MM-DD')
          cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
         where p.id = auth.uid() and p.status = 'aprovado' and not p.banco and midia_nome_bate(n, p.apelido, p.nome))
$$;

drop policy if exists ckl_itens_ler on checklist_itens;
create policy ckl_itens_ler on checklist_itens for select to authenticated using (ve_checklist());
drop policy if exists ckl_marcas_ler on checklist_marcas;
create policy ckl_marcas_ler on checklist_marcas for select to authenticated using (ve_checklist());
drop policy if exists ckl_marcas_marcar on checklist_marcas;
create policy ckl_marcas_marcar on checklist_marcas for insert to authenticated
  with check (is_admin() or (data = hoje_sp() and checklist_escalado(data, culto, item) and fez_checkin(data, culto)));

create or replace function public.checklist_confirmar(p_data text, p_culto text, p_item uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare m checklist_marcas;
begin
  if auth.uid() is null or not sessao_pode_escrever() then raise exception 'sem permissão'; end if;
  if not (p_data = hoje_sp() and checklist_escalado(p_data, p_culto, p_item) and fez_checkin(p_data, p_culto)) then
    raise exception 'Só quem está escalado nesta função, no dia do culto e com check-in, confirma.'; end if;
  select * into m from checklist_marcas where data = p_data and culto = p_culto and item = p_item;
  if m.item is null then raise exception 'Item ainda não marcado.'; end if;
  if m.por = auth.uid() or m.confirmado_por is not null then return; end if;
  update checklist_marcas set confirmado_por = auth.uid(), confirmado_nome = notif_nome(auth.uid()), confirmado_em = now()
   where data = p_data and culto = p_culto and item = p_item;
  insert into historico (acao, tipo, resumo, por, por_nome)
  values ('editou', 'checklist', 'Checklist '||to_char(p_data::date, 'DD/MM')||' · '||p_culto||' · '||m.funcao||': confirmou "'||m.texto||'" (marcado por '||m.por_nome||')',
          auth.uid(), notif_nome(auth.uid()));
end $function$;

-- status: agora inclui as funções da Staff (Gestão de culto, Checagem...)
create or replace function public.checklist_meu_status(p_data text, p_culto text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with eu as (select * from pessoas where id = auth.uid() and status = 'aprovado' and not banco),
  fns as (
    select distinct e.area, case when norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2')) then 'Apoio' else f->>'nome' end fn
      from eu p
      join escalas e on e.area in ('midia','staff') and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where midia_nome_bate(n, p.apelido, p.nome)
       and exists (select 1 from checklist_itens i where i.ativo and i.area = e.area
                     and norm_nome(i.funcao) = norm_nome(case when norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2')) then 'Apoio' else f->>'nome' end)))
  select jsonb_build_object(
    'admin', coalesce((select papel = 'admin' from eu), false),
    'funcoes', coalesce((select jsonb_agg(fn) from fns), '[]'::jsonb),
    'detalhe', coalesce((select jsonb_agg(jsonb_build_object('area', area, 'funcao', fn)) from fns), '[]'::jsonb),
    'hoje', p_data = hoje_sp(),
    'checkin', fez_checkin(p_data, p_culto),
    'pode_marcar', coalesce((select papel = 'admin' from eu), false)
                   or (p_data = hoje_sp() and exists (select 1 from fns) and fez_checkin(p_data, p_culto)))
$$;
grant execute on function public.checklist_escalado(text,text,uuid), public.ve_checklist() to authenticated;
