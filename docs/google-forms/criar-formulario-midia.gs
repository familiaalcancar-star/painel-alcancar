/**
 * Cria no Google Forms o "Formulário da Mídia — Família Alcançar" (mesmas perguntas do formulário do painel)
 * e uma planilha do Google ligada a ele, onde caem as respostas.
 *
 * Como usar (uma vez só):
 *  1. Entre na conta Google da igreja e abra https://script.google.com → "Novo projeto".
 *  2. Apague o que estiver escrito, cole este arquivo inteiro e toque em Salvar (ícone de disquete).
 *  3. No topo, escolha a função "criarFormularioMidia" e toque em "Executar".
 *  4. Autorize o acesso quando o Google pedir (é a sua própria conta criando o formulário).
 *  5. Abra "Registro de execução": aparecem o link para EDITAR, o link para RESPONDER (o que vai no WhatsApp)
 *     e o link da planilha de respostas.
 *
 * Limites do Google Forms (o formulário do painel não tem esses limites):
 *  - Não dá para calcular a idade pela data de nascimento. Por isso há a pergunta "Você tem 14 anos ou mais?":
 *    quem responde "Não" vai para uma tela com o aviso e não vê o resto do formulário.
 *  - "Uma resposta por e-mail" só funciona se a pessoa entrar com uma conta Google (opção ligada abaixo). Quem
 *    reenviar EDITA a resposta anterior (o Google guarda o horário da última edição na planilha).
 *  - Não há limite contra envios em massa nem como esconder as respostas de quem é editor do formulário:
 *    só compartilhe o formulário e a planilha com os administradores.
 */
function criarFormularioMidia() {
  const NIVEIS = ['Nenhum', 'Básico', 'Intermediário', 'Avançado'];
  const CONHECIMENTOS = ['Holyrics', 'ATEM', 'YouTube Studio', 'OBS', 'Windows', 'iOS', 'Câmera', 'Canva', 'CapCut',
    'Formulários (Google Forms)', 'Criação/Edição de vídeos', 'Criação/Edição de fotos'];
  const CONEXOES = ['Betel', 'Flechas', 'Forasteiros', 'Heróis', 'Propósito', 'Shalom', 'The Chosen'];
  const MINISTERIOS = ['Coro', 'Louvor', 'Organização', 'Gravação', 'Som', 'Iluminação'];

  const form = FormApp.create('Formulário da Mídia — Família Alcançar');
  form.setDescription('Perfil de quem serve ou quer servir na Mídia da Família Alcançar. Todas as perguntas são obrigatórias.')
    .setCollectEmail(true)                 // e-mail obrigatório e verificado pelo Google
    .setLimitOneResponsePerUser(true)      // uma resposta por pessoa (exige entrar com conta Google)
    .setAllowResponseEdits(true)           // reenviar = editar a resposta anterior
    .setProgressBar(true)
    .setConfirmationMessage('Recebemos suas informações! Obrigado por querer servir na Mídia da Família Alcançar. 🙏');

  // ---------- Etapa 1 – Dados pessoais ----------
  form.addSectionHeaderItem().setTitle('Etapa 1 – Dados pessoais');
  form.addTextItem().setTitle('Nome completo').setRequired(true);
  form.addDateItem().setTitle('Data de nascimento').setRequired(true);
  form.addTextItem().setTitle('WhatsApp com DDD').setHelpText('Ex.: (11) 99999-9999').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^\\D*(\\d\\D*){10,13}$')
      .setHelpText('Informe o WhatsApp com DDD (mínimo 10 números).').build());
  const idade = form.addMultipleChoiceItem().setTitle('Você tem 14 anos ou mais?').setRequired(true);

  // ---------- Etapa 2 – Conhecimentos ----------
  const p2 = form.addPageBreakItem().setTitle('Etapa 2 – Conhecimentos')
    .setHelpText('Para cada item, escolha o seu nível.');
  form.addGridItem().setTitle('Conhecimentos').setRows(CONHECIMENTOS).setColumns(NIVEIS).setRequired(true);

  // ---------- Etapa 3 – Serviço na Mídia ----------
  form.addPageBreakItem().setTitle('Etapa 3 – Serviço na Mídia');
  form.addCheckboxItem().setTitle('Em quais funções gostaria de servir?').setHelpText('Pode marcar mais de uma.')
    .setChoiceValues(['Projeção', 'Transmissão', 'Câmera', 'Apoio']).setRequired(true);
  form.addCheckboxItem().setTitle('Disponibilidade para servir').setHelpText('Pode marcar mais de uma.')
    .setChoiceValues(['Domingo manhã', 'Domingo noite']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Tem iPhone?').setChoiceValues(['Sim', 'Não']).setRequired(true);

  // ---------- Etapa 4 – Conexão e ministérios ----------
  form.addPageBreakItem().setTitle('Etapa 4 – Conexão e ministérios');
  form.addMultipleChoiceItem().setTitle('Conexão que faz parte').setChoiceValues(CONEXOES).setRequired(true);
  const outro = form.addMultipleChoiceItem().setTitle('Serve em algum outro ministério?').setRequired(true);

  // ---------- Etapa 4B – Outros ministérios (só se respondeu Sim) ----------
  const p4b = form.addPageBreakItem().setTitle('Outros ministérios');
  form.addCheckboxItem().setTitle('Marque em quais ministérios você faz parte').setHelpText('Pelo menos um.')
    .setChoiceValues(MINISTERIOS).setRequired(true);

  // ---------- Autorização (antes de enviar) ----------
  const pAut = form.addPageBreakItem().setTitle('Antes de enviar');
  form.addCheckboxItem().setTitle('Autorização')
    .setChoiceValues(['Autorizo a Família Alcançar a guardar estes dados para organização da equipe de Mídia.']).setRequired(true);

  // ---------- Tela para quem tem menos de 14 anos ----------
  const pMenor = form.addPageBreakItem().setTitle('Não é possível continuar')
    .setHelpText('É preciso ter 14 anos ou mais para preencher este formulário.')
    .setGoToPage(FormApp.PageNavigationType.SUBMIT); // quem chega na autorização envia; não cai nesta tela

  // Caminhos: idade "Não" → aviso; outro ministério "Sim" → 4B, "Não" → autorização.
  idade.setChoices([idade.createChoice('Sim', FormApp.PageNavigationType.CONTINUE), idade.createChoice('Não', pMenor)]);
  outro.setChoices([outro.createChoice('Sim', p4b), outro.createChoice('Não', pAut)]);

  // Planilha de respostas.
  const ss = SpreadsheetApp.create('Formulário da Mídia — respostas');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('Editar o formulário: ' + form.getEditUrl());
  Logger.log('Link para responder (mandar no WhatsApp): ' + form.getPublishedUrl());
  Logger.log('Planilha de respostas: ' + ss.getUrl());
}
