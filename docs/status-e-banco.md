# Status e Banco (27/10/2026) — substitui o fluxo de aprovação anterior

- A tabela Pessoas e permissões inclui Status: Pendente, Aprovado, Removido. Escolher função/conexão não aprova automaticamente: selecionar Aprovado e Salvar pessoas.
- Quem já estava em pessoas continua aprovado. Novas linhas têm status pendente por padrão. A aprovação automática pela lista antiga de WhatsApp foi desativada.
- Remover preserva cadastro, identidade e histórico, marca Removido e revoga permissões. Um administrador pode reativar selecionando Aprovado. Cadastros apagados antes desta mudança não são reconstruídos.
- Banco é um extra restritivo que prevalece sobre papel e demais extras: apenas consulta, sem escrever, importar ou exportar pelo painel. Chat aprovado continua visível, sem envio/exclusão. O conteúdo público continua público.
- RLS bloqueia escritas de Banco, Pendente e Removido; os controles de exportação são bloqueados na interface. Não é proteção contra captura de tela ou cópia de conteúdo já visível.
- Testes com dados inventados: node teste/testar-status-banco.js (Playwright) e node teste/testar-status-banco-db.js (@electric-sql/pglite 0.3.14).
