-- ---------- Checklist da Gestão de culto (Staff) + item do tipo 'texto' (observação) (23/11/2026; aplicado pelo Claude do chat:
-- migração "checklist_gestao_itens_obs_v2"). Checagem conta como Gestão de culto (checklist compartilhado). ----------
alter table checklist_itens drop constraint if exists checklist_itens_tipo_check;
alter table checklist_itens add constraint checklist_itens_tipo_check check (tipo in ('check','percentual','texto'));
alter table checklist_marcas add column if not exists obs text;

create or replace function public.checklist_valor_guarda() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare t text := (select tipo from checklist_itens where id = new.item);
begin
  if t = 'percentual' and new.valor is null then raise exception 'Informe a porcentagem da bateria (0 a 100).'; end if;
  if coalesce(t,'check') <> 'percentual' then new.valor := null; end if;
  if t = 'texto' then
    new.obs := nullif(left(trim(coalesce(new.obs, '')), 1000), '');
    if new.obs is null then raise exception 'Escreva a observação antes de salvar.'; end if;
  else new.obs := null; end if;
  return new;
end $function$;

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
            or (norm_nome(i.funcao) = norm_nome('Apoio') and norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2')))
            or (norm_nome(i.funcao) = norm_nome('Gestão de culto') and norm_nome(f->>'nome') = norm_nome('Checagem')))
       and midia_nome_bate(n, p.apelido, p.nome))
$$;

create or replace function public.checklist_meu_status(p_data text, p_culto text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with eu as (select * from pessoas where id = auth.uid() and status = 'aprovado' and not banco),
  esc as (
    select distinct e.area,
      case when norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2')) then 'Apoio'
           when norm_nome(f->>'nome') = norm_nome('Checagem') then 'Gestão de culto'
           else f->>'nome' end fn
      from eu p
      join escalas e on e.area in ('midia','staff') and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where midia_nome_bate(n, p.apelido, p.nome)),
  fns as (select * from esc where exists (select 1 from checklist_itens i where i.ativo and i.area = esc.area and norm_nome(i.funcao) = norm_nome(esc.fn)))
  select jsonb_build_object(
    'admin', coalesce((select papel = 'admin' from eu), false),
    'funcoes', coalesce((select jsonb_agg(distinct fn) from fns), '[]'::jsonb),
    'detalhe', coalesce((select jsonb_agg(jsonb_build_object('area', area, 'funcao', fn)) from fns), '[]'::jsonb),
    'hoje', p_data = hoje_sp(),
    'checkin', fez_checkin(p_data, p_culto),
    'pode_marcar', coalesce((select papel = 'admin' from eu), false)
                   or (p_data = hoje_sp() and exists (select 1 from fns) and fez_checkin(p_data, p_culto)))
$$;

-- 9 itens da Gestão de culto (o último é uma observação de texto, opcional)
insert into checklist_itens (funcao, area, bloco, ordem, texto, tipo, ativo, destaque)
select * from (values
 ('Gestão de culto','staff','Check-in das equipes',1,'Conferir check-in da Direção do culto','check',true,false),
 ('Gestão de culto','staff','Check-in das equipes',2,'Conferir check-in do Super Kids','check',true,false),
 ('Gestão de culto','staff','Check-in das equipes',3,'Conferir check-in da Mídia','check',true,false),
 ('Gestão de culto','staff','Check-in das equipes',4,'Conferir crachá da Intercessão','check',true,false),
 ('Gestão de culto','staff','Conteúdo do culto',5,'Conferir vídeo Missão de Deus','check',true,false),
 ('Gestão de culto','staff','Conteúdo do culto',6,'Conferir vídeo Tempo de Generosidade','check',true,false),
 ('Gestão de culto','staff','Conteúdo do culto',7,'Conferir slides da ministração','check',true,false),
 ('Gestão de culto','staff','Conteúdo do culto',8,'Conferir avisos do pós-culto','check',true,false),
 ('Gestão de culto','staff','Observações',9,'Observações do culto (se precisar relatar algo)','texto',true,false)
) v(funcao, area, bloco, ordem, texto, tipo, ativo, destaque)
where not exists (select 1 from checklist_itens i where i.area = 'staff' and i.funcao = v.funcao and i.texto = v.texto);
