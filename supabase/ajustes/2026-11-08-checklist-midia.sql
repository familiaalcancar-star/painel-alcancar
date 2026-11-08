-- Checklist da Mídia (08/11/2026).
-- 1) Extra "Mídia" nas pessoas (e nos convites): quem tem vê a aba Checklist da Mídia.
-- 2) Escala da Mídia com funções: Projeção, Transmissão, Câmera, Apoio 1, Apoio 2.
--    Apoio 1 = Pedro Morais e Apoio 2 = Augusto Cantuaria por padrão (o administrador pode trocar num culto).
--    As escalas antigas (função única "Mídia") são convertidas sem perder nomes.
-- 3) Itens do checklist no banco (por função, bloco e ordem), editáveis pelo administrador.
-- 4) Marcações por culto (data + culto), com RLS: só marca quem tem o extra Mídia, está escalado
--    na Mídia naquele culto, na função do item, e no dia do culto (America/Sao_Paulo). Admin marca tudo.
-- 5) Desmarcar: quem marcou ou administrador. Marcar e desmarcar entram no Histórico.

-- ---------- 1) Extra Mídia ----------
alter table public.pessoas add column if not exists midia boolean not null default false;
alter table public.convites add column if not exists midia boolean not null default false;

create or replace function public.tem_midia() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' or midia from pessoas where id = auth.uid() and status = 'aprovado' and not banco), false)
$$;
grant execute on function public.tem_midia() to authenticated;

create or replace function public.hoje_sp() returns text
language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
$$;

-- Convite por e-mail também leva o extra Mídia.
create or replace function cadastro_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare r pessoas_referencia; c convites; w text := right(regexp_replace(new.whatsapp, '\D', '', 'g'), 11);
  email_login text := (select lower(trim(u.email)) from auth.users u where u.id = new.id);
begin
  if exists (select 1 from pessoas where id = new.id) then return new; end if;
  select * into c from convites cv where cv.email = email_login;
  if found then
    insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, banco, midia, status)
    values (new.id, email_login, new.nome, coalesce(new.apelido,''), new.whatsapp, coalesce(c.conexao, new.conexao), c.papel,
            c.gestao, c.ministro, c.avisos, c.escala, c.banco, c.midia, 'aprovado');
    delete from convites cv where cv.email = email_login;
    insert into historico (acao, tipo, resumo, por, por_nome)
      values ('criou', 'config', 'Aprovado pelo convite por e-mail: '||coalesce(nullif(new.apelido,''), split_part(trim(new.nome),' ',1)), new.id, 'Sistema');
    return new;
  end if;
  if length(w) < 10 then return new; end if;
  select * into r from pessoas_referencia
   where right(regexp_replace(coalesce(d->>'whatsapp',''), '\D', '', 'g'), 11) = w
     and coalesce(d->>'papel','') in ('lider','auxiliar','organizacao','leitura')
     and d->>'usado_por' is null
   limit 1;
  if not found then return new; end if;
  insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, status, banco)
  values (new.id, coalesce(email_login, new.email), new.nome, coalesce(nullif(new.apelido,''), r.d->>'apelido', ''), new.whatsapp,
          r.d->>'conexao', r.d->>'papel',
          coalesce((r.d->>'gestao')::boolean,false), coalesce((r.d->>'ministro')::boolean,false),
          coalesce((r.d->>'avisos')::boolean,false), coalesce((r.d->>'escala')::boolean,false), 'aprovado', false);
  update pessoas_referencia set d = d || jsonb_build_object('usado_por', new.id) where id_antigo = r.id_antigo;
  insert into historico (acao, tipo, resumo, por, por_nome)
    values ('criou', 'config', 'Aprovado automaticamente (painel antigo): '||coalesce(nullif(new.apelido,''), split_part(trim(new.nome),' ',1)), new.id, 'Sistema');
  return new;
end $$;
revoke execute on function cadastro_auto() from public, anon, authenticated;

