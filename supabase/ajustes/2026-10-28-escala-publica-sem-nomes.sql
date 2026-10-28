-- Escala pública sem nomes (28/10/2026).
-- Visitante (e quem ainda não foi aprovado): vê datas, áreas, conexões, observação e se a equipe está definida.
-- Só quem entrou e foi aprovado lê os nomes de quem vai servir (qualquer conexão). Editar continua igual.
create or replace function public.ve_equipes() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoas where id = auth.uid() and status = 'aprovado')
$$;
grant execute on function public.ve_equipes() to anon, authenticated;

drop policy if exists esc_ler on public.escalas;
create policy esc_ler on public.escalas for select to authenticated using (public.ve_equipes());

-- Versão pública: o documento sem "funcoes" (nomes), com "qtd" = quantas pessoas estão escaladas.
create or replace function public.escalas_publicas(p_de text, p_ate text)
returns table (id text, d jsonb)
language sql stable security definer set search_path = public as $$
  select e.id,
         (e.d - 'funcoes' - 'atualizadoPor') || jsonb_build_object('qtd',
           (select count(*) from jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f,
                   jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) p
             where trim(p) <> ''))
    from escalas e
   where e.data between p_de and p_ate
   order by e.data
   limit 2000
$$;
revoke execute on function public.escalas_publicas(text, text) from public;
grant execute on function public.escalas_publicas(text, text) to anon, authenticated;
