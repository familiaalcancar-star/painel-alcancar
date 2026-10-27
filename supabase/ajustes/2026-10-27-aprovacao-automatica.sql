-- Aprovação automática de quem já estava aprovado no painel antigo (feito no Claude).
-- A lista antiga fica em pessoas_referencia (só admin lê; os dados NÃO vão para o GitHub).
-- Quando alguém envia o cadastro com o MESMO WhatsApp (últimos 11 dígitos) de uma pessoa
-- da lista, ela vira "pessoa" na hora, com a função, a conexão e os extras de antes.
-- Administradores nunca são aprovados automaticamente.
create or replace function cadastro_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare r pessoas_referencia; w text := right(regexp_replace(new.whatsapp, '\D', '', 'g'), 11);
begin
  if length(w) < 10 or exists (select 1 from pessoas where id = new.id) then return new; end if;
  select * into r from pessoas_referencia
   where right(regexp_replace(coalesce(d->>'whatsapp',''), '\D', '', 'g'), 11) = w
     and coalesce(d->>'papel','') in ('lider','auxiliar','organizacao','leitura')
     and d->>'usado_por' is null
   limit 1;
  if not found then return new; end if;
  insert into pessoas (id, email, nome, apelido, whatsapp, conexao, papel, gestao, ministro, avisos, escala)
  values (new.id, new.email, new.nome, coalesce(nullif(new.apelido,''), r.d->>'apelido', ''), new.whatsapp,
          r.d->>'conexao', r.d->>'papel',
          coalesce((r.d->>'gestao')::boolean,false), coalesce((r.d->>'ministro')::boolean,false),
          coalesce((r.d->>'avisos')::boolean,false), coalesce((r.d->>'escala')::boolean,false));
  update pessoas_referencia set d = d || jsonb_build_object('usado_por', new.id) where id_antigo = r.id_antigo;
  insert into historico (acao, tipo, resumo, por, por_nome)
    values ('criou', 'config', 'Aprovado automaticamente (painel antigo): '||coalesce(nullif(new.apelido,''), split_part(trim(new.nome),' ',1)), new.id, 'Sistema');
  return new;
end $$;
drop trigger if exists cadastro_auto on cadastros;
create trigger cadastro_auto after insert on cadastros for each row execute function cadastro_auto();
revoke execute on function cadastro_auto() from public, anon, authenticated;
