# ProjServiços

Sistema modular de agendamentos com Google Sheets + Google Apps Script.

## Preparação
1. Crie uma planilha Google e abra **Extensões → Apps Script**.
2. Copie/sincronize os arquivos deste repositório para o projeto vinculado.
3. Execute `setupSistema()` e autorize o acesso à planilha.
4. No editor do Apps Script, execute manualmente `configurarPrimeiroAdministrador_('email@exemplo.com', 'uma-senha-forte', 'Administrador')`.
5. Implante como aplicativo da web somente depois de testar as contas e permissões.

## Painéis
- **Administrador:** indicadores, faturamento previsto e agenda geral; pode confirmar ou recusar solicitações pendentes.
- **Funcionário:** visualiza os atendimentos associados ao seu cadastro; pode confirmar ou recusar os próprios pendentes.
- **Cliente:** visualiza somente os próprios agendamentos.
- Os painéis mostram agendamentos dos próximos 31 dias e permitem atualizar a listagem.

## Acesso
Login por e-mail e senha; recuperação por código enviado ao e-mail cadastrado; sessões em cache com validade nominal de até 6 horas. Senhas de 10 a 128 caracteres são armazenadas com hash e salt individual.

## Limitações
Esta entrega cria os painéis iniciais e ações de aprovação/recusa. Ainda faltam formulários completos de cadastro e criação de agendamentos, edição de horários, notificações integradas e testes automatizados. A sessão em cache pode expirar antes do prazo nominal. Não publique nem use dados reais de clientes antes de testar permissões, regras de agenda e fluxo de ponta a ponta.
