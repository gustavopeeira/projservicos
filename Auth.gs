/**
 * Autenticação e autorização do ProjServiços.
 * O bootstrap do primeiro administrador é privado (sufixo _) e deve ser executado
 * manualmente pelo editor do Apps Script, nunca pelo navegador.
 */
const AUTH_CONFIG = Object.freeze({ SESSION_TTL_SECONDS: 21600, HASH_ITERATIONS: 12000 });

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
  if (records_('USUARIOS').some(u => String(u.PERFIL).toUpperCase() === 'ADMINISTRADOR')) {
    throw new Error('Já existe administrador cadastrado.');
  }
  const e = normalizarEmail_(email), salt = gerarSalt_();
  const u = { ID:id_('USR'), REFERENCIA_ID:'', NOME_EXIBICAO:String(nome || 'Administrador').trim(),
    EMAIL:e, PERFIL:'ADMINISTRADOR', SENHA_HASH:derivarSenha_(senha,salt), SENHA_SALT:salt,
    ATIVO:true, CRIADO_EM:new Date(), ULTIMO_ACESSO:'' };
  sheet_('USUARIOS').appendRow(SHEET_SCHEMAS.USUARIOS.map(k => u[k] ?? ''));
  return { ok:true, email:e };
}
function criarUsuario(d, token) {
  exigirPerfil_(['ADMINISTRADOR'], token);
  if (!d || !['ADMINISTRADOR','FUNCIONARIO','CLIENTE'].includes(String(d.PERFIL).toUpperCase())) throw new Error('Perfil inválido.');
  const email = normalizarEmail_(d.EMAIL);
  if (usuarioPorEmail_(email)) throw new Error('Este e-mail já possui acesso.');
  const perfil = String(d.PERFIL).toUpperCase();
  if (perfil === 'CLIENTE' && !d.REFERENCIA_ID) throw new Error('Vincule o usuário ao cadastro do cliente.');
  if (perfil === 'FUNCIONARIO' && !d.REFERENCIA_ID) throw new Error('Vincule o usuário ao cadastro do funcionário.');
  const salt = gerarSalt_();
  const u = { ID:id_('USR'), REFERENCIA_ID:d.REFERENCIA_ID || '', NOME_EXIBICAO:String(d.NOME_EXIBICAO || '').trim(),
    EMAIL:email, PERFIL:perfil, SENHA_HASH:derivarSenha_(d.SENHA,salt), SENHA_SALT:salt,
    ATIVO:true, CRIADO_EM:new Date(), ULTIMO_ACESSO:'' };
  sheet_('USUARIOS').appendRow(SHEET_SCHEMAS.USUARIOS.map(k => u[k] ?? ''));
  return { id:u.ID, email:u.EMAIL, perfil:u.PERFIL };
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
function obterSessao(token) {
  const u = usuarioDaSessao_(token);
  return publicarUsuario_(u);
}
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
/** O token é enviado explicitamente por cada chamada protegida. */
function obterTokenContexto_() { throw new Error('Informe o token da sessão nesta operação.'); }
function alterarMinhaSenha(token, senhaAtual, senhaNova) {
  const u = usuarioDaSessao_(token), nova = String(senhaNova || '');
  const atual = derivarSenha_(senhaAtual, u.SENHA_SALT);
  if (atual !== String(u.SENHA_HASH)) throw new Error('Senha atual incorreta.');
  const salt = gerarSalt_(), hash = derivarSenha_(nova, salt), row = localizarLinha_('USUARIOS','ID',u.ID);
  const s = sheet_('USUARIOS');
  s.getRange(row, SHEET_SCHEMAS.USUARIOS.indexOf('SENHA_SALT')+1).setValue(salt);\n  s.getRange(row, SHEET_SCHEMAS.USUARIOS.indexOf('SENHA_HASH')+1).setValue(hash);
  CacheService.getScriptCache().remove('sessao:' + token);
  return { ok:true, mensagem:'Senha alterada. Entre novamente.' };
}
