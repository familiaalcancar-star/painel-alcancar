-- Função "Voluntário" (10/11/2026): só consulta, como Membro; aprovado vê quem serve em cada atividade
-- e entra na lista de pessoas para escolher ao montar a escala.
alter table public.pessoas drop constraint if exists pessoas_papel_check;
alter table public.pessoas add constraint pessoas_papel_check
  check (papel in ('admin','lider','auxiliar','organizacao','leitura','midia','louvor','coro','voluntario'));
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check
  check (papel in ('admin','lider','auxiliar','organizacao','leitura','midia','louvor','coro','voluntario'));
alter table public.cadastros drop constraint if exists cadastros_papel_check;
alter table public.cadastros add constraint cadastros_papel_check
  check (papel in ('lider','auxiliar','organizacao','leitura','midia','louvor','coro','voluntario'));
