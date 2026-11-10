-- Checklist da Mídia: itens de porcentagem (10/11/2026; migração "checklist_bateria_percentual", aplicada pelo Claude do chat;
-- o histórico com o valor foi aplicado daqui).
-- checklist_itens.tipo: 'check' (caixinha) ou 'percentual' (0–100%); checklist_marcas.valor guarda a porcentagem.
alter table public.checklist_itens add column if not exists tipo text not null default 'check';
do $$ begin
  alter table public.checklist_itens add constraint checklist_itens_tipo_check check (tipo in ('check','percentual'));
exception when duplicate_object then null; end $$;
alter table public.checklist_marcas add column if not exists valor int;
do $$ begin
  alter table public.checklist_marcas add constraint checklist_marcas_valor_check check (valor >= 0 and valor <= 100);
exception when duplicate_object then null; end $$;

-- Item de porcentagem exige o valor; item de caixinha não guarda valor.
create or replace function public.checklist_valor_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text := (select tipo from checklist_itens where id = new.item);
begin
  if t = 'percentual' and new.valor is null then raise exception 'Informe a porcentagem da bateria (0 a 100).'; end if;
  if coalesce(t,'check') <> 'percentual' then new.valor := null; end if;
  return new;
end $$;
revoke execute on function public.checklist_valor_guarda() from public, anon, authenticated;
drop trigger if exists checklist_valor_guarda on public.checklist_marcas;
create trigger checklist_valor_guarda before insert or update on public.checklist_marcas
  for each row execute function public.checklist_valor_guarda();

-- Histórico com o valor (ex.: marcou "Bateria ao retirar (%)" = 85%).
create or replace function public.checklist_marca_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r checklist_marcas;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into historico (acao, tipo, resumo, por, por_nome)
  values (case when tg_op = 'DELETE' then 'excluiu' else 'criou' end, 'checklist',
    'Checklist da Mídia '||to_char(r.data::date, 'DD/MM')||' · '||r.culto||' · '||r.funcao||': '
      ||case when tg_op = 'DELETE' then 'desmarcou' else 'marcou' end||' "'||r.texto||'"'
      ||case when r.valor is not null then ' = '||r.valor||'%' else '' end
      ||case when tg_op = 'DELETE' and r.por is distinct from auth.uid() then ' (marcado por '||r.por_nome||')' else '' end,
    auth.uid(), notif_nome(auth.uid()));
  return null;
end $$;

-- Itens de bateria do iPhone (Câmera).
insert into public.checklist_itens (funcao, bloco, ordem, texto, tipo)
select 'Câmera', 'Bloco 1 – iPhone', o, t, 'percentual' from (values (20, 'Bateria ao retirar (%)'), (25, 'Bateria ao devolver (%)')) v(o, t)
where not exists (select 1 from public.checklist_itens where funcao = 'Câmera' and texto = v.t);
