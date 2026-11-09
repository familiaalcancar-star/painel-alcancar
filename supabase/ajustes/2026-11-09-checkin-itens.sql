-- Check-in: retirada e devolução de equipamentos item por item (09/11/2026).
-- checkin_marcas.itens = [{nome, ret, dev}] (quantidade retirada e devolvida); ret/dev (booleanos) continuam como resumo.
-- checkin_itens = lista de itens com estoque (vazio = sem limite). Ler: quem acessa o check-in;
-- incluir item novo: admin ou Gestão; editar estoque: admin. Itens padrão por função ficam em config.geral.d.checkinPadrao.

alter table public.checkin_marcas add column if not exists itens jsonb not null default '[]'::jsonb;

-- Quem acessa a aba Check-in (mesma regra das políticas de checkin_marcas): admin/Gestão, Organização,
-- ou escalado no Staff (Check-in / Gestão de culto) em algum culto de hoje até daqui a 6 dias.
create or replace function public.acessa_checkin() returns boolean
language sql stable security definer set search_path = public as $$
  select tem_gestao() or eh_organizacao() or exists (
    select 1 from generate_series(0, 6) g
     where checkin_escalado(to_char((now() at time zone 'America/Sao_Paulo')::date + g, 'YYYY-MM-DD')))
$$;
grant execute on function public.acessa_checkin() to authenticated;

create table if not exists public.checkin_itens (
  nome text primary key check (char_length(trim(nome)) between 1 and 60),
  estoque int check (estoque is null or estoque >= 0),
  ativo boolean not null default true,
  ordem int not null default 100,
  criado_em timestamptz not null default now()
);
alter table public.checkin_itens enable row level security;
grant select, insert, update on public.checkin_itens to authenticated;
revoke all on public.checkin_itens from anon;
drop policy if exists cki_ler on public.checkin_itens;
create policy cki_ler on public.checkin_itens for select to authenticated using (public.acessa_checkin());
drop policy if exists cki_incluir on public.checkin_itens;
create policy cki_incluir on public.checkin_itens for insert to authenticated with check (public.tem_gestao());
drop policy if exists cki_editar on public.checkin_itens;
create policy cki_editar on public.checkin_itens for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists status_banco_inserir on public.checkin_itens;
create policy status_banco_inserir on public.checkin_itens as restrictive for insert to authenticated with check (public.sessao_pode_escrever());
drop policy if exists status_banco_editar on public.checkin_itens;
create policy status_banco_editar on public.checkin_itens as restrictive for update to authenticated using (public.sessao_pode_escrever()) with check (public.sessao_pode_escrever());

insert into public.checkin_itens (nome, estoque, ordem) values
  ('Crachá', null, 10), ('Colete', null, 20), ('Rádio', 6, 30), ('Bastão de luz', null, 40), ('Guarda-chuva', null, 50)
on conflict (nome) do nothing;

update public.config set d = d || '{"checkinPadrao":[{"area":"*","funcao":"*","itens":["Crachá"]},{"area":"direcao","funcao":"Estacionamento","itens":["Crachá","Colete"]}]}'::jsonb
 where id = 'geral' and not (d ? 'checkinPadrao');

do $$ begin
  begin alter publication supabase_realtime add table public.checkin_itens; exception when others then null; end;
end $$;
