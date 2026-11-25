# ProjServiços

Sistema modular de agendamentos com Google Sheets + Google Apps Script.

## Preparação
1. Crie uma planilha Google e abra **Extensões → Apps Script**.
2. Copie os arquivos deste repositório para o projeto vinculado.
3. Execute `setupSistema()` e autorize o acesso à planilha.
4. No editor do Apps Script, execute manualmente `configurarPrimeiroAdministrador_('email@exemplo.com', 'uma-senha-forte', 'Administrador')`. A função termina em underscore para não ficar acessível pelo navegador.
5. Faça login pela função de servidor `entrar(email, senha)`. Guarde o token retornado no cliente e envie-o como último argumento em cada operação protegida.
6. Publique somente depois de criar a interface de login e testar as permissões com contas de cada perfil.

## Perfis
- **ADMINISTRADOR:** gerencia cadastros, usuários, agenda e relatórios.
- **FUNCIONARIO:** consulta sua própria agenda e realiza operações permitidas para equipe.
- **CLIENTE:** cria agendamentos apenas para o próprio cadastro e consulta somente os próprios agendamentos.

As operações protegidas recebem o token de sessão explicitamente. Sessões expiram após 6 horas; sair invalida o token. Senhas são derivadas com HMAC-SHA-256 iterado e salt individual. A senha nunca é devolvida ao navegador.

## Limitações desta etapa
A autenticação e as verificações de perfil estão implementadas no servidor, mas ainda faltam a interface de login, recuperação de senha, testes automatizados no Apps Script e revisão de segurança antes de disponibilizar o sistema ao público. A sessão em cache pode expirar antes do prazo nominal. Não use dados reais de clientes até concluir os testes.
