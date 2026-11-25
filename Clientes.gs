function listarClientes(token){
  exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  return records_('CLIENTES').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE').map(r=>({ID:String(r.ID),NOME:String(r.NOME),TELEFONE:String(r.TELEFONE||''),EMAIL:String(r.EMAIL||'')}));
}
function salvarCliente(d,token){
  exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome do cliente.');
  const t=String(d.TELEFONE||'').replace(/\D/g,'');
  if(t.length<8)throw Error('Informe um telefone válido.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    let r=records_('CLIENTES').find(x=>String(x.TELEFONE||'').replace(/\D/g,'')===t);
    let existente=!!r;
    if(!r){r={ID:id_('CLI'),NOME:String(d.NOME).trim(),TELEFONE:t,EMAIL:String(d.EMAIL||'').trim(),CRIADO_EM:new Date(),ATIVO:true,OBSERVACOES:String(d.OBSERVACOES||'').trim()};sheet_('CLIENTES').appendRow(SHEET_SCHEMAS.CLIENTES.map(k=>r[k]??''));}
    let acesso=null;
    if(d.CRIAR_ACESSO){
      const email=String(d.USUARIO_EMAIL||d.EMAIL||'').trim();
      if(!email||!d.SENHA_INICIAL)throw Error('Informe e-mail e senha inicial para criar acesso.');
      const ja=records_('USUARIOS').some(x=>String(x.REFERENCIA_ID)===String(r.ID)&&String(x.PERFIL)==='CLIENTE');
      if(ja)throw Error('Este cliente já possui usuário vinculado.');
      acesso=criarUsuario({REFERENCIA_ID:r.ID,NOME_EXIBICAO:r.NOME,EMAIL:email,PERFIL:'CLIENTE',SENHA:d.SENHA_INICIAL},token);
    }
    return{id:String(r.ID),existente,nome:String(r.NOME),acesso};
  }finally{lock.releaseLock();}
}
function criarAcessoCliente(clienteId,email,senha,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  const c=records_('CLIENTES').find(x=>String(x.ID)===String(clienteId));
  if(!c)throw Error('Cliente não encontrado.');
  if(records_('USUARIOS').some(x=>String(x.REFERENCIA_ID)===String(c.ID)&&String(x.PERFIL)==='CLIENTE'))throw Error('Este cliente já possui acesso.');
  return criarUsuario({REFERENCIA_ID:c.ID,NOME_EXIBICAO:c.NOME,EMAIL:email,PERFIL:'CLIENTE',SENHA:senha},token);
}