# Status e Banco (27/10/2026) — substitui o fluxo de aprovação anterior

- A tabela Pessoas e permissões mostra o Status (Pendente, Aprovado, Removido) sem lista de seleção (28/10/2026). Para aprovar: botão Confirmar na pessoa + Salvar pessoas. Sem Confirmar, continua Pendente. Removido tem o botão Reativar.
- Quem já estava em pessoas continua aprovado. Novas linhas têm status pendente por padrão. A aprovação automática pela lista antiga de WhatsApp foi desativada.
- Remover preserva cadastro, identidade e histórico, marca Removido e revoga permissões. Um administrador pode reativar selecionando Aprovado. Cadastros apagados antes desta mudança não são reconstruídos.
- Banco é um extra restritivo que prevalece sobre papel e demais extras: apenas consulta, sem escrever, importar ou exportar pelo painel. Chat aprovado continua visível, sem envio/exclusão. O conteúdo público continua público.
- RLS bloqueia escritas de Banco, Pendente e Removido; os controles de exportação são bloqueados na interface. Não é proteção contra captura de tela ou cópia de conteúdo já visível.
- Testes com dados inventados: node teste/testar-status-banco.js (Playwright) e node teste/testar-status-banco-db.js (@electric-sql/pglite 0.3.14).
