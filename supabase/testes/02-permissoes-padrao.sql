-- Supabase concede isto por padrão no schema public:
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
revoke all on pessoas_nomes from anon;
