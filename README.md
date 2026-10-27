# Painel Família Alcançar

Escalas, avisos, agenda e check-in da igreja. Site estático + Supabase (grátis).

- `CLAUDE.md` — descrição completa do painel (o que ele faz e as permissões).
- `referencia/` — painel atual (feito no Claude), usado como modelo.
- `public/` — o site (abre direto no navegador, sem etapa de build): `index.html`, `app.js`, `estilo.css`, `config.js`, logo, banners e bibliotecas em `vendor/`.
- `netlify.toml` — diz ao Netlify para publicar a pasta `public/`.
- `teste/` — teste das telas no navegador com o banco simulado: `node teste/testar-site.js`.
- `supabase/schema.sql` — banco de dados e permissões. Rodar no SQL Editor do Supabase.
- `supabase/testes/` — testes automáticos das permissões.
- `docs/passo-a-passo.md` — o que o Augusto faz em cada etapa.
- `dados-exportados/` — dados reais para importar (fica só no computador, fora do GitHub).

## Andamento

- [x] Logo extraída, dados exportados separados (131 escalas, 6 avisos, 4 eventos, 12 imagens)
- [x] Banco + permissões (RLS) + Storage — 54 testes passando
- [x] GitHub da igreja (privado) e Supabase (projeto znuxdxwnunagvkjekmgc, São Paulo)
- [x] Dados importados no Supabase (conferidos: idênticos ao original)
- [ ] Netlify
- [x] Site (front-end) ligado ao Supabase — 62 conferências de tela passando

- [ ] Publicação no subdomínio e teste com um líder

## Importante: quem assina as alterações

O Netlify grátis só publica, de um repositório privado, alterações assinadas pela conta da igreja no GitHub.
Este repositório já está configurado para assinar como `familiaalcancar-star`
(e-mail `348324950+familiaalcancar-star@users.noreply.github.com`). Alterações assinadas por outra
pessoa aparecem no Netlify como "Unrecognized Git contributor" e não são publicadas.
