function listarFuncionarios(token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  return records_('FUNCIONARIOS').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE').map(r=>({ID:r.ID,NOME:r.NOME,ESPECIALIDADES:r.ESPECIALIDADES||''}));
}
function salvarFuncionario(d,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome.');
  const email=String(d.EMAIL||'').trim().toLowerCase();
  if(d.CRIAR_ACESSO&&(!email||!d.SENHA_INICIAL))throw Error('Para criar acesso, informe e-mail e senha inicial.');
  if(d.CRIAR_ACESSO){if(records_('USUARIOS').some(x=>String(x.EMAIL||'').toLowerCase()===email))throw Error('Este e-mail já possui cadastro de acesso.');derivarSenha_(d.SENHA_INICIAL,'validacao');}
  const r={ID:id_('FUN'),NOME:String(d.NOME).trim(),TELEFONE:d.TELEFONE||'',EMAIL:email,ESPECIALIDADES:d.ESPECIALIDADES||'',ATIVO:true,CRIADO_EM:new Date()};
  sheet_('FUNCIONARIOS').appendRow(SHEET_SCHEMAS.FUNCIONARIOS.map(k=>r[k]??''));
  let acesso=null;
  if(d.CRIAR_ACESSO) acesso=criarUsuario({REFERENCIA_ID:r.ID,NOME_EXIBICAO:r.NOME,EMAIL:email,PERFIL:'FUNCIONARIO',SENHA:d.SENHA_INICIAL},token);
  return{id:r.ID,acesso:acesso};
}
function criarAcessoFuncionario(funcionarioId,email,senha,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  const f=records_('FUNCIONARIOS').find(x=>String(x.ID)===String(funcionarioId));
  if(!f)throw Error('Funcionário não encontrado.');
  return criarUsuario({REFERENCIA_ID:f.ID,NOME_EXIBICAO:f.NOME,EMAIL:email,PERFIL:'FUNCIONARIO',SENHA:senha},token);
}