-- ---------- 2) Funções da Mídia na escala ----------
update public.config c set d = jsonb_set(c.d, '{areas}', (
    select jsonb_agg(case when x->>'id' = 'midia' then x || jsonb_build_object('funcoes', '[
      {"nome":"Projeção","vagas":1},{"nome":"Transmissão","vagas":1},{"nome":"Câmera","vagas":1},
      {"nome":"Apoio 1","vagas":1},{"nome":"Apoio 2","vagas":1}]'::jsonb) else x end order by ord)
    from jsonb_array_elements(c.d->'areas') with ordinality t(x, ord)))
  || '{"midiaFixos":{"Apoio 1":"Pedro Morais","Apoio 2":"Augusto Cantuaria"}}'::jsonb
 where c.id = 'geral';

-- Nome escrito na escala é a pessoa fixa? (igual, ou só o primeiro nome dela)
create or replace function public.midia_eh_fixo(n text, fixo text) returns boolean
language sql immutable set search_path = public as $$
  select norm_nome(n) <> '' and (norm_nome(n) = norm_nome(fixo) or norm_nome(n) = split_part(norm_nome(fixo), ' ', 1))
$$;

-- Escala antiga (lista única de nomes) → funções: fixos nos Apoios; os demais, em ordem, em Projeção, Transmissão e Câmera.
create or replace function public.midia_distribuir(lista jsonb, fixos jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare n text; resto text[] := '{}'; a1 jsonb := '[]'; a2 jsonb := '[]'; f1 text := fixos->>'Apoio 1'; f2 text := fixos->>'Apoio 2';
  proj jsonb := '[]'; trans jsonb := '[]'; cam jsonb := '[]';
begin
  for n in select jsonb_array_elements_text(coalesce(lista, '[]')) loop
    if trim(n) = '' then continue; end if;
    if f1 is not null and midia_eh_fixo(n, f1) and jsonb_array_length(a1) = 0 then a1 := jsonb_build_array(f1);
    elsif f2 is not null and midia_eh_fixo(n, f2) and jsonb_array_length(a2) = 0 then a2 := jsonb_build_array(f2);
    else resto := resto || n; end if;
  end loop;
  if array_length(resto, 1) >= 1 then proj := jsonb_build_array(resto[1]); end if;
  if array_length(resto, 1) >= 2 then trans := jsonb_build_array(resto[2]); end if;
  if array_length(resto, 1) >= 3 then cam := to_jsonb(resto[3:]); end if;
  return jsonb_build_array(
    jsonb_build_object('nome','Projeção','pessoas',proj), jsonb_build_object('nome','Transmissão','pessoas',trans),
    jsonb_build_object('nome','Câmera','pessoas',cam), jsonb_build_object('nome','Apoio 1','pessoas',a1),
    jsonb_build_object('nome','Apoio 2','pessoas',a2));
end $$;

-- Gatilho da Mídia (substitui o de 08/11 que só acrescentava nomes):
-- converte escala antiga, garante as 5 funções e preenche Apoio 1/2 com o padrão quando estiverem vazios.
create or replace function public.escalas_midia_fixos() returns trigger
language plpgsql security definer set search_path = public as $$
declare fixos jsonb; funcs jsonb; todos jsonb := '[]'; f jsonb; k text; nomes text[] := array['Projeção','Transmissão','Câmera','Apoio 1','Apoio 2'];
  saida jsonb := '[]'; g jsonb; extra jsonb := '[]';
begin
  if coalesce(new.d->>'area', '') <> 'midia' then return new; end if;
  fixos := (select d->'midiaFixos' from config where id = 'geral');
  if fixos is null or jsonb_typeof(fixos) <> 'object' then fixos := '{"Apoio 1":"Pedro Morais","Apoio 2":"Augusto Cantuaria"}'; end if;
  funcs := case when jsonb_typeof(new.d->'funcoes') = 'array' then new.d->'funcoes' else '[]' end;
  -- Formato antigo: uma função "Mídia" com todos os nomes.
  if exists (select 1 from jsonb_array_elements(funcs) x where norm_nome(x->>'nome') = 'midia') then
    for f in select * from jsonb_array_elements(funcs) loop todos := todos || coalesce(f->'pessoas', '[]'); end loop;
    funcs := midia_distribuir(todos, fixos);
  end if;
  -- As 5 funções, na ordem; outras funções que vierem (inesperadas) ficam no fim.
  foreach k in array nomes loop
    g := (select x from jsonb_array_elements(funcs) x where norm_nome(x->>'nome') = norm_nome(k) limit 1);
    if g is null then g := jsonb_build_object('nome', k, 'pessoas', '[]'::jsonb); end if;
    g := jsonb_set(g, '{nome}', to_jsonb(k));
    if fixos ? k and (jsonb_typeof(g->'pessoas') <> 'array' or not exists (select 1 from jsonb_array_elements_text(g->'pessoas') p where trim(p) <> '')) then
      g := jsonb_set(g, '{pessoas}', jsonb_build_array(fixos->>k));
    end if;
    saida := saida || g;
  end loop;
  select coalesce(jsonb_agg(x), '[]') into extra from jsonb_array_elements(funcs) x where not (norm_nome(x->>'nome') = any (array(select norm_nome(u) from unnest(nomes) u)));
  new.d := jsonb_set(new.d, '{funcoes}', saida || extra);
  return new;
end $$;
revoke execute on function public.escalas_midia_fixos() from public, anon, authenticated;
create or replace trigger escalas_midia_fixos before insert or update on public.escalas
  for each row execute function public.escalas_midia_fixos();

-- ---------- 3) Itens do checklist ----------
create table if not exists public.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  funcao text not null,
  bloco text not null,
  ordem numeric not null,
  texto text not null check (char_length(texto) between 1 and 300),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.checklist_itens enable row level security;
grant select, insert, update on public.checklist_itens to authenticated;
revoke all on public.checklist_itens from anon;
drop policy if exists ckl_itens_ler on public.checklist_itens;
create policy ckl_itens_ler on public.checklist_itens for select to authenticated using (public.tem_midia());
drop policy if exists ckl_itens_admin on public.checklist_itens;
create policy ckl_itens_admin on public.checklist_itens for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists status_banco_inserir on public.checklist_itens;
create policy status_banco_inserir on public.checklist_itens as restrictive for insert to authenticated with check (public.sessao_pode_escrever());
drop policy if exists status_banco_editar on public.checklist_itens;
create policy status_banco_editar on public.checklist_itens as restrictive for update to authenticated using (public.sessao_pode_escrever()) with check (public.sessao_pode_escrever());

insert into public.checklist_itens (funcao, bloco, ordem, texto)
select 'Projeção', b, o, t from (values
  ('Bloco 1 – Backgrounds', 10, 'Wallpaper (tela de descanso)'),
  ('Bloco 1 – Backgrounds', 20, 'Fundo da letra das músicas'),
  ('Bloco 1 – Backgrounds', 30, 'QR Code do Tempo de Generosidade'),
  ('Bloco 1 – Backgrounds', 40, 'Wallpaper da Bíblia'),
  ('Bloco 2 – Cronômetro', 50, 'Conferir se está no horário correto'),
  ('Bloco 3 – Vídeos (testar áudio e vídeo)', 60, 'Missão e Visão'),
  ('Bloco 3 – Vídeos (testar áudio e vídeo)', 70, 'Missão de Deus'),
  ('Bloco 3 – Vídeos (testar áudio e vídeo)', 80, 'Tempo de Generosidade'),
  ('Bloco 3 – Vídeos (testar áudio e vídeo)', 90, 'Mídias da ministração (se houver)'),
  ('Bloco 4 – Louvor', 100, 'Adicionar os louvores do dia'),
  ('Bloco 4 – Louvor', 110, 'Conferir a letra de cada música junto com o ministro de louvor'),
  ('Bloco 5 – Abertura', 120, 'Verificar o versículo de abertura do culto'),
  ('Bloco 6 – Ministração', 130, 'Conferir os slides (enquadramento, escrita, referências e imagens)'),
  ('Bloco 7 – Momento de Conexão (antes de iniciar o culto)', 140, 'Música ambiente tocando'),
  ('Bloco 7 – Momento de Conexão (antes de iniciar o culto)', 150, 'Cronômetro na tela')
) v(b, o, t)
where not exists (select 1 from public.checklist_itens where funcao = 'Projeção');

-- ---------- 4) Marcações ----------
create table if not exists public.checklist_marcas (
  data text not null,
  culto text not null,
  item uuid not null references public.checklist_itens(id),
  funcao text not null default '',
  texto text not null default '',
  por uuid default auth.uid(),
  por_nome text not null default '',
  em timestamptz not null default now(),
  primary key (data, culto, item)
);
alter table public.checklist_marcas enable row level security;
grant select, insert, delete on public.checklist_marcas to authenticated;
revoke all on public.checklist_marcas from anon;

