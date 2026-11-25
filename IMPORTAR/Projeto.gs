

/************************************************************
 * ARQUIVO ORIGINAL: Agenda.gs
 ************************************************************/

/**
 * Regras de escopo compartilhadas pelas consultas e ações de agenda.
 * Recebe arrays já carregados do banco; não faz I/O.
 */
function filtrarAgendamentosPorUsuario_(rows, itens, usuario, funcionarioFiltro) {
  const perfil = String(usuario && usuario.PERFIL || '').toUpperCase();
  const referencia = String(usuario && usuario.REFERENCIA_ID || '');
  if (perfil === 'CLIENTE') return rows.filter(r => String(r.CLIENTE_ID) === referencia);
  if (perfil === 'FUNCIONARIO') {
    const ids = itens.filter(i => String(i.FUNCIONARIO_ID) === referencia).map(i => String(i.AGENDAMENTO_ID));
    return rows.filter(r => ids.includes(String(r.ID)));
  }
  if (perfil === 'ADMINISTRADOR') {
    if (!funcionarioFiltro) return rows;
    const ids = itens.filter(i => String(i.FUNCIONARIO_ID) === String(funcionarioFiltro)).map(i => String(i.AGENDAMENTO_ID));
    return rows.filter(r => ids.includes(String(r.ID)));
  }
  throw new Error('Perfil sem acesso à agenda.');
}
function podeGerenciarAgendamento_(agendamentoId, itens, usuario) {
  const perfil = String(usuario && usuario.PERFIL || '').toUpperCase();
  if (perfil === 'ADMINISTRADOR') return true;
  if (perfil !== 'FUNCIONARIO') return false;
  return itens.some(i => String(i.AGENDAMENTO_ID) === String(agendamentoId) && String(i.FUNCIONARIO_ID) === String(usuario.REFERENCIA_ID));
}
function idsClientesVisiveisFuncionario_(funcionarioId, agendamentos, itens) {
  const agIds = itens.filter(i => String(i.FUNCIONARIO_ID) === String(funcionarioId)).map(i => String(i.AGENDAMENTO_ID));
  return [...new Set(agendamentos.filter(a => agIds.includes(String(a.ID))).map(a => String(a.CLIENTE_ID)))];
}

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
  if(Utilities.formatDate(inicio,APP_CONFIG.TIMEZONE,'yyyy-MM-dd')!==Utilities.formatDate(fim,APP_CONFIG.TIMEZONE,'yyyy-MM-dd'))throw Error('O agendamento não pode atravessar a meia-noite.');
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
  const rows=records_('AGENDAMENTOS').filter(r=>new Date(r.INICIO)<b&&new Date(r.FIM)>a);
  const itens=records_('ITENS_AGENDAMENTO');
  return filtrarAgendamentosPorUsuario_(rows,itens,u,funcId);
}

/************************************************************
 * ARQUIVO ORIGINAL: Agendamentos.gs
 ************************************************************/

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

/************************************************************
 * ARQUIVO ORIGINAL: Auth.gs
 ************************************************************/

/**
 * Autenticação e autorização do ProjServiços.
 * Funções terminadas em _ são privadas para chamadas do HTML.
 */
const AUTH_CONFIG = Object.freeze({
  SESSION_TTL_SECONDS: 21600,
  HASH_ITERATIONS: 12000,
  RECOVERY_TTL_SECONDS: 900,
  RECOVERY_MAX_ATTEMPTS: 5,
  RECOVERY_REQUEST_WINDOW_SECONDS: 60,
  RECOVERY_GLOBAL_LIMIT: 20
});

