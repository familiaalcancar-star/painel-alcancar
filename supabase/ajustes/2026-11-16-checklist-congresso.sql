-- ---------- Checklist no culto especial (ex.: Congresso) libera com o check-in da entrada (16/11/2026) ----------
-- Culto com nome próprio na escala (d.cultoNome): o checklist da Mídia só libera depois que a pessoa
-- recebeu presença na lista de presença daquele dia (feita na entrada). Nos outros cultos, continua
-- valendo o check-in dos voluntários (checkin_marcas).
create or replace function public.fez_checkin(p_data text, p_culto text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from escalas e where e.data = p_data and e.culto = p_culto and coalesce(e.d->>'cultoNome', '') <> '')
    then exists (
      select 1 from presencas pr join pessoas p on p.id = auth.uid()
       where jsonb_typeof(pr.dias) = 'object' and pr.dias ? p_data
         and midia_nome_bate(pr.nome, p.apelido, p.nome))
    else exists (
      select 1 from checkin_marcas cm join pessoas p on p.id = auth.uid()
       where cm.data = p_data and cm.culto = p_culto and cm.ci
         and midia_nome_bate(coalesce(nullif(cm.nome,''), cm.escalado), p.apelido, p.nome))
  end
$$;
revoke execute on function public.fez_checkin(text, text) from public, anon;
grant execute on function public.fez_checkin(text, text) to authenticated;
