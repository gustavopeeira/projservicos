/**
 * Testes unitários das regras de escopo e autorização.
 * Usam somente fixtures fictícias em memória; não leem nem alteram a planilha.
 * Execute executarTestesPermissoes().
 */
function executarTestesPermissoes() {
  const aprovados = [], falhas = [];
  function testar(nome, fn) {
    try { fn(); aprovados.push(nome); }
    catch (e) { falhas.push({teste:nome, erro:String(e && e.message || e)}); }
  }
  function igual(a,b,msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || ('Esperado '+JSON.stringify(b)+'; recebido '+JSON.stringify(a)));
  }
  const agenda = [
    {ID:'A1',CLIENTE_ID:'C1'}, {ID:'A2',CLIENTE_ID:'C2'}, {ID:'A3',CLIENTE_ID:'C1'}
  ];
  const itens = [
    {AGENDAMENTO_ID:'A1',FUNCIONARIO_ID:'F1'},
    {AGENDAMENTO_ID:'A2',FUNCIONARIO_ID:'F2'},
    {AGENDAMENTO_ID:'A3',FUNCIONARIO_ID:'F2'}
  ];
  testar('Cliente vê somente seus agendamentos', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'CLIENTE',REFERENCIA_ID:'C1'}).map(x=>x.ID),['A1','A3']);
  });
  testar('Funcionário vê somente sua agenda', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'}).map(x=>x.ID),['A2','A3']);
  });
  testar('Administrador vê todas as agendas sem filtro', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'ADMINISTRADOR',REFERENCIA_ID:''}).map(x=>x.ID),['A1','A2','A3']);
  });
  testar('Administrador pode filtrar por funcionário', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'ADMINISTRADOR'},'F1').map(x=>x.ID),['A1']);
  });
  testar('Funcionário não vê clientes de outros profissionais', function() {
    igual(idsClientesVisiveisFuncionario_('F1',agenda,itens),['C1']);
  });
  testar('Administrador pode gerenciar qualquer agendamento', function() {
    if (!podeGerenciarAgendamento_('A2',itens,{PERFIL:'ADMINISTRADOR'})) throw new Error('Ação administrativa deveria ser permitida.');
  });
  testar('Funcionário só gerencia agendamento próprio', function() {
    if (!podeGerenciarAgendamento_('A2',itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'})) throw new Error('Ação própria deveria ser permitida.');
    if (podeGerenciarAgendamento_('A1',itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'})) throw new Error('Ação de outro profissional foi permitida.');
  });
  testar('Cliente não pode aprovar ou rejeitar agendamento', function() {
    if (podeGerenciarAgendamento_('A1',itens,{PERFIL:'CLIENTE',REFERENCIA_ID:'C1'})) throw new Error('Cliente recebeu permissão administrativa.');
  });
  testar('Perfil desconhecido não recebe agenda', function() {
    let bloqueou=false;
    try { filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'DESCONHECIDO'}); } catch(e) { bloqueou=true; }
    if (!bloqueou) throw new Error('Perfil desconhecido recebeu dados.');
  });
  const relatorio={ok:falhas.length===0,aprovados:aprovados.length,falhas:falhas.length,testesAprovados:aprovados,detalhesFalhas:falhas};
  Logger.log(JSON.stringify(relatorio,null,2));
  return relatorio;
}