function normalizarEmail_(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('E-mail inválido.');
  return e;
}
function gerarSalt_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function bytesXor_(a, b) { return a.map((v, i) => (v ^ b[i])); }
function derivarSenha_(senha, salt) {
  const p = String(senha || '');
  if (p.length < 10 || p.length > 128) throw new Error('A senha deve ter entre 10 e 128 caracteres.');
  let u = Utilities.computeHmacSha256Signature(salt + String.fromCharCode(0,0,0,1), p, Utilities.Charset.UTF_8);
  let t = u.slice();
  for (let i = 1; i < AUTH_CONFIG.HASH_ITERATIONS; i++) {
    u = Utilities.computeHmacSha256Signature(u, p);
    t = bytesXor_(t, u);
  }
  return Utilities.base64Encode(t);
}
function usuarioPorEmail_(email) {
  const e = normalizarEmail_(email);
  return records_('USUARIOS').find(u => String(u.EMAIL || '').toLowerCase() === e && String(u.ATIVO).toUpperCase() !== 'FALSE');
}
function configurarPrimeiroAdministrador_(email, senha, nome) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (records_('USUARIOS').some(u => String(u.PERFIL).toUpperCase() === 'ADMINISTRADOR')) throw new Error('Já existe administrador cadastrado.');
    const e = normalizarEmail_(email), salt = gerarSalt_();
    const u = { ID:id_('USR'), REFERENCIA_ID:'', NOME_EXIBICAO:String(nome || 'Administrador').trim(),
      EMAIL:e, PERFIL:'ADMINISTRADOR', SENHA_HASH:derivarSenha_(senha,salt), SENHA_SALT:salt,
      ATIVO:true, CRIADO_EM:new Date(), ULTIMO_ACESSO:'' };
    sheet_('USUARIOS').appendRow(SHEET_SCHEMAS.USUARIOS.map(k => u[k] ?? ''));
    return { ok:true, email:e };
  } finally { lock.releaseLock(); }
}
function criarUsuario_(d, token) {
  exigirPerfil_(['ADMINISTRADOR'], token);
  if (!d || !['ADMINISTRADOR','FUNCIONARIO','CLIENTE'].includes(String(d.PERFIL).toUpperCase())) throw new Error('Perfil inválido.');
  const email = normalizarEmail_(d.EMAIL);
  if (records_('USUARIOS').some(u => String(u.EMAIL || '').toLowerCase() === email)) throw new Error('Este e-mail já possui acesso.');
  const perfil = String(d.PERFIL).toUpperCase();
  if (perfil !== 'ADMINISTRADOR' && !d.REFERENCIA_ID) throw new Error('Vincule o usuário ao cadastro correspondente.');
  const salt = gerarSalt_();
  const u = { ID:id_('USR'), REFERENCIA_ID:d.REFERENCIA_ID || '', NOME_EXIBICAO:String(d.NOME_EXIBICAO || '').trim(),
    EMAIL:email, PERFIL:perfil, SENHA_HASH:derivarSenha_(d.SENHA,salt), SENHA_SALT:salt,
    ATIVO:true, CRIADO_EM:new Date(), ULTIMO_ACESSO:'' };
  sheet_('USUARIOS').appendRow(SHEET_SCHEMAS.USUARIOS.map(k => u[k] ?? ''));
  return { id:u.ID, email:u.EMAIL, perfil:u.PERFIL };
}
function criarUsuario(d, token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return criarUsuario_(d, token); }
  finally { lock.releaseLock(); }
}
function entrar(email, senha) {
  const u = usuarioPorEmail_(email);
  if (!u || !u.SENHA_SALT || !u.SENHA_HASH) throw new Error('E-mail ou senha inválidos.');
  const hash = derivarSenha_(senha, u.SENHA_SALT);
  if (hash !== String(u.SENHA_HASH)) throw new Error('E-mail ou senha inválidos.');
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('sessao:' + token, String(u.ID), AUTH_CONFIG.SESSION_TTL_SECONDS);
  const sh = sheet_('USUARIOS'), row = localizarLinha_('USUARIOS','ID',u.ID);
  sh.getRange(row, SHEET_SCHEMAS.USUARIOS.indexOf('ULTIMO_ACESSO') + 1).setValue(new Date());
  return { token:token, usuario:publicarUsuario_(u) };
}
function localizarLinha_(aba, coluna, valor) {
  const s = sheet_(aba), dados = s.getDataRange().getValues(), idx = dados[0].indexOf(coluna);
  if (idx < 0) throw new Error('Coluna ausente: ' + coluna);
  for (let i=1;i<dados.length;i++) if (String(dados[i][idx]) === String(valor)) return i+1;
  throw new Error('Registro não encontrado.');
}
function publicarUsuario_(u) {
  return { id:u.ID, nome:u.NOME_EXIBICAO, email:u.EMAIL, perfil:String(u.PERFIL).toUpperCase(), referenciaId:u.REFERENCIA_ID || '' };
}
function obterSessao(token) { return publicarUsuario_(usuarioDaSessao_(token)); }
function sair(token) {
  if (token) CacheService.getScriptCache().remove('sessao:' + String(token));
  return { ok:true };
}
function usuarioDaSessao_(token) {
  const t = String(token || '');
  if (!t || t.length < 50) throw new Error('Sessão inválida. Entre novamente.');
  const id = CacheService.getScriptCache().get('sessao:' + t);
  if (!id) throw new Error('Sessão expirada. Entre novamente.');
  const u = records_('USUARIOS').find(x => String(x.ID) === id && String(x.ATIVO).toUpperCase() !== 'FALSE');
  if (!u) throw new Error('Usuário inativo ou inexistente.');
  return u;
}
function exigirPerfil_(perfis, token) {
  const u = usuarioDaSessao_(token);
  if (!perfis.includes(String(u.PERFIL).toUpperCase())) throw new Error('Você não tem permissão para esta operação.');
  return u;
}
function alterarMinhaSenha(token, senhaAtual, senhaNova) {
  const u = usuarioDaSessao_(token);
  if (derivarSenha_(senhaAtual, u.SENHA_SALT) !== String(u.SENHA_HASH)) throw new Error('Senha atual incorreta.');
  gravarNovaSenha_(u, senhaNova);
  CacheService.getScriptCache().remove('sessao:' + token);
  return { ok:true, mensagem:'Senha alterada. Entre novamente.' };
}
function gravarNovaSenha_(u, senha) {
  const salt = gerarSalt_(), hash = derivarSenha_(senha, salt), row = localizarLinha_('USUARIOS','ID',u.ID), s = sheet_('USUARIOS');
  s.getRange(row, SHEET_SCHEMAS.USUARIOS.indexOf('SENHA_SALT')+1).setValue(salt);
  s.getRange(row, SHEET_SCHEMAS.USUARIOS.indexOf('SENHA_HASH')+1).setValue(hash);
}
function solicitarRecuperacaoSenha(email) {
  const e = normalizarEmail_(email), cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const limite = 'recuperacao-limite:' + e;
    if (cache.get(limite)) throw new Error('Aguarde um minuto antes de solicitar outro código.');
    const globalKey = 'recuperacao-global:' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmm');
    const total = Number(cache.get(globalKey) || 0);
    if (total >= AUTH_CONFIG.RECOVERY_GLOBAL_LIMIT) throw new Error('Limite temporário de solicitações atingido. Tente novamente mais tarde.');
    cache.put(globalKey, String(total + 1), 120);
    cache.put(limite, '1', AUTH_CONFIG.RECOVERY_REQUEST_WINDOW_SECONDS);
    const u = usuarioPorEmail_(e);
    if (u) {
      const codigo = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
      cache.put('recuperacao:' + e, codigo, AUTH_CONFIG.RECOVERY_TTL_SECONDS);
      cache.remove('recuperacao-tentativas:' + e);
      MailApp.sendEmail({to:e, subject:'Código de recuperação - ProjServiços',
        body:'Seu código de recuperação é: ' + codigo + '\\nEle expira em 15 minutos. Se você não solicitou, ignore esta mensagem.'});
    }
    return {ok:true, mensagem:'Se o e-mail estiver cadastrado, enviaremos um código de recuperação.'};
  } finally { lock.releaseLock(); }
}
function redefinirSenhaComCodigo(email, codigo, novaSenha) {
  const e = normalizarEmail_(email), cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const chave = 'recuperacao:' + e, tentativasKey = 'recuperacao-tentativas:' + e;
    const salvo = cache.get(chave);
    if (!salvo) throw new Error('Código inválido ou expirado.');
    if (String(codigo || '').trim().toUpperCase() !== salvo) {
      const tentativas = Number(cache.get(tentativasKey) || 0) + 1;
      cache.put(tentativasKey, String(tentativas), AUTH_CONFIG.RECOVERY_TTL_SECONDS);
      if (tentativas >= AUTH_CONFIG.RECOVERY_MAX_ATTEMPTS) {
        cache.remove(chave);
        cache.remove(tentativasKey);
      }
      throw new Error('Código inválido ou expirado.');
    }
    const u = usuarioPorEmail_(e);
    if (!u) throw new Error('Não foi possível concluir a recuperação.');
    gravarNovaSenha_(u, novaSenha);
    cache.remove(chave);
    cache.remove(tentativasKey);
    return {ok:true, mensagem:'Senha redefinida. Faça login com a nova senha.'};
  } finally { lock.releaseLock(); }
}


