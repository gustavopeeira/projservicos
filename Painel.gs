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
    if(u.PERFIL==='ADMINISTRADOR')base.funcionarios=listarFuncionarios();
    if(u.PERFIL==='FUNCIONARIO')base.funcionarioId=String(u.REFERENCIA_ID);
  }
  return base;
}