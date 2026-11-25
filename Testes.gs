/**
 * Testes estruturais e de regras puras do ProjServiços.
 * Não cria, altera ou apaga dados de clientes/agendamentos.
 * Execute setupSistema() primeiro e depois executarTestesEstruturais().
 */
function executarTestesEstruturais() {
  const inicio = new Date();
  const aprovados = [];
  const falhas = [];
  function verificar(nome, fn) {
    try {
      const resultado = fn();
      if (resultado === false) throw new Error('Condição não atendida.');
      aprovados.push(nome);
    } catch (e) {
      falhas.push({ teste: nome, erro: String(e && e.message || e) });
    }
  }

  verificar('Planilha ativa', function () {
    if (!SpreadsheetApp.getActiveSpreadsheet()) throw new Error('Projeto não está vinculado a uma planilha.');
  });
  verificar('15 abas declaradas', function () {
    if (Object.keys(SHEET_SCHEMAS).length !== 15) throw new Error('Esperadas 15 abas; encontradas ' + Object.keys(SHEET_SCHEMAS).length + '.');
  });

  Object.keys(SHEET_SCHEMAS).forEach(function (nome) {
    verificar('Aba e cabeçalhos: ' + nome, function () {
      const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
      if (!aba) throw new Error('Aba ausente. Execute setupSistema().');
      const esperado = SHEET_SCHEMAS[nome];
      const atual = aba.getRange(1, 1, 1, esperado.length).getValues()[0].map(String);
      const divergencias = esperado.filter(function (coluna, i) { return atual[i] !== coluna; });
      if (divergencias.length) throw new Error('Cabeçalhos ausentes ou fora de ordem: ' + divergencias.join(', '));
    });
  });

  verificar('Configuração de antecedência mínima', function () {
    const v = Number(configValor_('ANTECEDENCIA_MINIMA_HORAS', NaN));
    if (!isFinite(v) || v < 0) throw new Error('Valor inválido.');
  });
  verificar('Configuração de antecedência máxima', function () {
    const v = Number(configValor_('ANTECEDENCIA_MAXIMA_DIAS', NaN));
    if (!isFinite(v) || v < 1) throw new Error('Valor inválido.');
  });
  verificar('Conversão de horário válida', function () {
    if (minutosHora_('09:30') !== 570 || minutosHora_('23:59') !== 1439) throw new Error('Conversão incorreta.');
  });
  verificar('Rejeição de horário inválido', function () {
    let rejeitou = false;
    try { minutosHora_('25:00'); } catch (e) { rejeitou = true; }
    if (!rejeitou) throw new Error('Um horário inválido foi aceito.');
  });
  verificar('Dia da semana (segunda-feira)', function () {
    const d = new Date(2026, 0, 5, 12, 0, 0);
    if (diaSemana_(d) !== 0) throw new Error('Segunda-feira deveria ser 0.');
  });
  verificar('Normalização de e-mail', function () {
    if (normalizarEmail_('  TESTE@EXEMPLO.COM ') !== 'teste@exemplo.com') throw new Error('Normalização incorreta.');
  });
  verificar('Rejeição de e-mail inválido', function () {
    let rejeitou = false;
    try { normalizarEmail_('email-invalido'); } catch (e) { rejeitou = true; }
    if (!rejeitou) throw new Error('E-mail inválido foi aceito.');
  });
  verificar('Políticas de recuperação configuradas', function () {\n    if (AUTH_CONFIG.RECOVERY_MAX_ATTEMPTS !== 5 || AUTH_CONFIG.RECOVERY_TTL_SECONDS !== 900 || AUTH_CONFIG.RECOVERY_REQUEST_WINDOW_SECONDS !== 60 || AUTH_CONFIG.RECOVERY_GLOBAL_LIMIT < 1) throw new Error('Limites de recuperação ausentes ou inválidos.');\n  });\n  verificar('Derivação de senha consistente', function () {
    const a = derivarSenha_('Senha-de-teste-123', 'salt-de-teste');
    const b = derivarSenha_('Senha-de-teste-123', 'salt-de-teste');
    const c = derivarSenha_('Senha-de-teste-123', 'outro-salt');
    if (a !== b || a === c || a.length < 20) throw new Error('Derivação inconsistente.');
  });

  const relatorio = {
    ok: falhas.length === 0,
    aprovados: aprovados.length,
    falhas: falhas.length,
    testesAprovados: aprovados,
    detalhesFalhas: falhas,
    executadoEm: Utilities.formatDate(inicio, APP_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
  };
  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}