/************************************************************
 * ARQUIVO ORIGINAL: Clientes.gs
 ************************************************************/

function listarClientes(token){
  const u=exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  let clientes=records_('CLIENTES').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE');
  if(u.PERFIL==='FUNCIONARIO'){
    const visiveis=idsClientesVisiveisFuncionario_(u.REFERENCIA_ID,records_('AGENDAMENTOS'),records_('ITENS_AGENDAMENTO'));
    clientes=clientes.filter(c=>visiveis.includes(String(c.ID)));
  }
  return clientes.map(r=>({ID:String(r.ID),NOME:String(r.NOME),TELEFONE:String(r.TELEFONE||''),EMAIL:String(r.EMAIL||'')}));
}
function salvarCliente(d,token){
  exigirPerfil_(['ADMINISTRADOR','FUNCIONARIO'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome do cliente.');
  const t=String(d.TELEFONE||'').replace(/\D/g,'');
  if(t.length<8)throw Error('Informe um telefone válido.');
  if(d.CRIAR_ACESSO){if(!['ADMINISTRADOR'].includes(usuarioDaSessao_(token).PERFIL))throw Error('Somente o administrador pode criar acessos de clientes.');const e=normalizarEmail_(d.USUARIO_EMAIL||d.EMAIL);if(records_('USUARIOS').some(x=>String(x.EMAIL||'').toLowerCase()===e))throw Error('Este e-mail já possui cadastro de acesso.');derivarSenha_(d.SENHA_INICIAL,'validacao');}
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
      acesso=criarUsuario_({REFERENCIA_ID:r.ID,NOME_EXIBICAO:r.NOME,EMAIL:email,PERFIL:'CLIENTE',SENHA:d.SENHA_INICIAL},token);
    }
    return{id:String(r.ID),existente,nome:String(r.NOME),acesso};
  }finally{lock.releaseLock();}
}
function criarAcessoCliente(clienteId,email,senha,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const c=records_('CLIENTES').find(x=>String(x.ID)===String(clienteId));
    if(!c)throw Error('Cliente não encontrado.');
    if(records_('USUARIOS').some(x=>String(x.REFERENCIA_ID)===String(c.ID)&&String(x.PERFIL)==='CLIENTE'))throw Error('Este cliente já possui acesso.');
    return criarUsuario_({REFERENCIA_ID:c.ID,NOME_EXIBICAO:c.NOME,EMAIL:email,PERFIL:'CLIENTE',SENHA:senha},token);
  }finally{lock.releaseLock();}
}

