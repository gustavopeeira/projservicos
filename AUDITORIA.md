# Revisão técnica — ProjServiços

Data: 2026-11-25 (revisão incremental)
Branch: feature/estrutura-inicial

## Escopo revisado
Leitura estática dos arquivos Apps Script e da interface disponíveis na branch. Não houve execução no runtime Google Apps Script nem acesso a uma planilha real.

## Pontos positivos observados
- Separação inicial por responsabilidade em arquivos .gs e HTML.
- Validação de perfil no servidor em operações sensíveis.
- Filtro de agendamentos por cliente/funcionário nas consultas principais.
- Verificação de expediente, intervalos, bloqueios e sobreposição.
- LockService no fluxo de criação de agendamento.
- Senhas não são armazenadas em texto puro.
- Recuperação não informa se o e-mail existe.

## Riscos e correções necessárias antes de produção
1. **Recuperação de senha — mitigação adicionada:** limite de uma solicitação por e-mail por minuto, limite global simples de 20 solicitações por minuto e bloqueio do código após cinco tentativas inválidas. Ainda requer teste no Apps Script e avaliação de abuso distribuído.
2. **Bootstrap administrativo:** configurar o primeiro administrador é função privada por convenção de nome; garantir que nunca seja chamada por uma função pública do HTML.
3. **Cabeçalhos de planilha:** setupSistema adiciona cabeçalhos ausentes ao final. Se uma planilha preexistente tiver colunas fora de ordem, o código que usa índices fixos pode ler/gravar campos incorretos. Usar planilha nova ou corrigir setup para validar/migrar por nome.
4. **Cadastros compostos:** funcionário/cliente e usuário são gravados em operações separadas. Falhas inesperadas entre as gravações podem deixar cadastro parcial; implementar compensação ou escrita transacional lógica.
5. **Concorrência — mitigação parcial adicionada:** criação de usuários e cadastro de funcionário com acesso agora usam LockService; o cadastro de cliente reutiliza criação interna sob o lock já adquirido. Revisar também todos os vínculos e demais cadastros.
6. **Agenda:** validar explicitamente status e datas inválidas nos registros existentes; definir política para agendamentos cancelados/recusados e fusos.
7. **Sessões:** CacheService pode expirar antes do TTL nominal e não substitui gestão de sessão persistente; comportamento precisa ser testado.
8. **Hash de senha:** revisar algoritmo, custo e comparação em avaliação independente. O código atual é uma implementação própria iterativa baseada em HMAC, não um KDF padrão auditado.
9. **Dados pessoais:** revisar minimização, retenção, acesso e consentimento antes de uso com clientes reais.

## Estado dos testes
Foi adicionado executarTestesEstruturais(), teste não destrutivo para abas, cabeçalhos, configurações e funções puras. Ele precisa ser executado no editor Apps Script vinculado a uma cópia de planilha. Não equivale a teste de integração ou segurança.

## Fora do escopo concluído
WhatsApp, recorrência, lista de espera, cancelamento/remarcação do cliente, pagamentos/descontos, calendário completo e notificações automáticas completas.
\n\n## Correções incrementais desta revisão\n- Centralizada a criação de usuário em `criarUsuario_`, com wrapper público protegido por LockService e validação de e-mail único dentro da seção crítica.\n- Bootstrap do primeiro administrador agora também usa LockService; continua sendo função privada terminada em sublinhado.\n- Recuperação de senha ganhou limite por e-mail, limite global básico, contador de tentativas inválidas e invalidação do código após cinco erros.\n- Cadastro de funcionário remove a linha recém-criada se a criação do acesso falhar; cadastro de cliente usa a rotina interna para evitar reaquisição do lock.\n- Esses controles são mitigações iniciais, não substituem testes de integração, monitoramento nem auditoria independente. CacheService pode expirar itens antes do prazo e os limites globais são compartilhados pelo script.\n

## Revisão de autorização e exposição de dados — 2026-11-25
- listarClientes exige perfil administrador ou funcionário; cliente não recebe a listagem global.
- consultarAgenda filtra registros por cliente ou funcionário no servidor.
- obterDadosPainel filtra agenda por vínculo antes de montar os dados exibidos.
- listarFuncionarios é restrita ao administrador.
- listarServicos exige sessão válida e retorna apenas o catálogo de serviços.
- O vínculo de acesso de cliente agora é verificado e criado dentro do mesmo bloqueio de concorrência.
- Limitação: consultarAgenda retorna os registros completos da aba AGENDAMENTOS dentro do escopo autorizado; considerar DTO explícito com campos permitidos.
- O sufixo _ é convenção do Apps Script para impedir chamadas diretas via google.script.run; a segurança também depende de validações no servidor.
- Revisão estática, sem testes de isolamento no runtime Apps Script.


## Testes de permissão adicionados — 2026-11-25
- Criado `TestesPermissoes.gs` com nove casos unitários usando apenas dados fictícios em memória.
- As regras compartilhadas de escopo foram extraídas para `filtrarAgendamentosPorUsuario_` e são usadas pela consulta de agenda e pelo painel.
- Funcionários agora recebem na listagem somente clientes associados a agendamentos atribuídos ao próprio funcionário.
- A autorização para confirmar/rejeitar foi centralizada em `podeGerenciarAgendamento_`; cliente não tem permissão e funcionário só pode gerir itens da própria agenda.
- Revisão do código e conferência dos arquivos no GitHub concluídas. Os nove casos ainda precisam ser executados no Apps Script; não há runtime Google Sheets disponível nesta sessão.
