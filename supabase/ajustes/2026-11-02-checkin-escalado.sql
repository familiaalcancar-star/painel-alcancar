-- Check-in feito por quem está escalado (02/11/2026).
-- Além de admin e extra Gestão, a pessoa aprovada escalada no Staff, função "Check-in",
-- marca o check-in dos cultos do dia em que está escalada (de hoje até daqui a 6 dias).
-- Ligação pelo nome escrito na escala: igual ao apelido, igual ao nome completo,
-- ou todas as palavras do nome escalado dentro do nome completo (sem acento/maiúscula).

create or replace function public.norm_nome(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.nome_bate(escrito text, apelido text, nome text) returns boolean
language sql immutable set search_path = public as $$
  select norm_nome(escrito) <> '' and (
       norm_nome(escrito) = norm_nome(apelido)
    or norm_nome(escrito) = norm_nome(nome)
    or string_to_array(norm_nome(escrito), ' ') <@ string_to_array(norm_nome(nome), ' '))
$$;

create or replace function public.checkin_escalado(p_data text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from pessoas p
      join escalas e on e.area = 'staff' and e.data = p_data
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where p.id = auth.uid() and p.status = 'aprovado' and not p.banco
       and norm_nome(f->>'nome') = 'check in'
       and p_data between to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
                      and to_char((now() at time zone 'America/Sao_Paulo') + interval '6 days', 'YYYY-MM-DD')
       and nome_bate(n, p.apelido, p.nome))
$$;
revoke execute on function public.checkin_escalado(text) from public, anon;
grant execute on function public.checkin_escalado(text) to authenticated;

drop policy if exists ck_escalado on public.checkin_marcas;
create policy ck_escalado on public.checkin_marcas for all to authenticated
  using (public.checkin_escalado(data)) with check (public.checkin_escalado(data));