/************************************************************
 * ARQUIVO ORIGINAL: Config.gs
 ************************************************************/

const APP_CONFIG=Object.freeze({NAME:'ProjServiços',VERSION:'0.1.0',TIMEZONE:'America/Campo_Grande'});

/************************************************************
 * ARQUIVO ORIGINAL: Database.gs
 ************************************************************/

function sheet_(n){const s=SpreadsheetApp.getActive().getSheetByName(n);if(!s)throw Error('Aba ausente: '+n);return s;} function records_(n){const v=sheet_(n).getDataRange().getValues();if(v.length<2)return[];const h=v[0].map(String);return v.slice(1).filter(r=>r.some(x=>x!=='')).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));} function id_(p){return p+'-'+Utilities.getUuid();}

/************************************************************
 * ARQUIVO ORIGINAL: Funcionarios.gs
 ************************************************************/

function listarFuncionarios(token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  return records_('FUNCIONARIOS').filter(r=>String(r.ATIVO).toUpperCase()!=='FALSE').map(r=>({ID:r.ID,NOME:r.NOME,ESPECIALIDADES:r.ESPECIALIDADES||''}));
}
function salvarFuncionario(d,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  if(!d||!String(d.NOME||'').trim())throw Error('Informe o nome.');
  const email=String(d.EMAIL||'').trim().toLowerCase();
  if(d.CRIAR_ACESSO&&(!email||!d.SENHA_INICIAL))throw Error('Para criar acesso, informe e-mail e senha inicial.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  let linhaCriada=null;
  try{
    if(d.CRIAR_ACESSO){
      if(records_('USUARIOS').some(x=>String(x.EMAIL||'').toLowerCase()===email))throw Error('Este e-mail já possui cadastro de acesso.');
      derivarSenha_(d.SENHA_INICIAL,'validacao');
    }
    const r={ID:id_('FUN'),NOME:String(d.NOME).trim(),TELEFONE:d.TELEFONE||'',EMAIL:email,ESPECIALIDADES:d.ESPECIALIDADES||'',ATIVO:true,CRIADO_EM:new Date()};
    const sh=sheet_('FUNCIONARIOS');sh.appendRow(SHEET_SCHEMAS.FUNCIONARIOS.map(k=>r[k]??''));linhaCriada=sh.getLastRow();
    let acesso=null;
    if(d.CRIAR_ACESSO) acesso=criarUsuario_({REFERENCIA_ID:r.ID,NOME_EXIBICAO:r.NOME,EMAIL:email,PERFIL:'FUNCIONARIO',SENHA:d.SENHA_INICIAL},token);
    return{id:r.ID,acesso:acesso};
  }catch(e){
    if(linhaCriada)sheet_('FUNCIONARIOS').deleteRow(linhaCriada);
    throw e;
  }finally{lock.releaseLock();}
}
function criarAcessoFuncionario(funcionarioId,email,senha,token){
  exigirPerfil_(['ADMINISTRADOR'],token);
  const f=records_('FUNCIONARIOS').find(x=>String(x.ID)===String(funcionarioId));
  if(!f)throw Error('Funcionário não encontrado.');
  return criarUsuario({REFERENCIA_ID:f.ID,NOME_EXIBICAO:f.NOME,EMAIL:email,PERFIL:'FUNCIONARIO',SENHA:senha},token);
}


/************************************************************
 * ARQUIVO ORIGINAL: Notificacoes.gs
 ************************************************************/

function registrarNotificacao(d){const r={ID:id_('NOT'),AGENDAMENTO_ID:d.AGENDAMENTO_ID||'',CLIENTE_ID:d.CLIENTE_ID||'',CANAL:d.CANAL||'EMAIL',EVENTO:d.EVENTO||'',DESTINO:d.DESTINO||'',STATUS:'PENDENTE',DETALHE:'',CRIADO_EM:new Date()};sheet_('NOTIFICACOES').appendRow(SHEET_SCHEMAS.NOTIFICACOES.map(k=>r[k]??''));return{id:r.ID};} function enviarEmail_(to,subject,body){if(!to)throw Error('Destinatário obrigatório.');MailApp.sendEmail({to,subject,body,name:APP_CONFIG.NAME});}

/************************************************************
 * ARQUIVO ORIGINAL: Painel.gs
 ************************************************************/

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

/************************************************************
 * ARQUIVO ORIGINAL: Relatorios.gs
 ************************************************************/

function obterResumoPainel(inicio,fim,token){exigirPerfil_(['ADMINISTRADOR'],token);const a=consultarAgenda(inicio,fim,'',token),ids=a.map(x=>String(x.ID)),it=records_('ITENS_AGENDAMENTO').filter(x=>ids.includes(String(x.AGENDAMENTO_ID)));return{agendamentos:a.length,confirmados:a.filter(x=>x.STATUS==='CONFIRMADO').length,cancelados:a.filter(x=>x.STATUS==='CANCELADO').length,faturamentoPrevisto:it.reduce((s,x)=>s+(+x.PRECO_FINAL||0),0)};}

/************************************************************
 * ARQUIVO ORIGINAL: Servicos.gs
 ************************************************************/

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

/************************************************************
 * ARQUIVO ORIGINAL: Setup.gs
 ************************************************************/

const SHEET_SCHEMAS={
CLIENTES:['ID','NOME','TELEFONE','EMAIL','CRIADO_EM','ATIVO','OBSERVACOES'],
FUNCIONARIOS:['ID','NOME','TELEFONE','EMAIL','ESPECIALIDADES','ATIVO','CRIADO_EM'],
USUARIOS:['ID','REFERENCIA_ID','NOME_EXIBICAO','EMAIL','PERFIL','SENHA_HASH','SENHA_SALT','ATIVO','CRIADO_EM','ULTIMO_ACESSO'],
CATEGORIAS:['ID','NOME','DESCRICAO','ATIVA'],
SERVICOS:['ID','CATEGORIA_ID','NOME','DESCRICAO','ATIVO'],
FUNCIONARIO_SERVICOS:['ID','FUNCIONARIO_ID','SERVICO_ID','PRECO','ATIVO'],
AGENDAMENTOS:['ID','CLIENTE_ID','INICIO','FIM','STATUS','RECORRENCIA_ID','RECORRENCIA_TIPO','OBSERVACOES','CRIADO_POR','CRIADO_EM','ATUALIZADO_EM'],
ITENS_AGENDAMENTO:['ID','AGENDAMENTO_ID','SERVICO_ID','FUNCIONARIO_ID','DURACAO_MINUTOS','PRECO_BASE','DESCONTO_TIPO','DESCONTO_VALOR','PRECO_FINAL','ORDEM'],
HORARIOS_FUNCIONARIOS:['ID','FUNCIONARIO_ID','DIA_SEMANA','HORA_INICIO','HORA_FIM','ATIVO'],
INTERVALOS:['ID','FUNCIONARIO_ID','DIA_SEMANA','HORA_INICIO','HORA_FIM','DESCRICAO','ATIVO'],
BLOQUEIOS:['ID','FUNCIONARIO_ID','INICIO','FIM','MOTIVO','CRIADO_POR'],
LISTA_ESPERA:['ID','CLIENTE_ID','SERVICO_ID','FUNCIONARIO_ID','INICIO_DESEJADO','FIM_DESEJADO','STATUS','CRIADO_EM'],
PAGAMENTOS:['ID','AGENDAMENTO_ID','STATUS','VALOR','FORMA','DATA_PAGAMENTO','OBSERVACOES'],
NOTIFICACOES:['ID','AGENDAMENTO_ID','CLIENTE_ID','CANAL','EVENTO','DESTINO','STATUS','DETALHE','CRIADO_EM'],
CONFIG:['CHAVE','VALOR','DESCRICAO']};
function setupSistema(){
const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Vincule este projeto a uma planilha Google.');
const criadas=[];
Object.keys(SHEET_SCHEMAS).forEach(n=>{let s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);criadas.push(n);}
const h=SHEET_SCHEMAS[n];if(s.getLastRow()===0){s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);s.getRange(1,1,1,h.length).setFontWeight('bold');}
else{const old=s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0].map(String);const add=h.filter(x=>!old.includes(x));if(add.length)s.getRange(1,old.length+1,1,add.length).setValues([add]);s.setFrozenRows(1);}});
const c=ss.getSheetByName('CONFIG'),known=c.getLastRow()>1?c.getRange(2,1,c.getLastRow()-1,1).getValues().flat():[];
[['ANTECEDENCIA_MINIMA_HORAS','2','Antecedência mínima'],['ANTECEDENCIA_MAXIMA_DIAS','60','Antecedência máxima'],['APROVACAO_MANUAL','TRUE','Aprovação manual'],['NOTIFICACAO_EMAIL','TRUE','Notificações por e-mail'],['NOTIFICACAO_WHATSAPP','FALSE','Configurar provedor antes de ativar'],['MOEDA','BRL','Moeda']].forEach(r=>{if(!known.includes(r[0]))c.appendRow(r);});
return{ok:true,abasCriadas:criadas,totalAbas:15};}
function onOpen(){SpreadsheetApp.getUi().createMenu('ProjServiços').addItem('Criar/verificar abas','setupSistema').addToUi();}

