-- Trocar escalado pelo check-in (09/11/2026; migração "checkin_trocar_escalado", aplicada pelo Claude do chat).
-- rpc trocar_escalado(escala, função atual, nome atual, nome novo?, função nova?) → novo array "funcoes".
-- Permissão: admin, Gestão, Organização ou escalado no Check-in/Gestão de culto; só escalas de hoje até +6 dias; registra no histórico.
create or replace function public.trocar_escalado(p_escala_id text, p_funcao_atual text, p_nome_atual text, p_nome_novo text default null, p_funcao_nova text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e escalas; fs jsonb; novo text; fn_nova text; i int; achou boolean := false; idx_nova int;
begin
  select * into e from escalas where id = p_escala_id;
  if not found then raise exception 'Escala não encontrada.'; end if;
  if not (is_admin() or tem_gestao() or eh_organizacao() or checkin_escalado(e.data)) then
    raise exception 'Sem permissão para alterar esta escala.';
  end if;
  if e.data < hoje_sp() or e.data > to_char((now() at time zone 'America/Sao_Paulo') + interval '6 days', 'YYYY-MM-DD') then
    raise exception 'Só dá para trocar pelo check-in escalas desta semana.';
  end if;
  novo := nullif(trim(coalesce(p_nome_novo, p_nome_atual)), '');
  fn_nova := coalesce(nullif(trim(p_funcao_nova), ''), p_funcao_atual);
  if novo is null then raise exception 'Informe o nome.'; end if;
  fs := coalesce(e.d->'funcoes', '[]'::jsonb);
  -- tira a pessoa da função atual (primeira ocorrência)
  for i in 0 .. jsonb_array_length(fs) - 1 loop
    if fs->i->>'nome' = p_funcao_atual then
      if (fs->i->'pessoas') ? p_nome_atual then
        fs := jsonb_set(fs, array[i::text, 'pessoas'],
          coalesce((select jsonb_agg(x) from jsonb_array_elements_text(fs->i->'pessoas') with ordinality t(x, o)
                     where not (x = p_nome_atual and o = (select min(o2) from jsonb_array_elements_text(fs->i->'pessoas') with ordinality t2(x2, o2) where x2 = p_nome_atual))), '[]'::jsonb));
        achou := true;
      end if;
      exit;
    end if;
  end loop;
  if not achou then raise exception 'Pessoa não encontrada nessa função.'; end if;
  -- coloca na função nova (cria a função na escala se ainda não existir)
  idx_nova := null;
  for i in 0 .. jsonb_array_length(fs) - 1 loop
    if fs->i->>'nome' = fn_nova then idx_nova := i; exit; end if;
  end loop;
  if idx_nova is null then
    fs := fs || jsonb_build_array(jsonb_build_object('nome', fn_nova, 'pessoas', jsonb_build_array(novo)));
  else
    fs := jsonb_set(fs, array[idx_nova::text, 'pessoas'], coalesce(fs->idx_nova->'pessoas', '[]'::jsonb) || to_jsonb(novo));
  end if;
  update escalas set d = jsonb_set(d, '{funcoes}', fs) where id = p_escala_id;
  insert into historico (acao, tipo, resumo, antes, depois)
  values ('editou', 'escala',
    'Check-in: '||p_nome_atual||' ('||p_funcao_atual||') → '||novo||' ('||fn_nova||') · '||e.data||' '||e.culto||' · '||e.area,
    jsonb_build_object('nome', p_nome_atual, 'funcao', p_funcao_atual),
    jsonb_build_object('nome', novo, 'funcao', fn_nova));
  return fs;
end $$;
grant execute on function public.trocar_escalado(text, text, text, text, text) to authenticated;
