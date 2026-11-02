-- Check-in por escalado: ajustes (02/11/2026).
-- 1) Reconhecimento exige NOME E SOBRENOME: o nome escrito na escala precisa ter pelo menos 2 palavras,
--    todas dentro do nome completo do cadastro (sem acento/maiúscula). Apelido e nome de uma palavra não valem.
--    Só pessoas aprovadas com papel admin, lider, auxiliar ou organizacao (quem é só consulta não ganha).
-- 2) Quem está escalado no Check-in de uma data edita os NOMES de todas as áreas daquela data.
--    Data, culto, área e conexão continuam travados (gatilho escalas_guarda).

create or replace function public.nome_bate(escrito text, apelido text, nome text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(array_length(string_to_array(nullif(norm_nome(escrito), ''), ' '), 1), 0) >= 2
     and string_to_array(norm_nome(escrito), ' ') <@ string_to_array(norm_nome(nome), ' ')
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
       and p.papel in ('admin','lider','auxiliar','organizacao')
       and norm_nome(f->>'nome') = 'check in'
       and p_data between to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
                      and to_char((now() at time zone 'America/Sao_Paulo') + interval '6 days', 'YYYY-MM-DD')
       and nome_bate(n, p.apelido, p.nome))
$$;

-- Mesma regra de antes + quem está escalado no Check-in daquela data.
create or replace function public.pode_editar_escala(a text, cons jsonb, p_data text) returns boolean
language sql stable security definer set search_path = public as $$
  select pode_editar_escala(a, cons) or checkin_escalado(p_data)
$$;
revoke execute on function public.pode_editar_escala(text, jsonb, text) from public, anon;
grant execute on function public.pode_editar_escala(text, jsonb, text) to authenticated;

drop policy if exists esc_editar on public.escalas;
create policy esc_editar on public.escalas for update to authenticated
  using (public.pode_editar_escala(area, conexoes, data))
  with check (public.pode_editar_escala(d->>'area', conexoes_de(d), d->>'data'));

-- Criar: escalado no Check-in pode criar a escala de uma área sem conexão (Mídia, Staff, Ministração, Louvor) daquela data.
drop policy if exists esc_criar on public.escalas;
create policy esc_criar on public.escalas for insert to authenticated
  with check (is_admin()
    or (d->>'area' = 'louvor' and pode_louvor())
    or (public.checkin_escalado(d->>'data') and not area_por_conexao(d->>'area') and conexoes_de(d) = '[]'::jsonb));
