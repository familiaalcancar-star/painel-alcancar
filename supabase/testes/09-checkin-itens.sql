-- Itens de retirada/devolução no check-in.
select ok('Itens iniciais com Rádio = 6 (+ iPhone e Microfone de lapela)', (select estoque from checkin_itens where nome='Rádio') = 6 and (select count(*) from checkin_itens) = 7 and exists (select 1 from checkin_itens where nome='Microfone de lapela'));
select t('Gestão lê os itens','c0','select 1 from checkin_itens union all select 1','ok');
select t('Organização lê os itens','f1','select 1 from checkin_itens union all select 1','ok');
select t('Líder sem escala NÃO lê os itens','a5','select * from checkin_itens','bloq');
select t('Gestão inclui item novo','c0',$q$insert into checkin_itens(nome) values ('Chave da sala')$q$,'ok');
select t('Organização NÃO inclui item na lista','f1',$q$insert into checkin_itens(nome) values ('Chave 2')$q$,'bloq');
select t('Gestão NÃO muda o estoque','c0',$q$update checkin_itens set estoque=10 where nome='Rádio'$q$,'bloq');
select t('Admin muda o estoque','0a',$q$update checkin_itens set estoque=8 where nome='Rádio'$q$,'ok');
select t('Gestão grava itens na marcação','c0',$q$insert into checkin_marcas(data,culto,chave,ci,itens) values ('2099-02-01','manha','i1',true,'[{"nome":"Rádio","ret":2,"dev":1}]')$q$,'ok');
