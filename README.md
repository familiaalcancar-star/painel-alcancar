# Painel Família Alcançar

Escalas, avisos, agenda e check-in da igreja. Site estático + Supabase (grátis).

- `CLAUDE.md` — descrição completa do painel (o que ele faz e as permissões).
- `referencia/` — painel atual (feito no Claude), usado como modelo.
- `public/` — arquivos públicos (logo).
- `supabase/schema.sql` — banco de dados e permissões. Rodar no SQL Editor do Supabase.
- `supabase/testes/` — testes automáticos das permissões.
- `docs/passo-a-passo.md` — o que o Augusto faz em cada etapa.
- `dados-exportados/` — dados reais para importar (fica só no computador, fora do GitHub).

## Andamento

- [x] Logo extraída, dados exportados separados (131 escalas, 6 avisos, 4 eventos, 12 imagens)
- [x] Banco + permissões (RLS) + Storage — 54 testes passando
- [ ] Contas da igreja (e-mail, GitHub, Supabase, Netlify)
- [ ] Site (front-end) ligado ao Supabase
- [ ] Importação dos dados
- [ ] Publicação no subdomínio e teste com um líder
