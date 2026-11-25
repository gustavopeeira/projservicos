function listarClientes(token){
  exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  return records_('CLIENTES').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE')
    .map(r=>({ID:String(r.ID),NOME:String(r.NOME),TELEFONE:String(r.TELEFONE||''),EMAIL:String(r.EMAIL||'')}));
}
function salvarCliente(d,token){
  exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome do cliente.');
  const t=String(d.TELEFONE||'').replace(/\D/g,'');
  if(t.length<8)throw Error('Informe um telefone válido.');
  const old=records_('CLIENTES').find(r=>String(r.TELEFONE||'').replace(/\D/g,'')===t);
  if(old)return{id:String(old.ID),existente:true,nome:String(old.NOME)};
  const r={ID:id_('CLI'),NOME:String(d.NOME).trim(),TELEFONE:t,EMAIL:String(d.EMAIL||'').trim(),CRIADO_EM:new Date(),ATIVO:true,OBSERVACOES:String(d.OBSERVACOES||'').trim()};
  sheet_('CLIENTES').appendRow(SHEET_SCHEMAS.CLIENTES.map(k=>r[k]??''));
  return{id:r.ID,existente:false,nome:r.NOME};
}