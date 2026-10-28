-- Convites por e-mail (28/10/2026): o administrador deixa a pessoa pré-aprovada, com função,
-- conexão e extras. Quando ela faz o cadastro entrando com ESSE e-mail (o e-mail do login,
-- lido de auth.users, nunca o que vem do site), já fica Aprovada.
create table if not exists convites (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  nome text not null default '',
  papel text not null default 'lider' check (papel in ('admin','lider','auxiliar','organizacao','leitura')),
  conexao text,
  gestao boolean not null default false,
  ministro boolean not null default false,
  avisos boolean not null default false,
  escala boolean not null default false,
  banco boolean not null default false,
  criado_por uuid default auth.uid(),
  em timestamptz not null default now()
);
alter table convites enable row level security;
grant select, insert, update, delete on convites to authenticated;
revoke all on convites from anon;
drop policy if exists convites_admin on convites;
create policy convites_admin on convites for all to authenticated using (is_admin()) with check (is_admin());
-- Mesmas travas de Banco/Pendente das outras tabelas.
drop policy if exists status_banco_inserir on convites;
create policy status_banco_inserir on convites as restrictive for insert to authenticated with check (public.sessao_pode_escrever());
drop policy if exists status_banco_editar on convites;
create policy status_banco_editar on convites as restrictive for update to authenticated using (public.sessao_pode_escrever()) with check (public.sessao_pode_escrever());
drop policy if exists status_banco_apagar on convites;
create policy status_banco_apagar on convites as restrictive for delete to authenticated using (public.sessao_pode_escrever());

-- Aprovação automática no cadastro: 1º convite pelo e-mail do login; 2º lista do painel antigo pelo WhatsApp.
create or replace function cadastro_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare r pessoas_referencia; c convites; w text := right(regexp_replace(new.whatsapp, '\D', '', 'g'), 11);
  email_login text := (select lower(trim(u.email)) from auth.users u where u.id = new.id);
begin
  if exists (select 1 from pessoas where id = new.id) then return new; end if;
  select * into c from convites cv where cv.email = email_login;
  if found then
    insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala, banco, status)
    values (new.id, email_login, new.nome, coalesce(new.apelido,''), new.whatsapp, coalesce(c.conexao, new.conexao), c.papel,
            c.gestao, c.ministro, c.avisos, c.escala, c.banco, 'aprovado');
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
create or replace trigger cadastro_auto after insert on cadastros for each row execute function cadastro_auto();
revoke execute on function cadastro_auto() from public, anon, authenticated;
