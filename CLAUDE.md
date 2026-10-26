# Dashboard 2.0 — Painel da Igreja Família Alcançar (Atibaia/SP)

Este arquivo descreve o painel que já está em uso (feito como artifact do Claude) para que ele seja **reconstruído fora do Claude**, em contas da igreja, sem custo mensal. A regra principal: **manter a mesma estrutura, o mesmo visual e as mesmas permissões** do painel atual. Na dúvida, o comportamento de `referencia-painel-atual.html` é a referência.

Idioma de tudo (interface, mensagens, commits): **português do Brasil**. O usuário (Augusto) não é programador: explique cada passo manual de forma simples, um por vez, e confirme antes de qualquer ação irreversível.

## Conteúdo desta pasta

- `CLAUDE.md` — este documento.
- `referencia-painel-atual.html` — código completo do painel atual (HTML + CSS + JS num arquivo). Usa `window.claude.use('db' | 'user' | 'downloads')`, que **não existe fora do Claude**: é exatamente essa camada que deve ser trocada pelo Supabase. Contém a logo embutida em base64 (extrair para `/public`).
- `referencia-escala-publica.html` — versão só de visualização (sem login) usada hoje como link público.
- `dados-exportados/` — dados reais para importar:
  - `config.json` — configuração (conexões, cultos, áreas e funções, pessoas e permissões, redes, endereço).
  - `escalas.json` — 131 registros de escala (out/2026 a jan/2027).
  - `avisos.json`, `eventos.json` — com o campo `img` apontando para `imagens/`.
  - `cadastros-pendentes.json` — pedidos de cadastro ainda não aprovados.
  - `imagens/` — banners dos avisos/eventos e prévias das redes (WebP).

**Privacidade:** `config.json` e `cadastros-pendentes.json` têm nomes e WhatsApp de pessoas. **Nunca** commitar `dados-exportados/` no GitHub (colocar no `.gitignore`); usar só para o script de importação local. O repositório deve ser **privado**.

## Stack e contas

- **Front-end:** site estático (Vite + JS ou React; escolha o mais simples de manter). Mobile-first: quase todo uso é pelo celular.
- **Supabase (plano grátis):** Auth (login por e-mail com link mágico ou código), Postgres com **Row Level Security** para todas as permissões, Storage para imagens.
- **Hospedagem:** **Netlify ou Cloudflare Pages** (planos grátis permitem uso por organização). Evitar Vercel Hobby (termos de uso pessoal/não comercial).
- **Contas no nome da igreja:** criadas com um e-mail da igreja; Augusto e o pastor entram como membros.
- **Domínio:** subdomínio de `comunidadealcancar.com.br` (ex.: `escala.comunidadealcancar.com.br`) via registro CNAME.
- Cuidados do grátis: projeto Supabase pausa após ~7 dias sem acesso (reativar com 1 clique); envio de e-mails de login tem limite por hora — considerar SMTP grátis (ex.: Resend), que também serve para o aviso de novo cadastro.

## Um site só, duas camadas

1. **Público (sem login):** abas Início, Escala, Avisos, Agenda. Sempre atualizado (lê os mesmos dados). Nada de edição, exportação de check-in, Histórico ou Ajustes. Não expor WhatsApp nem dados de pessoas.
2. **Com login:** botão **"Entrar"** no topo. Depois do login, a pessoa vê o que a função permite (abaixo).

Isso substitui os dois sites atuais e elimina o limite de 50 convites por e-mail.

## Identidade visual

- Fundo **preto fixo** (mesmo com o celular em modo claro). Texto claro.
- Cores da logo: azul `#1E88E5`, amarelo `#FFC61A`, verde `#3DAA35`, laranja `#F47216`.
- **Culto da manhã = amarelo; culto da noite = azul.** Botões principais verdes; aba ativa destacada.
- Fontes: Bricolage Grotesque (títulos) e Figtree (texto), do Google Fonts.
- Logo Família Alcançar no topo (está em base64 no HTML de referência).
- Barra de abas fixa no rodapé (mobile), com ícone + rótulo.

