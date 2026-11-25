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


/**
 * Assistente de criação da primeira conta administrativa.
 * Execute pelo editor do Apps Script, nunca pela interface pública.
 * Só funciona enquanto não existir nenhum administrador.
 */
function criarPrimeiroAdministrador() {
  const ui = SpreadsheetApp.getUi();

  if (records_('USUARIOS').some(function (u) {
    return String(u.PERFIL || '').toUpperCase() === 'ADMINISTRADOR';
  })) {
    ui.alert('Já existe um administrador cadastrado. Nenhuma alteração foi feita.');
    return;
  }

  const nome = ui.prompt('Primeiro administrador', 'Digite o nome de exibição:', ui.ButtonSet.OK_CANCEL);
  if (nome.getSelectedButton() !== ui.Button.OK) return;

  const email = ui.prompt('Primeiro administrador', 'Digite o e-mail de acesso:', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK) return;

  const senha = ui.prompt('Primeiro administrador', 'Crie uma senha com pelo menos 10 caracteres:', ui.ButtonSet.OK_CANCEL);
  if (senha.getSelectedButton() !== ui.Button.OK) return;

  try {
    const resultado = configurarPrimeiroAdministrador_(
      email.getResponseText(),
      senha.getResponseText(),
      nome.getResponseText()
    );
    ui.alert('Administrador cadastrado: ' + resultado.email);
  } catch (erro) {
    ui.alert('Não foi possível criar o administrador: ' + String(erro.message || erro));
  }
}
