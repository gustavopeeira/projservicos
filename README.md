# ProjServiços

## Configuração
1. Crie uma planilha Google, abra Extensões → Apps Script e copie os arquivos do projeto.
2. Execute `setupSistema()` e autorize.
3. Execute no editor `configurarPrimeiroAdministrador_('email@exemplo.com','Senha-forte-com-10+','Administrador')`.
4. Execute `executarTestesEstruturais()` e confira o relatório no registro de execução.
5. Entre no painel, cadastre funcionários/serviços e configure os horários de trabalho.
6. Faça testes com usuários fictícios antes de publicar o aplicativo da web.

## Contas de acesso
O administrador pode criar usuário vinculado ao cadastro de funcionário ou cliente. Cada conta recebe e-mail e senha inicial definidos no cadastro administrativo; entregue a senha ao titular por canal seguro e oriente a troca após o primeiro acesso. O e-mail de login deve ser único.

## Regras de disponibilidade
- HORARIOS_FUNCIONARIOS: um registro por faixa de expediente, dia 0=segunda a 6=domingo.
- INTERVALOS: faixas de pausa por dia, no mesmo padrão.
- BLOQUEIOS: indisponibilidades com início/fim completos.
- CONFIG controla ANTECEDENCIA_MINIMA_HORAS e ANTECEDENCIA_MAXIMA_DIAS.
- A criação exige que o horário inteiro caiba em uma faixa de expediente, não cruze intervalo, bloqueio nem outro agendamento ativo.
- O teste de conflito é protegido por LockService para reduzir colisões simultâneas.

## Testes e limites
`executarTestesEstruturais()` valida as 15 abas, a ordem dos cabeçalhos, configurações e algumas regras puras. Ele não cria dados de teste nem substitui testes de integração no Apps Script/planilha.

Ainda faltam testes de ponta a ponta para login, permissões, criação/aprovação de agendamentos e concorrência. O teste estrutural deve ser executado em uma cópia da planilha antes de qualquer publicação.

## Segurança e pendências conhecidas
- O hash atual de senha é uma derivação iterativa HMAC implementada no projeto; precisa de revisão independente antes de produção. Não é um KDF padrão auditado.
- A recuperação envia código por e-mail, limita solicitações por endereço e aplica um limite global básico; o código é invalidado após cinco tentativas inválidas. Os limites em CacheService são mitigação inicial e precisam de teste/monitoramento.
- Revisar implantação do Web App, permissões OAuth, exposição de dados por perfil, política de backups e requisitos de privacidade.
- Não há integração real com WhatsApp configurada; requer provedor externo.
- Recorrência, lista de espera, remarcação/cancelamento pelo cliente, pagamentos/descontos e navegação completa do calendário ainda não estão concluídos.
- Notificações e relatórios precisam de validação funcional.
- Não publique em produção antes dos testes e da revisão de segurança.


### Testes de permissões
Execute `executarTestesPermissoes()` para validar as regras de escopo com dados fictícios em memória. Esse teste não cria nem altera registros na planilha. Ele verifica o isolamento de agenda de clientes e funcionários, o filtro administrativo, a lista de clientes visível ao funcionário e as permissões de aprovação.
