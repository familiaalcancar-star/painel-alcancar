-- ---------- Quem marcou: checklist (confirmação do escalado) e check-in (check-in, entregue, devolvido) (13/11/2026) ----------

-- 1) Checklist: o admin pode marcar antes; quando o escalado também confere, o nome dele aparece junto.
alter table public.checklist_marcas add column if not exists confirmado_por uuid;
alter table public.checklist_marcas add column if not exists confirmado_nome text;
alter table public.checklist_marcas add column if not exists confirmado_em timestamptz;

create or replace function public.checklist_confirmar(p_data text, p_culto text, p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m checklist_marcas; fn text := (select funcao from checklist_itens where id = p_item and ativo);
begin
  if auth.uid() is null or not sessao_pode_escrever() then raise exception 'sem permissão'; end if;
  if not (tem_midia() and p_data = hoje_sp() and midia_escalado(p_data, p_culto, fn) and fez_checkin(p_data, p_culto)) then
    raise exception 'Só quem está escalado nesta função, no dia do culto e com check-in, confirma.'; end if;
  select * into m from checklist_marcas where data = p_data and culto = p_culto and item = p_item;
  if m.item is null then raise exception 'Item ainda não marcado.'; end if;
  if m.por = auth.uid() or m.confirmado_por is not null then return; end if;
  update checklist_marcas set confirmado_por = auth.uid(), confirmado_nome = notif_nome(auth.uid()), confirmado_em = now()
   where data = p_data and culto = p_culto and item = p_item;
  insert into historico (acao, tipo, resumo, por, por_nome)
  values ('editou', 'checklist', 'Checklist da Mídia '||to_char(p_data::date, 'DD/MM')||' · '||p_culto||' · '||m.funcao||': confirmou "'||m.texto||'" (marcado por '||m.por_nome||')',
          auth.uid(), notif_nome(auth.uid()));
end $$;
revoke execute on function public.checklist_confirmar(text, text, uuid) from public, anon;
grant execute on function public.checklist_confirmar(text, text, uuid) to authenticated;

-- 2) Check-in: quem marcou o check-in e quem marcou "Entregue"/"Devolvido" de cada item (com a hora).
--    Gravado pelo banco (não dá para escrever em nome de outro).
alter table public.checkin_marcas add column if not exists ci_nome text;
alter table public.checkin_marcas add column if not exists ci_em timestamptz;

create or replace function public.checkin_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare quem text := notif_nome(auth.uid()); agora text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  novos jsonb := '[]'; it jsonb; ant jsonb;
begin
  new.por := auth.uid(); new.em := now();
  -- Check-in
  if not new.ci then new.ci_nome := null; new.ci_em := null;
  elsif tg_op = 'INSERT' or not old.ci then new.ci_nome := quem; new.ci_em := now();
  else new.ci_nome := old.ci_nome; new.ci_em := old.ci_em; end if;
  -- Itens: carimba quando "ret" (entregue) ou "dev" (devolvido) mudam; senão mantém o que já estava.
  for it in select * from jsonb_array_elements(case when jsonb_typeof(new.itens) = 'array' then new.itens else '[]' end) loop
    ant := case when tg_op = 'UPDATE' and jsonb_typeof(old.itens) = 'array'
                then (select x from jsonb_array_elements(old.itens) x where x->>'nome' = it->>'nome' limit 1) end;
    it := it - 'ret_nome' - 'ret_em' - 'dev_nome' - 'dev_em';
    if coalesce((it->>'ret')::int, 0) > 0 then
      if ant is not null and coalesce((ant->>'ret')::int, 0) = coalesce((it->>'ret')::int, 0) and ant ? 'ret_nome'
        then it := it || jsonb_build_object('ret_nome', ant->'ret_nome', 'ret_em', ant->'ret_em');
        else it := it || jsonb_build_object('ret_nome', quem, 'ret_em', agora); end if;
    end if;
    if coalesce((it->>'dev')::int, 0) > 0 then
      if ant is not null and coalesce((ant->>'dev')::int, 0) = coalesce((it->>'dev')::int, 0) and ant ? 'dev_nome'
        then it := it || jsonb_build_object('dev_nome', ant->'dev_nome', 'dev_em', ant->'dev_em');
        else it := it || jsonb_build_object('dev_nome', quem, 'dev_em', agora); end if;
    end if;
    novos := novos || it;
  end loop;
  new.itens := novos;
  return new;
end $$;