/************************************************************
 * ARQUIVO ORIGINAL: Testes.gs
 ************************************************************/

/**
 * Testes estruturais e de regras puras do ProjServiços.
 * Não cria, altera ou apaga dados de clientes/agendamentos.
 * Execute setupSistema() primeiro e depois executarTestesEstruturais().
 */
function executarTestesEstruturais() {
  const inicio = new Date();
  const aprovados = [];
  const falhas = [];
  function verificar(nome, fn) {
    try {
      const resultado = fn();
      if (resultado === false) throw new Error('Condição não atendida.');
      aprovados.push(nome);
    } catch (e) {
      falhas.push({ teste: nome, erro: String(e && e.message || e) });
    }
  }

  verificar('Planilha ativa', function () {
    if (!SpreadsheetApp.getActiveSpreadsheet()) throw new Error('Projeto não está vinculado a uma planilha.');
  });
  verificar('15 abas declaradas', function () {
    if (Object.keys(SHEET_SCHEMAS).length !== 15) throw new Error('Esperadas 15 abas; encontradas ' + Object.keys(SHEET_SCHEMAS).length + '.');
  });

  Object.keys(SHEET_SCHEMAS).forEach(function (nome) {
    verificar('Aba e cabeçalhos: ' + nome, function () {
      const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
      if (!aba) throw new Error('Aba ausente. Execute setupSistema().');
      const esperado = SHEET_SCHEMAS[nome];
      const atual = aba.getRange(1, 1, 1, esperado.length).getValues()[0].map(String);
      const divergencias = esperado.filter(function (coluna, i) { return atual[i] !== coluna; });
      if (divergencias.length) throw new Error('Cabeçalhos ausentes ou fora de ordem: ' + divergencias.join(', '));
    });
  });

  verificar('Configuração de antecedência mínima', function () {
    const v = Number(configValor_('ANTECEDENCIA_MINIMA_HORAS', NaN));
    if (!isFinite(v) || v < 0) throw new Error('Valor inválido.');
  });
  verificar('Configuração de antecedência máxima', function () {
    const v = Number(configValor_('ANTECEDENCIA_MAXIMA_DIAS', NaN));
    if (!isFinite(v) || v < 1) throw new Error('Valor inválido.');
  });
  verificar('Conversão de horário válida', function () {
    if (minutosHora_('09:30') !== 570 || minutosHora_('23:59') !== 1439) throw new Error('Conversão incorreta.');
  });
  verificar('Rejeição de horário inválido', function () {
    let rejeitou = false;
    try { minutosHora_('25:00'); } catch (e) { rejeitou = true; }
    if (!rejeitou) throw new Error('Um horário inválido foi aceito.');
  });
  verificar('Dia da semana (segunda-feira)', function () {
    const d = new Date(2026, 0, 5, 12, 0, 0);
    if (diaSemana_(d) !== 0) throw new Error('Segunda-feira deveria ser 0.');
  });
  verificar('Normalização de e-mail', function () {
    if (normalizarEmail_('  TESTE@EXEMPLO.COM ') !== 'teste@exemplo.com') throw new Error('Normalização incorreta.');
  });
  verificar('Rejeição de e-mail inválido', function () {
    let rejeitou = false;
    try { normalizarEmail_('email-invalido'); } catch (e) { rejeitou = true; }
    if (!rejeitou) throw new Error('E-mail inválido foi aceito.');
  });
  verificar('Políticas de recuperação configuradas', function () {
    if (AUTH_CONFIG.RECOVERY_MAX_ATTEMPTS !== 5 || AUTH_CONFIG.RECOVERY_TTL_SECONDS !== 900 || AUTH_CONFIG.RECOVERY_REQUEST_WINDOW_SECONDS !== 60 || AUTH_CONFIG.RECOVERY_GLOBAL_LIMIT < 1) throw new Error('Limites de recuperação ausentes ou inválidos.');
  });
  verificar('Derivação de senha consistente', function () {
    const a = derivarSenha_('Senha-de-teste-123', 'salt-de-teste');
    const b = derivarSenha_('Senha-de-teste-123', 'salt-de-teste');
    const c = derivarSenha_('Senha-de-teste-123', 'outro-salt');
    if (a !== b || a === c || a.length < 20) throw new Error('Derivação inconsistente.');
  });

  const relatorio = {
    ok: falhas.length === 0,
    aprovados: aprovados.length,
    falhas: falhas.length,
    testesAprovados: aprovados,
    detalhesFalhas: falhas,
    executadoEm: Utilities.formatDate(inicio, APP_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
  };
  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}


/************************************************************
 * ARQUIVO ORIGINAL: TestesPermissoes.gs
 ************************************************************/

/**
 * Testes unitários das regras de escopo e autorização.
 * Usam somente fixtures fictícias em memória; não leem nem alteram a planilha.
 * Execute executarTestesPermissoes().
 */
function executarTestesPermissoes() {
  const aprovados = [], falhas = [];
  function testar(nome, fn) {
    try { fn(); aprovados.push(nome); }
    catch (e) { falhas.push({teste:nome, erro:String(e && e.message || e)}); }
  }
  function igual(a,b,msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || ('Esperado '+JSON.stringify(b)+'; recebido '+JSON.stringify(a)));
  }
  const agenda = [
    {ID:'A1',CLIENTE_ID:'C1'}, {ID:'A2',CLIENTE_ID:'C2'}, {ID:'A3',CLIENTE_ID:'C1'}
  ];
  const itens = [
    {AGENDAMENTO_ID:'A1',FUNCIONARIO_ID:'F1'},
    {AGENDAMENTO_ID:'A2',FUNCIONARIO_ID:'F2'},
    {AGENDAMENTO_ID:'A3',FUNCIONARIO_ID:'F2'}
  ];
  testar('Cliente vê somente seus agendamentos', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'CLIENTE',REFERENCIA_ID:'C1'}).map(x=>x.ID),['A1','A3']);
  });
  testar('Funcionário vê somente sua agenda', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'}).map(x=>x.ID),['A2','A3']);
  });
  testar('Administrador vê todas as agendas sem filtro', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'ADMINISTRADOR',REFERENCIA_ID:''}).map(x=>x.ID),['A1','A2','A3']);
  });
  testar('Administrador pode filtrar por funcionário', function() {
    igual(filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'ADMINISTRADOR'},'F1').map(x=>x.ID),['A1']);
  });
  testar('Funcionário não vê clientes de outros profissionais', function() {
    igual(idsClientesVisiveisFuncionario_('F1',agenda,itens),['C1']);
  });
  testar('Administrador pode gerenciar qualquer agendamento', function() {
    if (!podeGerenciarAgendamento_('A2',itens,{PERFIL:'ADMINISTRADOR'})) throw new Error('Ação administrativa deveria ser permitida.');
  });
  testar('Funcionário só gerencia agendamento próprio', function() {
    if (!podeGerenciarAgendamento_('A2',itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'})) throw new Error('Ação própria deveria ser permitida.');
    if (podeGerenciarAgendamento_('A1',itens,{PERFIL:'FUNCIONARIO',REFERENCIA_ID:'F2'})) throw new Error('Ação de outro profissional foi permitida.');
  });
  testar('Cliente não pode aprovar ou rejeitar agendamento', function() {
    if (podeGerenciarAgendamento_('A1',itens,{PERFIL:'CLIENTE',REFERENCIA_ID:'C1'})) throw new Error('Cliente recebeu permissão administrativa.');
  });
  testar('Perfil desconhecido não recebe agenda', function() {
    let bloqueou=false;
    try { filtrarAgendamentosPorUsuario_(agenda,itens,{PERFIL:'DESCONHECIDO'}); } catch(e) { bloqueou=true; }
    if (!bloqueou) throw new Error('Perfil desconhecido recebeu dados.');
  });
  const relatorio={ok:falhas.length===0,aprovados:aprovados.length,falhas:falhas.length,testesAprovados:aprovados,detalhesFalhas:falhas};
  Logger.log(JSON.stringify(relatorio,null,2));
  return relatorio;
}


/************************************************************
 * ARQUIVO ORIGINAL: Web.gs
 ************************************************************/

function doGet(){setupSistema();return HtmlService.createHtmlOutputFromFile('Index').setTitle(APP_CONFIG.NAME).addMetaTag('viewport','width=device-width, initial-scale=1');}
function include(n){return HtmlService.createHtmlOutputFromFile(n).getContent();}