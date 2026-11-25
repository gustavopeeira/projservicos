function criarAgendamento(d,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO','CLIENTE'],token);
  if(!d||!d.CLIENTE_ID||!d.SERVICO_ID)throw Error('Cliente e serviço são obrigatórios.');
  if(u.PERFIL==='CLIENTE'&&String(d.CLIENTE_ID)!==String(u.REFERENCIA_ID))throw Error('Você só pode agendar para sua própria conta.');
  const cliente=records_('CLIENTES').find(x=>String(x.ID)===String(d.CLIENTE_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');
  if(!cliente)throw Error('Cliente não encontrado ou inativo.');
  const servico=records_('SERVICOS').find(x=>String(x.ID)===String(d.SERVICO_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');
  if(!servico)throw Error('Serviço não encontrado ou inativo.');
  const duracao=Number(d.DURACAO_MINUTOS);
  if(!Number.isInteger(duracao)||duracao<5||duracao>720)throw Error('A duração deve ser de 5 a 720 minutos.');
  const inicio=Utilities.parseDate(String(d.INICIO||''),APP_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm");
  if(!(inicio instanceof Date)||isNaN(inicio.getTime()))throw Error('Data e horário inválidos.');
  if(inicio.getTime()<Date.now())throw Error('Escolha uma data futura.');
  const vinculacoes=records_('FUNCIONARIO_SERVICOS').filter(x=>String(x.SERVICO_ID)===String(d.SERVICO_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');
  const funcionarios=records_('FUNCIONARIOS').filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE');
  let candidatos=vinculacoes.filter(v=>funcionarios.some(f=>String(f.ID)===String(v.FUNCIONARIO_ID)));
  if(u.PERFIL==='FUNCIONARIO')candidatos=candidatos.filter(v=>String(v.FUNCIONARIO_ID)===String(u.REFERENCIA_ID));
  if(d.FUNCIONARIO_ID)candidatos=candidatos.filter(v=>String(v.FUNCIONARIO_ID)===String(d.FUNCIONARIO_ID));
  if(!candidatos.length)throw Error('Não há funcionário habilitado para este serviço.');
  const fim=new Date(inicio.getTime()+duracao*60000);
  const existentes=records_('AGENDAMENTOS').filter(a=>!['CANCELADO','RECUSADO'].includes(String(a.STATUS).toUpperCase()));
  const itensExistentes=records_('ITENS_AGENDAMENTO');
  const escolhido=candidatos.find(v=>{
    return !existentes.some(a=>{
      const aIni=new Date(a.INICIO),aFim=new Date(a.FIM);
      return inicio<aFim&&fim>aIni&&itensExistentes.some(i=>String(i.AGENDAMENTO_ID)===String(a.ID)&&String(i.FUNCIONARIO_ID)===String(v.FUNCIONARIO_ID));
    });
  });
  if(!escolhido)throw Error('Este horário já está ocupado para os funcionários disponíveis. Escolha outro horário ou profissional.');
  const preco=Number(escolhido.PRECO);
  if(!isFinite(preco)||preco<0)throw Error('O preço cadastrado para este serviço está inválido.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const r={ID:id_('AGD'),CLIENTE_ID:String(d.CLIENTE_ID),INICIO:inicio,FIM:fim,STATUS:'AGUARDANDO_APROVACAO',RECORRENCIA_ID:'',RECORRENCIA_TIPO:'',OBSERVACOES:String(d.OBSERVACOES||'').trim(),CRIADO_POR:u.ID,CRIADO_EM:new Date(),ATUALIZADO_EM:new Date()};
    sheet_('AGENDAMENTOS').appendRow(SHEET_SCHEMAS.AGENDAMENTOS.map(k=>r[k]??''));
    const x={ID:id_('ITA'),AGENDAMENTO_ID:r.ID,SERVICO_ID:String(servico.ID),FUNCIONARIO_ID:String(escolhido.FUNCIONARIO_ID),DURACAO_MINUTOS:duracao,PRECO_BASE:preco,DESCONTO_TIPO:'',DESCONTO_VALOR:0,PRECO_FINAL:preco,ORDEM:1};
    sheet_('ITENS_AGENDAMENTO').appendRow(SHEET_SCHEMAS.ITENS_AGENDAMENTO.map(k=>x[k]??''));
    return{id:r.ID,status:r.STATUS,fim:r.FIM,funcionarioId:x.FUNCIONARIO_ID,preco:preco};
  }finally{lock.releaseLock();}
}