-- Nome escrito na escala é esta pessoa? (apelido igual, nome completo igual, ou nome e sobrenome contidos no nome completo)
create or replace function public.midia_nome_bate(escrito text, apelido text, nome text) returns boolean
language sql immutable set search_path = public as $$
  select norm_nome(escrito) <> '' and (
       (norm_nome(apelido) <> '' and norm_nome(escrito) = norm_nome(apelido))
    or norm_nome(escrito) = norm_nome(nome)
    or nome_bate(escrito, apelido, nome))
$$;

-- A pessoa logada está escalada na Mídia neste culto, nesta função?
create or replace function public.midia_escalado(p_data text, p_culto text, p_funcao text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pessoas p
      join escalas e on e.area = 'midia' and e.data = p_data and e.culto = p_culto
      cross join lateral jsonb_array_elements(case when jsonb_typeof(e.d->'funcoes') = 'array' then e.d->'funcoes' else '[]' end) f
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f->'pessoas') = 'array' then f->'pessoas' else '[]' end) n
     where p.id = auth.uid() and p.status = 'aprovado' and not p.banco and (p.midia or p.papel = 'admin')
       and norm_nome(f->>'nome') = norm_nome(p_funcao)
       and midia_nome_bate(n, p.apelido, p.nome))
$$;
grant execute on function public.midia_escalado(text, text, text) to authenticated;

