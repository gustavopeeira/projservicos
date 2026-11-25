function obterCatalogoFormulario(token){
  const u=usuarioDaSessao_(token);
  const servicos=records_('SERVICOS').filter(s=>String(s.ATIVO).toUpperCase()!=='FALSE').map(s=>({
    id:String(s.ID),nome:String(s.NOME),funcionarios:records_('FUNCIONARIO_SERVICOS')
      .filter(v=>String(v.SERVICO_ID)===String(s.ID)&&String(v.ATIVO).toUpperCase()!=='FALSE')
      .map(v=>{const f=records_('FUNCIONARIOS').find(x=>String(x.ID)===String(v.FUNCIONARIO_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');return f?{id:String(f.ID),nome:String(f.NOME),preco:Number(v.PRECO)}:null;}).filter(Boolean)
  }));
  const base={perfil:String(u.PERFIL),servicos:servicos};
  if(u.PERFIL==='CLIENTE'){
    const c=records_('CLIENTES').find(x=>String(x.ID)===String(u.REFERENCIA_ID));
    if(!c)throw Error('Seu usuário ainda não está vinculado a um cadastro de cliente.');
    base.cliente={id:String(c.ID),nome:String(c.NOME)};
  }else{
    base.clientes=listarClientes(token);
    if(u.PERFIL==='ADMINISTRADOR')base.funcionarios=listarFuncionarios(token);
    if(u.PERFIL==='FUNCIONARIO')base.funcionarioId=String(u.REFERENCIA_ID);
  }
  return base;
}
function obterDadosPainel(token){
  const u=usuarioDaSessao_(token),agora=new Date(),limite=new Date(agora.getTime()+31*86400000);
  let ags=records_('AGENDAMENTOS').filter(a=>new Date(a.FIM)>=agora&&new Date(a.INICIO)<=limite);
  const itens=records_('ITENS_AGENDAMENTO'),clientes=records_('CLIENTES'),funcionarios=records_('FUNCIONARIOS'),servicos=records_('SERVICOS');
  ags=filtrarAgendamentosPorUsuario_(ags,itens,u);
  ags.sort((a,b)=>new Date(a.INICIO)-new Date(b.INICIO));
  const agenda=ags.map(a=>{
    const its=itens.filter(i=>String(i.AGENDAMENTO_ID)===String(a.ID));
    return{id:String(a.ID),inicio:a.INICIO,fim:a.FIM,status:String(a.STATUS||''),cliente:(clientes.find(c=>String(c.ID)===String(a.CLIENTE_ID))||{}).NOME||'',servicos:its.map(i=>(servicos.find(s=>String(s.ID)===String(i.SERVICO_ID))||{}).NOME||'Serviço').join(', '),funcionarios:its.map(i=>(funcionarios.find(f=>String(f.ID)===String(i.FUNCIONARIO_ID))||{}).NOME||'').filter(Boolean).join(', ')};
  });
  const resultado={usuario:publicarUsuario_(u),agenda:agenda};
  if(u.PERFIL==='ADMINISTRADOR'){
    const todos=records_('AGENDAMENTOS'),confirmados=todos.filter(a=>String(a.STATUS)==='CONFIRMADO');
    resultado.resumo={agendamentos:todos.length,confirmados:confirmados.length,clientes:clientes.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length,funcionarios:funcionarios.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length,servicos:servicos.filter(x=>String(x.ATIVO).toUpperCase()!=='FALSE').length,faturamentoPrevisto:itens.filter(i=>confirmados.some(a=>String(a.ID)===String(i.AGENDAMENTO_ID))).reduce((n,i)=>n+Number(i.PRECO_FINAL||0),0)};
  }
  return resultado;
}
function atualizarStatusAgendamento(id,status,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token),novo=String(status||'').toUpperCase();
  if(!['CONFIRMADO','RECUSADO'].includes(novo))throw Error('Status solicitado inválido.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const a=records_('AGENDAMENTOS').find(x=>String(x.ID)===String(id));
    if(!a)throw Error('Agendamento não encontrado.');
    if(String(a.STATUS)!=='AGUARDANDO_APROVACAO')throw Error('Este agendamento já foi processado.');
    if(!podeGerenciarAgendamento_(id,records_('ITENS_AGENDAMENTO'),u))throw Error('Você só pode aprovar agendamentos da sua agenda.');
    const sh=sheet_('AGENDAMENTOS'),row=localizarLinha_('AGENDAMENTOS','ID',id),headers=SHEET_SCHEMAS.AGENDAMENTOS;
    sh.getRange(row,headers.indexOf('STATUS')+1).setValue(novo);
    sh.getRange(row,headers.indexOf('ATUALIZADO_EM')+1).setValue(new Date());
    return{ok:true,status:novo};
  }finally{lock.releaseLock();}
}