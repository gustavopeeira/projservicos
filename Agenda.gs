function configValor_(chave,padrao){
  const r=records_('CONFIG').find(x=>String(x.CHAVE)===chave);
  return r?String(r.VALOR):String(padrao);
}
function diaSemana_(data){
  // HORARIOS_FUNCIONARIOS usa 0=segunda ... 6=domingo.
  return Number(Utilities.formatDate(data,APP_CONFIG.TIMEZONE,'u'))-1;
}
function minutosHora_(hora){
  const m=String(hora||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if(!m)throw Error('Horário inválido. Use HH:mm.');
  return Number(m[1])*60+Number(m[2]);
}
function validarDisponibilidade_(funcId,inicio,fim){
  const agora=new Date();
  const minHoras=Number(configValor_('ANTECEDENCIA_MINIMA_HORAS',2));
  const maxDias=Number(configValor_('ANTECEDENCIA_MAXIMA_DIAS',60));
  if(inicio.getTime()<agora.getTime()+minHoras*3600000)throw Error('O agendamento precisa respeitar a antecedência mínima de '+minHoras+' hora(s).');
  if(inicio.getTime()>agora.getTime()+maxDias*86400000)throw Error('O agendamento ultrapassa o limite de '+maxDias+' dias de antecedência.');
  const dia=diaSemana_(inicio), ini=minutosHora_(Utilities.formatDate(inicio,APP_CONFIG.TIMEZONE,'HH:mm'));
  const fimMin=minutosHora_(Utilities.formatDate(fim,APP_CONFIG.TIMEZONE,'HH:mm'));
  const horarios=records_('HORARIOS_FUNCIONARIOS').filter(x=>String(x.FUNCIONARIO_ID)===String(funcId)&&Number(x.DIA_SEMANA)===dia&&String(x.ATIVO).toUpperCase()!=='FALSE');
  if(!horarios.some(h=>ini>=minutosHora_(h.HORA_INICIO)&&fimMin<=minutosHora_(h.HORA_FIM)))throw Error('O horário escolhido está fora do expediente cadastrado para este funcionário.');
  const intervalos=records_('INTERVALOS').filter(x=>String(x.FUNCIONARIO_ID)===String(funcId)&&Number(x.DIA_SEMANA)===dia&&String(x.ATIVO).toUpperCase()!=='FALSE');
  if(intervalos.some(x=>ini<minutosHora_(x.HORA_FIM)&&fimMin>minutosHora_(x.HORA_INICIO)))throw Error('O horário escolhido coincide com um intervalo do funcionário.');
  const bloqueios=records_('BLOQUEIOS').filter(x=>String(x.FUNCIONARIO_ID)===String(funcId));
  if(bloqueios.some(x=>inicio<new Date(x.FIM)&&fim>new Date(x.INICIO)))throw Error('O funcionário possui um bloqueio neste período.');
}
function salvarHorarioFuncionario(d,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  const fid=u.PERFIL==='FUNCIONARIO'?String(u.REFERENCIA_ID):String(d.FUNCIONARIO_ID||'');
  if(!fid||!records_('FUNCIONARIOS').some(x=>String(x.ID)===fid))throw Error('Funcionário inválido.');
  const dia=Number(d.DIA_SEMANA);if(!Number.isInteger(dia)||dia<0||dia>6)throw Error('Dia inválido (0=segunda a 6=domingo).');
  const a=minutosHora_(d.HORA_INICIO),b=minutosHora_(d.HORA_FIM);if(b<=a)throw Error('O fim do expediente deve ser depois do início.');
  const s=sheet_('HORARIOS_FUNCIONARIOS'),r={ID:id_('HOR'),FUNCIONARIO_ID:fid,DIA_SEMANA:dia,HORA_INICIO:d.HORA_INICIO,HORA_FIM:d.HORA_FIM,ATIVO:true};
  s.appendRow(SHEET_SCHEMAS.HORARIOS_FUNCIONARIOS.map(k=>r[k]??''));return{id:r.ID};
}
function salvarIntervaloFuncionario(d,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token),fid=u.PERFIL==='FUNCIONARIO'?String(u.REFERENCIA_ID):String(d.FUNCIONARIO_ID||'');
  if(!fid||!records_('FUNCIONARIOS').some(x=>String(x.ID)===fid))throw Error('Funcionário inválido.');
  const dia=Number(d.DIA_SEMANA),a=minutosHora_(d.HORA_INICIO),b=minutosHora_(d.HORA_FIM);
  if(!Number.isInteger(dia)||dia<0||dia>6||b<=a)throw Error('Dia ou intervalo inválido.');
  const r={ID:id_('INT'),FUNCIONARIO_ID:fid,DIA_SEMANA:dia,HORA_INICIO:d.HORA_INICIO,HORA_FIM:d.HORA_FIM,DESCRICAO:String(d.DESCRICAO||'Intervalo'),ATIVO:true};
  sheet_('INTERVALOS').appendRow(SHEET_SCHEMAS.INTERVALOS.map(k=>r[k]??''));return{id:r.ID};
}
function salvarBloqueioFuncionario(d,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token),fid=u.PERFIL==='FUNCIONARIO'?String(u.REFERENCIA_ID):String(d.FUNCIONARIO_ID||'');
  if(!fid||!records_('FUNCIONARIOS').some(x=>String(x.ID)===fid))throw Error('Funcionário inválido.');
  const a=Utilities.parseDate(String(d.INICIO||''),APP_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm"),b=Utilities.parseDate(String(d.FIM||''),APP_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm");
  if(isNaN(a)||isNaN(b)||b<=a)throw Error('Período de bloqueio inválido.');
  const r={ID:id_('BLQ'),FUNCIONARIO_ID:fid,INICIO:a,FIM:b,MOTIVO:String(d.MOTIVO||'Indisponibilidade'),CRIADO_POR:u.ID};
  sheet_('BLOQUEIOS').appendRow(SHEET_SCHEMAS.BLOQUEIOS.map(k=>r[k]??''));return{id:r.ID};
}
function consultarAgenda(inicio,fim,funcId,token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO','CLIENTE'],token),a=new Date(inicio),b=new Date(fim);
  if(isNaN(a)||isNaN(b)||b<=a)throw Error('Período inválido.');
  let rows=records_('AGENDAMENTOS').filter(r=>new Date(r.INICIO)<b&&new Date(r.FIM)>a);
  if(u.PERFIL==='CLIENTE')rows=rows.filter(r=>String(r.CLIENTE_ID)===String(u.REFERENCIA_ID));
  if(u.PERFIL==='FUNCIONARIO'){const ids=records_('ITENS_AGENDAMENTO').filter(i=>String(i.FUNCIONARIO_ID)===String(u.REFERENCIA_ID)).map(i=>String(i.AGENDAMENTO_ID));rows=rows.filter(r=>ids.includes(String(r.ID)));}
  if(funcId&&u.PERFIL==='ADMINISTRADOR'){const ids=records_('ITENS_AGENDAMENTO').filter(i=>String(i.FUNCIONARIO_ID)===String(funcId)).map(i=>String(i.AGENDAMENTO_ID));rows=rows.filter(r=>ids.includes(String(r.ID)));}
  return rows;
}