## Configuração (vem de `config.json`)

- **Conexões** (ordem alfabética automática): Betel, Flechas, Forasteiros, Heróis, Propósito, Shalom, The Chosen.
- **Cultos:** Manhã 9h30 (`manha`), Noite 18h30 (`noite`). Dia de culto: domingo (gerados automaticamente). Admin pode criar culto extra.
- **Áreas, na ordem de exibição** (Louvor sempre por último):
  1. **Direção do culto** — por conexão (aceita mais de uma conexão no mesmo culto): Estacionamento (3), Recepção (4), Envelopes e lembrancinhas (1), Café (1).
  2. **Super Kids** — por conexão: 14 tarefas da programação do Ministério Infantil, 1 responsável cada.
  3. **Mídia** — 4 vagas.
  4. **Staff** — Check-in, Checagem, Gestão de culto (1 cada).
  5. **Ministração** — Quem vai ministrar (1).
  6. **Louvor** — Ministros (2), Contrabaixo, Violão, Guitarra, Teclado, Bateria (1 cada), 1º Soprano, 2º Soprano, Contralto, Tenor, Baixo (voz) — vozes sem limite.
- **Igreja:** Av. Pref. Antônio Júlio Toledo Garcia Lopes, nº 1480, Jardim Cerejeiras, Atibaia/SP (Antiga Avenida Copacabana). Chamada "VEM E VÊ!". Botão "Como chegar" (Google Maps).
- **Redes:** Instagram https://www.instagram.com/alcancar.atibaia · YouTube https://www.youtube.com/@comunidadealcancar · Site https://www.comunidadealcancar.com.br/#programacao
- **WhatsApp do administrador principal (Augusto) para avisos de cadastro:** 5511958800779 (guardar em configuração, editável).

## Permissões (implementar com RLS no banco, não só na tela)

**Funções** (uma por pessoa):
- **Administrador** — tudo: todas as áreas e datas, cultos extras, Ajustes, Histórico, aprovar/remover pessoas, check-in. Ideal até ~5 (avisar se passar).
- **Líder**, **Auxiliar** e **Organização** — **acessos iguais entre si**:
  - Preenchem **Direção do culto** e **Super Kids** **apenas nos cultos em que a própria conexão está escalada**.
  - Ao editar, **data, culto e área ficam travados** (mostrados num quadro fixo); só editam os nomes de cada função e a observação.
  - Se a conexão for **Flechas, Forasteiros ou Heróis**, também podem editar a escala de **Louvor** (qualquer domingo).
  - Não podem trocar a própria conexão depois do cadastro.
- **Só consulta** — vê tudo, não edita.

**Extras** (caixinhas independentes, valem junto com qualquer função, só admin marca):
- **Gestão** — vê a aba **Check-in** e pode imprimir/exportar check-in (PDF/Excel, do culto, do dia, do mês, personalizado).
- **Ministro** — pode editar a escala de **Louvor** em qualquer domingo.
- **Avisos/Eventos** — pode criar avisos e eventos; edita/exclui **os próprios**. Admin edita/exclui todos.

**Só administradores** veem as abas **Ajustes** e **Histórico**. Só administradores alteram funções, extras e quem é administrador.

## Cadastro e aprovação

1. A pessoa entra (login por e-mail) e preenche: nome completo, apelido ("Me chamar:"), WhatsApp com DDD, conexão e função (Líder, Auxiliar ou Organização — **Administrador não aparece no formulário**).
2. Depois de enviar, aparece o botão verde **"Avisar o administrador pelo WhatsApp"** (wa.me para o número do admin, mensagem pronta com nome, função e conexão). Fica visível enquanto o cadastro estiver pendente.
3. Admins veem, na Início, um aviso amarelo "🔔 N cadastros aguardando aprovação · Revisar ›" e uma bolinha vermelha com o número na aba Ajustes. Novo cadastro tem etiqueta "novo".
4. Em **Ajustes → Pessoas e permissões**: tabela com Pessoa (+ link do WhatsApp), Pediu, Função (select), Conexão (select), Extras (Gestão / Ministro / Avisos/Eventos), botão **Remover** e "Salvar pessoas".
5. **Remover** apaga função, permissão, conexão, nome, apelido, WhatsApp e o pedido; a pessoa volta a "só consulta" e precisa se cadastrar de novo. Confirmação em caixa própria da página (não usar `confirm()` do navegador). O Histórico do que ela fez continua.
6. Melhoria possível agora: e-mail automático para os admins a cada novo cadastro (Edge Function + SMTP).

