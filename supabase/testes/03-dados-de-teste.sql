insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','adm@x'),('00000000-0000-0000-0000-0000000000b1','betel@x'),
 ('00000000-0000-0000-0000-0000000000f1','flechas@x'),('00000000-0000-0000-0000-0000000000a5','aux.shalom@x'),
 ('00000000-0000-0000-0000-0000000000c0','gestao@x'),('00000000-0000-0000-0000-0000000000e0','ministro@x'),
 ('00000000-0000-0000-0000-0000000000d0','avisos@x'),('00000000-0000-0000-0000-0000000000d1','avisos2@x'),
 ('00000000-0000-0000-0000-000000000099','novo@x');
insert into pessoas(id,nome,papel,conexao,gestao,ministro,avisos,whatsapp) values
 ('00000000-0000-0000-0000-00000000000a','Adm','admin',null,false,false,false,'1'),
 ('00000000-0000-0000-0000-0000000000b1','Lider Betel','lider','betel',false,false,false,'2'),
 ('00000000-0000-0000-0000-0000000000f1','Org Flechas','organizacao','flechas',false,false,false,'3'),
 ('00000000-0000-0000-0000-0000000000a5','Aux Shalom','auxiliar','shalom',false,false,false,'4'),
 ('00000000-0000-0000-0000-0000000000c0','Gestor','leitura',null,true,false,false,'5'),
 ('00000000-0000-0000-0000-0000000000e0','Ministro','leitura',null,false,true,false,'6'),
 ('00000000-0000-0000-0000-0000000000d0','Avisador','leitura',null,false,false,true,'7'),
 ('00000000-0000-0000-0000-0000000000d1','Avisador2','leitura',null,false,false,true,'8');
insert into escalas(id,d) values
 ('2026-11-01_manha_direcao','{"data":"2026-11-01","culto":"manha","area":"direcao","conexoes":["betel","shalom"],"funcoes":[]}'),
 ('2026-11-01_noite_superkids','{"data":"2026-11-01","culto":"noite","area":"superkids","conexao":"flechas","funcoes":[]}'),
 ('2026-11-01_manha_midia','{"data":"2026-11-01","culto":"manha","area":"midia","funcoes":[]}'),
 ('2026-11-01_manha_louvor','{"data":"2026-11-01","culto":"manha","area":"louvor","funcoes":[]}');
insert into avisos(id,d,autor) values ('a1','{"titulo":"x"}','00000000-0000-0000-0000-0000000000d0');

create or replace function t(nome text, quem text, cmd text, espera text) returns text language plpgsql as $$
declare n int := 0; err text := null; r text;
begin
  begin
    if quem = 'anon' then perform set_config('role','anon',true); perform set_config('request.jwt.claim.sub','',true);
    else perform set_config('role','authenticated',true); perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000'||quem,true); end if;
    execute cmd; get diagnostics n = row_count;
    raise exception 'rollback_ok';
  exception when others then if sqlerrm <> 'rollback_ok' then err := sqlerrm; end if;
  end;
  r := case when err is null and n > 0 then 'ok' else 'bloq' end;
  return (case when r = espera then 'PASSOU ' else '>>> FALHOU ' end) || nome || ' [' || r || coalesce(' — '||err,'') || ']';
end $$;
