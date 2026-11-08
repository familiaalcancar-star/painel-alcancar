-- Mídia: pessoas fixas em TODOS os cultos (08/11/2026).
-- Ao criar ou alterar qualquer escala de Mídia (pelo site, importação ou direto no banco),
-- os nomes de config.geral.d.midiaFixos entram automaticamente se faltarem (sem duplicar;
-- a comparação ignora acento e maiúscula). Padrão: Pedro Morais e Augusto.

update public.config set d = d || '{"midiaFixos":["Pedro Morais","Augusto"]}'::jsonb
 where id = 'geral' and not (d ? 'midiaFixos');

create or replace function public.escalas_midia_fixos() returns trigger
language plpgsql security definer set search_path = public as $$
declare fixos jsonb; fn text; f jsonb; lista jsonb; nome text; i int; achou boolean := false; novas jsonb := '[]'::jsonb;
begin
  if coalesce(new.d->>'area', '') <> 'midia' then return new; end if;
  fixos := coalesce((select d->'midiaFixos' from config where id = 'geral'), '["Pedro Morais","Augusto"]'::jsonb);
  if jsonb_typeof(fixos) <> 'array' or jsonb_array_length(fixos) = 0 then return new; end if;
  fn := coalesce((select x->'funcoes'->0->>'nome' from config c, jsonb_array_elements(c.d->'areas') x
                   where c.id = 'geral' and x->>'id' = 'midia' limit 1), 'Mídia');
  for f in select * from jsonb_array_elements(case when jsonb_typeof(new.d->'funcoes') = 'array' then new.d->'funcoes' else '[]' end) loop
    if not achou and f->>'nome' = fn then
      achou := true;
      lista := case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end;
      for nome in select jsonb_array_elements_text(fixos) loop
        if not exists (select 1 from jsonb_array_elements_text(lista) p where norm_nome(p) = norm_nome(nome)) then
          lista := lista || to_jsonb(nome);
        end if;
      end loop;
      f := jsonb_set(f, '{pessoas}', lista);
    end if;
    novas := novas || f;
  end loop;
  if not achou then novas := novas || jsonb_build_object('nome', fn, 'pessoas', fixos); end if;
  new.d := jsonb_set(new.d, '{funcoes}', novas);
  return new;
end $$;
revoke execute on function public.escalas_midia_fixos() from public, anon, authenticated;
create or replace trigger escalas_midia_fixos before insert or update on public.escalas
  for each row execute function public.escalas_midia_fixos();
