/** Dados e ações dos painéis, sempre filtrados pelo perfil autenticado. */
function obterDadosPainel(token) {
  const u = usuarioDaSessao_(token);
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 31);
  let ag = records_('AGENDAMENTOS').filter(r => {
    const dt = new Date(r.INICIO);
    return dt >= inicio && dt < fim && !['CANCELADO','RECUSADO'].includes(String(r.STATUS).toUpperCase());
  });
  const itens = records_('ITENS_AGENDAMENTO');
  if (u.PERFIL === 'CLIENTE') ag = ag.filter(r => String(r.CLIENTE_ID) === String(u.REFERENCIA_ID));
  if (u.PERFIL === 'FUNCIONARIO') {
    const meus = new Set(itens.filter(i => String(i.FUNCIONARIO_ID) === String(u.REFERENCIA_ID)).map(i => String(i.AGENDAMENTO_ID)));
    ag = ag.filter(r => meus.has(String(r.ID)));
  }
  ag.sort((a,b) => new Date(a.INICIO)-new Date(b.INICIO));
  const clientes = records_('CLIENTES');
  const funcionarios = records_('FUNCIONARIOS');
  const servicos = records_('SERVICOS');
  const agenda = ag.map(a => {
    const cliente = clientes.find(c => String(c.ID) === String(a.CLIENTE_ID));
    const its = itens.filter(i => String(i.AGENDAMENTO_ID) === String(a.ID));
    const nomesServicos = its.map(i => {
      const s = servicos.find(x => String(x.ID) === String(i.SERVICO_ID));
      return s ? String(s.NOME) : 'Serviço';
    });
    const nomesFuncionarios = [...new Set(its.map(i => {
      const f = funcionarios.find(x => String(x.ID) === String(i.FUNCIONARIO_ID));
      return f ? String(f.NOME) : '';
    }).filter(Boolean))];
    return {
      id:String(a.ID), inicio:new Date(a.INICIO).toISOString(), fim:new Date(a.FIM).toISOString(),
      status:String(a.STATUS || 'PENDENTE'), cliente:u.PERFIL === 'CLIENTE' ? '' : (cliente ? String(cliente.NOME) : 'Cliente'),
      servicos:nomesServicos.join(', '), funcionarios:nomesFuncionarios.join(', ')
    };
  });
  const base = { usuario:publicarUsuario_(u), agenda:agenda };
  if (u.PERFIL === 'ADMINISTRADOR') {
    const resumo = obterResumoPainel(inicio, fim, token);
    base.resumo = {
      agendamentos:resumo.agendamentos,
      confirmados:resumo.confirmados,
      cancelados:resumo.cancelados,
      faturamentoPrevisto:resumo.faturamentoPrevisto,
      clientes:clientes.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length,
      funcionarios:funcionarios.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length,
      servicos:servicos.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length
    };
  }
  return base;
}
function atualizarStatusAgendamento(id, novoStatus, token) {
  const u = usuarioDaSessao_(token);
  if (!['ADMINISTRADOR','FUNCIONARIO'].includes(String(u.PERFIL))) throw new Error('Sem permissão para alterar agendamentos.');
  const status = String(novoStatus || '').toUpperCase();
  if (!['CONFIRMADO','CANCELADO','RECUSADO'].includes(status)) throw new Error('Status inválido.');
  const a = records_('AGENDAMENTOS').find(x=>String(x.ID)===String(id));
  if (!a) throw new Error('Agendamento não encontrado.');
  if (String(a.STATUS).toUpperCase() !== 'AGUARDANDO_APROVACAO') throw new Error('Este agendamento não está aguardando aprovação.');
  if (u.PERFIL === 'FUNCIONARIO') {
    const associado = records_('ITENS_AGENDAMENTO').some(i=>String(i.AGENDAMENTO_ID)===String(id) && String(i.FUNCIONARIO_ID)===String(u.REFERENCIA_ID));
    if (!associado) throw new Error('Você só pode decidir sobre agendamentos da sua agenda.');
  }
  const row = localizarLinha_('AGENDAMENTOS','ID',id), sh = sheet_('AGENDAMENTOS');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const statusCol = headers.indexOf('STATUS')+1;
  if (!statusCol) throw new Error('Coluna STATUS ausente.');
  sh.getRange(row,statusCol).setValue(status);
  const updatedCol = headers.indexOf('ATUALIZADO_EM')+1;
  if (updatedCol) sh.getRange(row,updatedCol).setValue(new Date());
  return {ok:true,status:status};
}
