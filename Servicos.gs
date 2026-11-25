function listarServicos(token){usuarioDaSessao_(token);return records_('SERVICOS').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE');}
function salvarServico(d,token){exigirPerfil_(['ADMINISTRADOR'],token);if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome.');const r={ID:id_('SRV'),CATEGORIA_ID:d.CATEGORIA_ID||'',NOME:String(d.NOME).trim(),DESCRICAO:d.DESCRICAO||'',ATIVO:true};sheet_('SERVICOS').appendRow(SHEET_SCHEMAS.SERVICOS.map(k=>r[k]??''));return{id:r.ID};}
function vincularServicoFuncionario(f,s,p,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  if(!records_('FUNCIONARIOS').some(x=>String(x.ID)===String(f)&&String(x.ATIVO).toUpperCase()!=='FALSE'))throw Error('Funcionário inválido ou inativo.');
  if(!records_('SERVICOS').some(x=>String(x.ID)===String(s)&&String(x.ATIVO).toUpperCase()!=='FALSE'))throw Error('Serviço inválido ou inativo.');
  if(!isFinite(+p)||+p<0)throw Error('Preço inválido.');
  if(records_('FUNCIONARIO_SERVICOS').some(x=>String(x.FUNCIONARIO_ID)===String(f)&&String(x.SERVICO_ID)===String(s)&&String(x.ATIVO).toUpperCase()!=='FALSE'))throw Error('Este serviço já está vinculado ao funcionário.');
  const r={ID:id_('FSE'),FUNCIONARIO_ID:f,SERVICO_ID:s,PRECO:+p,ATIVO:true};sheet_('FUNCIONARIO_SERVICOS').appendRow(SHEET_SCHEMAS.FUNCIONARIO_SERVICOS.map(k=>r[k]??''));return{id:r.ID};
}
function salvarServicoComFuncionario(d,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome do serviço.');
  const f=records_('FUNCIONARIOS').find(x=>String(x.ID)===String(d.FUNCIONARIO_ID)&&String(x.ATIVO).toUpperCase()!=='FALSE');
  if(!f)throw Error('Selecione um funcionário ativo.');
  if(!isFinite(Number(d.PRECO))||Number(d.PRECO)<0)throw Error('Preço inválido.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const s={ID:id_('SRV'),CATEGORIA_ID:'',NOME:String(d.NOME).trim(),DESCRICAO:String(d.DESCRICAO||''),ATIVO:true};
    sheet_('SERVICOS').appendRow(SHEET_SCHEMAS.SERVICOS.map(k=>s[k]??''));
    const v={ID:id_('FSE'),FUNCIONARIO_ID:f.ID,SERVICO_ID:s.ID,PRECO:Number(d.PRECO),ATIVO:true};
    sheet_('FUNCIONARIO_SERVICOS').appendRow(SHEET_SCHEMAS.FUNCIONARIO_SERVICOS.map(k=>v[k]??''));
    return{id:s.ID,vinculoId:v.ID};
  }finally{lock.releaseLock();}
}