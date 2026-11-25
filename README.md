# ProjServiços

Sistema modular de agendamentos com Google Sheets + Google Apps Script.

## Preparação
1. Crie uma planilha Google e abra **Extensões → Apps Script**.
2. Copie/sincronize os arquivos deste repositório para o projeto vinculado.
3. Execute `setupSistema()` e autorize o acesso à planilha.
4. No editor do Apps Script, execute manualmente `configurarPrimeiroAdministrador_('email@exemplo.com', 'uma-senha-forte', 'Administrador')`. A função termina em underscore para não ficar acessível pelo navegador.
5. Implante como aplicativo da web somente após testar as contas e permissões.

## Acesso
- Login por e-mail e senha.
- Sessões armazenadas em cache por até 6 horas e encerradas ao sair.
- Recuperação por código enviado ao e-mail cadastrado; código válido por 15 minutos.
- Senhas exigem 10 a 128 caracteres e são armazenadas como hash com salt individual.
- Perfis: ADMINISTRADOR, FUNCIONARIO e CLIENTE.

## Limitações e segurança
A tela de login e a recuperação por e-mail estão implementadas. A área autenticada ainda é apenas uma confirmação de sessão; os painéis completos de administração, equipe e cliente serão desenvolvidos em etapas posteriores. A recuperação depende da autorização do serviço MailApp no Apps Script e de uma conta Google com envio disponível. Cache pode expirar antes do prazo nominal. Não use dados reais nem publique para clientes antes de testar o fluxo e revisar as operações protegidas.