create or replace function public.checklist_marca_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare i checklist_itens;
begin
  select * into i from checklist_itens where id = new.item;
  new.funcao := coalesce(i.funcao, ''); new.texto := coalesce(i.texto, '');
  new.por := auth.uid(); new.por_nome := notif_nome(auth.uid()); new.em := now();
  return new;
end $$;
revoke execute on function public.checklist_marca_guarda() from public, anon, authenticated;
drop trigger if exists checklist_marca_guarda on public.checklist_marcas;
create trigger checklist_marca_guarda before insert on public.checklist_marcas
  for each row execute function public.checklist_marca_guarda();

-- Histórico: quem marcou / desmarcou e quando.
create or replace function public.checklist_marca_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r checklist_marcas;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into historico (acao, tipo, resumo, por, por_nome)
  values (case when tg_op = 'DELETE' then 'excluiu' else 'criou' end, 'checklist',
    'Checklist da Mídia '||to_char(r.data::date, 'DD/MM')||' · '||r.culto||' · '||r.funcao||': '
      ||case when tg_op = 'DELETE' then 'desmarcou' else 'marcou' end||' "'||r.texto||'"'
      ||case when tg_op = 'DELETE' and r.por is distinct from auth.uid() then ' (marcado por '||r.por_nome||')' else '' end,
    auth.uid(), notif_nome(auth.uid()));
  return null;
end $$;
revoke execute on function public.checklist_marca_log() from public, anon, authenticated;
drop trigger if exists checklist_marca_log on public.checklist_marcas;
create trigger checklist_marca_log after insert or delete on public.checklist_marcas
  for each row execute function public.checklist_marca_log();

drop policy if exists ckl_marcas_ler on public.checklist_marcas;
create policy ckl_marcas_ler on public.checklist_marcas for select to authenticated using (public.tem_midia());
drop policy if exists ckl_marcas_marcar on public.checklist_marcas;
create policy ckl_marcas_marcar on public.checklist_marcas for insert to authenticated
  with check (is_admin() or (public.tem_midia() and data = public.hoje_sp()
    and public.midia_escalado(data, culto, (select i.funcao from checklist_itens i where i.id = item and i.ativo))));
drop policy if exists ckl_marcas_desmarcar on public.checklist_marcas;
create policy ckl_marcas_desmarcar on public.checklist_marcas for delete to authenticated
  using (is_admin()); -- 08/11: desmarcar é só do administrador
drop policy if exists status_banco_inserir on public.checklist_marcas;
create policy status_banco_inserir on public.checklist_marcas as restrictive for insert to authenticated with check (public.sessao_pode_escrever());
drop policy if exists status_banco_apagar on public.checklist_marcas;
create policy status_banco_apagar on public.checklist_marcas as restrictive for delete to authenticated using (public.sessao_pode_escrever());

-- Tempo real (marcações aparecem em todos os aparelhos).
do $$ begin
  begin alter publication supabase_realtime add table public.checklist_marcas; exception when others then null; end;
  begin alter publication supabase_realtime add table public.checklist_itens; exception when others then null; end;
end $$;

-- ---------- Conversão das escalas de Mídia já cadastradas (mantém todos os nomes) ----------
update public.escalas set d = d where area = 'midia';
