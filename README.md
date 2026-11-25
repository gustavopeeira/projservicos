# ProjServiços

Sistema modular de agendamentos com Google Sheets + Google Apps Script.

## Preparação
1. Crie uma planilha Google e abra **Extensões → Apps Script**.
2. Copie/sincronize os arquivos deste repositório para o projeto vinculado.
3. Execute `setupSistema()` e autorize o acesso à planilha.
4. No editor do Apps Script, execute manualmente `configurarPrimeiroAdministrador_('email@exemplo.com', 'uma-senha-forte', 'Administrador')`.
5. Cadastre funcionários, serviços e seus preços por funcionário no painel administrador.
6. Crie ou vincule os usuários de funcionário/cliente aos respectivos cadastros antes de liberar o acesso desses perfis.
7. Implante como aplicativo da web somente depois de testar as contas e permissões.

## Painéis e formulários
- Administrador: indicadores, cadastro de funcionários e serviços, clientes, agenda geral e aprovação de solicitações.
- Funcionário: agenda própria, cadastro de clientes e criação de agendamentos na própria agenda.
- Cliente: consulta dos próprios agendamentos e solicitação de novo horário.
- O formulário de agendamento solicita um serviço, profissional (ou seleção automática), data/hora, duração e observações.
- O preço é recuperado do vínculo serviço/funcionário na planilha, não aceito do navegador.
- O mesmo telefone não cria um segundo cadastro de cliente.

## Regras implementadas nesta etapa
- Agendamentos precisam ser futuros, com duração entre 5 e 720 minutos.
- O profissional precisa estar ativo e vinculado ao serviço.
- A criação verifica sobreposição com outros agendamentos ativos do profissional.
- Solicitações começam com status AGUARDANDO_APROVACAO.
- O cliente só pode agendar para o próprio cadastro; funcionário só agenda na própria agenda.
- O funcionário pode confirmar/recusar apenas agendamentos associados a ele.

## Limitações importantes
A verificação de conflito considera os agendamentos existentes, mas ainda não valida horários semanais, intervalos, bloqueios, antecedência mínima/máxima, recorrência ou lista de espera. A seleção automática escolhe o primeiro profissional vinculado que não tenha conflito no período. Cadastro de funcionário/cliente ainda não cria automaticamente usuário e senha; o administrador deve criar e vincular os acessos separadamente. Não use dados reais nem publique para clientes antes de testar permissões e regras de agenda de ponta a ponta.
