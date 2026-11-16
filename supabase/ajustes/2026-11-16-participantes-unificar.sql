-- ---------- Participantes: uma lista só (16/11/2026) ----------
-- A tela do site (aba Check-in › Participantes) passa a usar evento_participantes / evento_presencas,
-- as mesmas tabelas do sorteio. A tabela "presencas" (lista feita antes, vazia) fica sem uso.
-- Regras pedidas: extra Desperta também usa a lista; presença marcada só o administrador desmarca;
-- cada presença guarda a hora e quem marcou; checklist da Mídia no culto especial libera com a presença.

create or replace function public.pode_checkin_evento(p_evento text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or tem_gestao() or eh_organizacao() or tem_desperta()
      or exists (select 1 from eventos e, jsonb_array_elements_text(coalesce(e.d->'dias', jsonb_build_array(e.data))) dia
                  where e.id = p_evento and checkin_escalado(dia))
$$;

alter policy evpres_desmarcar on public.evento_presencas using (is_admin());

alter table public.evento_presencas add column if not exists por_nome text;
create or replace function public.evento_quem() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'evento_presencas' then new.por := auth.uid(); new.por_nome := notif_nome(auth.uid()); new.em := now();
  else new.criado_por := coalesce(auth.uid(), new.criado_por); new.nome := trim(regexp_replace(new.nome, '\s+', ' ', 'g')); end if;
  return new;
end $$;

create or replace function public.fez_checkin(p_data text, p_culto text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from escalas e where e.data = p_data and e.culto = p_culto and coalesce(e.d->>'cultoNome', '') <> '')
    then exists (
      select 1 from evento_presencas pr join evento_participantes ep on ep.id = pr.participante join pessoas p on p.id = auth.uid()
       where pr.dia = p_data and midia_nome_bate(ep.nome, p.apelido, p.nome))
    else exists (
      select 1 from checkin_marcas cm join pessoas p on p.id = auth.uid()
       where cm.data = p_data and cm.culto = p_culto and cm.ci
         and midia_nome_bate(coalesce(nullif(cm.nome,''), cm.escalado), p.apelido, p.nome))
  end
$$;