**Migração de pessoas:** os ids atuais (`u_...`) são do Claude e não servem no Supabase. Importar `config.json → pessoas` como lista de referência; quando cada pessoa fizer o primeiro login, o admin associa/aprova (pode haver sugestão automática por nome). O dono (Augusto) entra como Administrador desde o início.

## Abas

### Início
Ordem: (aviso de cadastros pendentes, só admin) → **próximo domingo em destaque** (manhã e noite no mesmo card, separados por linha, com cada área e sua conexão/equipe; tocar abre o detalhe) → "**Em seguida**" (domingo seguinte) → botões **Check-in do dia** (só Gestão/Admin) e **Planilha do dia** → **Agenda** (lista compacta: data dd/mm + dia da semana, nome, horário, seta ›; todos os eventos daqui para frente) → **Avisos** (mesma lista compacta, data de publicação, sem horário) → **Para você** (avisos fixos com prévia e botão grande: Pasta de Expectativas e Cadastro de Membros) → **Redes sociais** (cards com prévia do Instagram e YouTube + card "🌐 Site da igreja") → **Sobre nós** (Missão e Visão) → **Onde estamos**.
Tocar numa linha da Agenda/Avisos abre a aba certa, rola até o card e destaca com borda amarela por ~2 s.

Missão: "Fazer com excelência as coisas concernentes ao reino de Deus, lutando pela unidade e buscando o seu crescimento. Trazendo a todas as pessoas que quiserem, a solução para as suas necessidades mediante o conhecimento da Palavra de Deus."
Visão: "Ser uma igreja que alcança, ama, discipula, treina e envia. Que leva o Evangelho para o homem todo. Que luta contra o pecado e a cultura anticristã. Uma igreja que ensina a amar e conhecer o Deus da Bíblia."

### Escala
Navegação por mês e filtro por conexão (chips). Tabela: linhas = cultos (data + manhã/noite, cor), colunas = áreas na ordem acima (+ colunas "Check-in PDF" e "Check-in Excel" só para Gestão/Admin). Célula mostra conexão(ões) ou "Ver equipe (n)". Tocar abre o detalhe da área (funções e nomes, "vaga aberta" quando vazio) com botão de editar para quem pode. Rodapé "Exportar": Planilha do mês, Check-in do mês (Gestão/Admin), e exportação personalizada (De/Até + "Planilha da escala" ou "Check-in com assinaturas", em Excel ou PDF; respeita o filtro de conexão). Observações especiais por culto (ex.: "Tweens & Cia", "Cantata de Natal", "CNI").

### Avisos e Agenda
Cards com banner 16:9 (object-fit cover), título, etiqueta (conexão, "Geral" ou "Fixo"), texto com "Ler mais" (4 linhas), botões de link (inscrição, compra) e de WhatsApp. Evento: bloco de data, hora, local, contatos. Avisos com `fixoFim` (1, 2…) ficam **sempre no fim** da lista, nessa ordem, e não entram na lista de Avisos da Início (vão para "Para você"). Botão "+ Novo aviso"/"+ Novo evento" só para Admin e extra Avisos/Eventos. Formulário com upload de imagem (Storage).

### Check-in (só Gestão e Admin)
Seleção de **data** (abre no próximo domingo) e **culto** (chips Manhã/Noite). Lista só das pessoas **com nome preenchido** na escala, agrupadas por área (mesma ordem; **Louvor fora**), com conexão ao lado da área. Em cada linha: nome (destaque), função (menor) e **três caixas grandes**: **Check-in**, **Retirou** (equipamento/crachá), **Devolveu**. Nome fica verde quando fez check-in. Resumo no topo ("5/11 check-in · 3 retiraram · 1 devolveu"). Salvo no banco e **em tempo real** entre aparelhos (Supabase Realtime). Botão "Baixar ficha em PDF". Tabela sugerida: `checkin_marcas(data, culto, chave, ci, ret, dev, nome, escalado, area, funcao, por, em)`.

