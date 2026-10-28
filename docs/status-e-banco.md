# Status e Banco — regras atuais (28/10/2026)

- Status da pessoa (Ajustes → Pessoas e permissões) não é uma lista: aparece como etiqueta.
  - **Pendente** até o administrador tocar em **Aprovar** na pessoa e depois em **Salvar pessoas**.
  - Salvar sem tocar em Aprovar mantém Pendente.
- **Remover** exclui a pessoa (pessoas, cadastros, acessos). Se ela entrar de novo, faz cadastro novo.
  O histórico do que ela fez continua.
- **Aprovação automática** de Bethany, Raquel e Sheila (lista do painel antigo em `pessoas_referencia`, pelo WhatsApp)
  religada a pedido do Augusto: entram com status Aprovado e os mesmos acessos de antes. Lucas (admin, sem WhatsApp) não.
- **Banco** é um extra restritivo: só visualizar, sem escrever, importar ou exportar, mesmo com outros extras.
  RLS bloqueia escritas de Banco e de quem não está Aprovado.
- Testes: `node teste/testar-site.js` e `node teste/testar-status-banco.js`.
