# ProjServiços

## Configuração
1. Crie uma planilha Google, abra Extensões → Apps Script e copie os arquivos.
2. Execute \`setupSistema()\` e autorize.
3. Execute no editor \`configurarPrimeiroAdministrador_('email@exemplo.com','Senha-forte-com-10+','Administrador')\`.
4. Entre no painel, cadastre funcionários/serviços e configure os horários de trabalho.
5. Faça testes com usuários fictícios antes de publicar o aplicativo da web.

## Contas de acesso
O administrador pode criar usuário vinculado ao cadastro de funcionário ou cliente. Cada conta recebe e-mail e senha inicial definidos no cadastro administrativo; entregue a senha ao titular por canal seguro e oriente a troca após o primeiro acesso. O e-mail de login deve ser único.

## Regras de disponibilidade
- HORARIOS_FUNCIONARIOS: um registro por faixa de expediente, dia 0=segunda a 6=domingo.
- INTERVALOS: faixas de pausa por dia, no mesmo padrão.
- BLOQUEIOS: indisponibilidades com início/fim completos.
- CONFIG controla ANTECEDENCIA_MINIMA_HORAS e ANTECEDENCIA_MAXIMA_DIAS.
- A criação exige que o horário inteiro caiba em uma faixa de expediente, não cruze intervalo, bloqueio nem outro agendamento ativo.
- O teste de conflito é protegido por LockService para reduzir colisões simultâneas.

## Segurança e limites
Clientes só podem criar agendamentos para o próprio cadastro; funcionários ficam limitados à própria agenda; administração cria e vincula contas. O backend é a autoridade para preços e permissões. Ainda é necessário testar em cópia da planilha, revisar permissões de implantação, proteção contra abuso de recuperação de senha, backups e requisitos legais de privacidade. O hash atual de senha deve ser auditado antes de produção; a implementação não substitui revisão de segurança profissional.