### Histórico (só Admin)
Registro de quem criou/editou/excluiu (escalas, avisos, eventos, ajustes, pessoas), com data/hora e diferença antes→depois. Filtro por tipo.

### Ajustes (só Admin)
Nome da igreja, conexões (uma por linha), cultos ("Nome | horário"), dias de culto, links de Instagram/YouTube, postagens em destaque, lista de áreas/funções (somente leitura na tela), "Convidar pelo WhatsApp" (mensagem-modelo com passo a passo), "Pessoas e permissões".

### Ajuda
Botão "❓ Como usar" no topo; tutorial curto em passos, abre automaticamente na primeira visita de quem está logado.

## Ficha de check-in (PDF e Excel)

- A4 **paisagem**. Cabeçalho em todas as páginas: "Família Alcançar · Check-in" à esquerda, data por extenso à direita, linha fina; rodapé "Página x de y".
- **Check-in do dia:** um PDF com o **Culto da manhã** (faixa amarela com horário) e, logo abaixo, o **Culto da noite** (faixa azul); quebra de página automática.
- Por área, uma linha-título cinza: "DIREÇÃO DO CULTO · Conexões Betel e Shalom" (+ observação). Depois, uma linha por pessoa.
- Colunas: **Função · Nome (negrito) · Check-in · Assinatura — retirada (equipamento / crachá) · Assinatura — devolução (equipamento / crachá)**. Cabeçalho repetido em cada página.
- **Só quem tem nome preenchido** (sem linhas em branco); área sem ninguém não aparece. **Louvor nunca entra no check-in.**
- Excel com o mesmo layout (bordas, cabeçalho fixo, página em paisagem ajustada à largura).
- Fora do Claude, o download funciona com link normal (Blob + `<a download>`).

## Dados atuais e itens fixos

- Escala oficial 04/10–27/12/2026 (Louvor, Super Kids, Direção), Mídia de 04/10–27/12, Staff de nov/2026–jan/2027 (24/01/2027 marcado "CNI"), dia 25/10/2026 completo — tudo em `escalas.json` (campos: `data`, `culto`, `area`, `conexao`, `conexoes[]`, `funcoes[{nome, pessoas[]}]`, `obs`).
- Avisos fixos: **Pasta de Expectativas 2026** (botão "Abrir Pasta de Expectativas" → https://drive.google.com/file/d/1FRx4dQ1Ry5hMz_sHcCuyrbPDPIBbajAA/view?usp=drivesdk) e **Cadastro de Membros** (botão "Cadastrar-se" → https://forms.gle/ZAmQBc6hp4RkqmqU6).

## Próxima melhoria (depois da migração)

**Importar escala** (aba Escala, só Admin): ler arquivo **Excel ou PDF** feito por outro administrador, reconhecer datas, culto, área, nomes de conexões (tolerante a variações de escrita) e nomes de Mídia/Louvor, cruzar com os domingos existentes e mostrar **prévia** (preencher / substituir / não reconhecido) antes de "Confirmar importação"; registrar no Histórico. Aguardando arquivos de exemplo reais.

## Ordem sugerida de trabalho

1. Passo a passo das contas da igreja (e-mail, GitHub privado, Supabase, Netlify) — um por vez, esperando o Augusto confirmar.
2. Esquema do banco + políticas RLS + Storage; testar permissões com usuários de teste de cada função.
3. Front-end reaproveitando HTML/CSS do painel atual; trocar a camada de dados pelo Supabase; camada pública sem login.
4. Script de importação de `dados-exportados/` (escalas, avisos, eventos com imagens no Storage, config, pessoas como referência).
5. Deploy, subdomínio, teste no celular com 1 líder real; só então divulgar o link novo. O painel antigo continua no ar até a troca.
