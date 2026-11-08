-- Checklist único "Apoio" para Apoio 1 e Apoio 2 (08/11/2026; aplicado no Supabase pelo Claude do chat).
-- Itens com funcao = 'Apoio'; quem está escalado em Apoio 1 OU Apoio 2 marca os itens do "Apoio".
create or replace function public.midia_escalado(p_data text, p_culto text, p_funcao text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pessoas p
      join escalas e on e.area = 'midia' and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where p.id = auth.uid() and p.status = 'aprovado' and not p.banco and (p.midia or p.papel = 'admin')
       and (norm_nome(f->>'nome') = norm_nome(p_funcao)
            or (norm_nome(p_funcao) = norm_nome('Apoio')
                and norm_nome(f->>'nome') in (norm_nome('Apoio 1'), norm_nome('Apoio 2'))))
       and midia_nome_bate(n, p.apelido, p.nome))
$$;

insert into public.checklist_itens (funcao, bloco, ordem, texto)
select 'Apoio', b, o, t from (values
  ('Bloco 1 – Luzes da plataforma', 10, 'Luz amarela direcionada à plataforma'),
  ('Bloco 1 – Luzes da plataforma', 20, 'Canhão branco direcionado à plataforma'),
  ('Bloco 2 – Luzes da mídia', 30, 'Teto – esquerda'),
  ('Bloco 2 – Luzes da mídia', 40, 'Teto – direita'),
  ('Bloco 3 – Intercessão', 50, 'Luzes azuis da intercessão')
) v(b, o, t)
where not exists (select 1 from public.checklist_itens where funcao = 'Apoio');
