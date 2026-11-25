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
  if(isNaN(inicio))throw Error('Data e horário inválidos.');
  const fim=new Date(inicio.getTime()+duracao*60000);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const vinculacoes=records_('FUNCIONARIO_SERVICOS').filter(x=>String(x.SERVICO_ID)===String(d.SERVICO_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');
    const funcionarios=records_('FUNCIONARIOS').filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE');
    let candidatos=vinculacoes.filter(v=>funcionarios.some(f=>String(f.ID)===String(v.FUNCIONARIO_ID)));
    if(u.PERFIL==='FUNCIONARIO')candidatos=candidatos.filter(v=>String(v.FUNCIONARIO_ID)===String(u.REFERENCIA_ID));
    if(d.FUNCIONARIO_ID)candidatos=candidatos.filter(v=>String(v.FUNCIONARIO_ID)===String(d.FUNCIONARIO_ID));
    if(!candidatos.length)throw Error('Não há funcionário habilitado para este serviço.');
    const existentes=records_('AGENDAMENTOS').filter(a=>!['CANCELADO','RECUSADO'].includes(String(a.STATUS).toUpperCase()));
    const itens=records_('ITENS_AGENDAMENTO');
    const escolhido=candidatos.find(v=>{
      try{validarDisponibilidade_(v.FUNCIONARIO_ID,inicio,fim)}catch(e){return false;}
      return !existentes.some(a=>inicio<new Date(a.FIM)&&fim>new Date(a.INICIO)&&itens.some(i=>String(i.AGENDAMENTO_ID)===String(a.ID)&&String(i.FUNCIONARIO_ID)===String(v.FUNCIONARIO_ID)));
    });
    if(!escolhido){
      // Retorna a causa de indisponibilidade quando há apenas um candidato.
      if(candidatos.length===1)validarDisponibilidade_(candidatos[0].FUNCIONARIO_ID,inicio,fim);
      throw Error('Não há profissional disponível nesse horário. Confira expediente, intervalos, bloqueios ou escolha outro horário.');
    }
    const preco=Number(escolhido.PRECO);if(!isFinite(preco)||preco<0)throw Error('Preço do serviço inválido.');
    const r={ID:id_('AGD'),CLIENTE_ID:String(d.CLIENTE_ID),INICIO:inicio,FIM:fim,STATUS:'AGUARDANDO_APROVACAO',RECORRENCIA_ID:'',RECORRENCIA_TIPO:'',OBSERVACOES:String(d.OBSERVACOES||'').trim(),CRIADO_POR:u.ID,CRIADO_EM:new Date(),ATUALIZADO_EM:new Date()};
    const x={ID:id_('ITA'),AGENDAMENTO_ID:r.ID,SERVICO_ID:String(servico.ID),FUNCIONARIO_ID:String(escolhido.FUNCIONARIO_ID),DURACAO_MINUTOS:duracao,PRECO_BASE:preco,DESCONTO_TIPO:'',DESCONTO_VALOR:0,PRECO_FINAL:preco,ORDEM:1};
    sheet_('AGENDAMENTOS').appendRow(SHEET_SCHEMAS.AGENDAMENTOS.map(k=>r[k]??''));
    sheet_('ITENS_AGENDAMENTO').appendRow(SHEET_SCHEMAS.ITENS_AGENDAMENTO.map(k=>x[k]??''));
    return{id:r.ID,status:r.STATUS,fim:r.FIM,funcionarioId:x.FUNCIONARIO_ID,preco:preco};
  }finally{lock.releaseLock();}
}