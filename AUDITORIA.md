# Revisão técnica — ProjServiços

Data: 2026-11-25
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
1. **Recuperação de senha:** há limite de solicitação por endereço, mas não há limite de tentativas de validação do código nem limitação global suficiente contra abuso de envio.
2. **Bootstrap administrativo:** configurar o primeiro administrador é função privada por convenção de nome; garantir que nunca seja chamada por uma função pública do HTML.
3. **Cabeçalhos de planilha:** setupSistema adiciona cabeçalhos ausentes ao final. Se uma planilha preexistente tiver colunas fora de ordem, o código que usa índices fixos pode ler/gravar campos incorretos. Usar planilha nova ou corrigir setup para validar/migrar por nome.
4. **Cadastros compostos:** funcionário/cliente e usuário são gravados em operações separadas. Falhas inesperadas entre as gravações podem deixar cadastro parcial; implementar compensação ou escrita transacional lógica.
5. **Concorrência:** LockService protege agendamento, mas não todos os cadastros e vínculos únicos. Aplicar bloqueio em operações de criação de usuários e vínculos.
6. **Agenda:** validar explicitamente status e datas inválidas nos registros existentes; definir política para agendamentos cancelados/recusados e fusos.
7. **Sessões:** CacheService pode expirar antes do TTL nominal e não substitui gestão de sessão persistente; comportamento precisa ser testado.
8. **Hash de senha:** revisar algoritmo, custo e comparação em avaliação independente. O código atual é uma implementação própria iterativa baseada em HMAC, não um KDF padrão auditado.
9. **Dados pessoais:** revisar minimização, retenção, acesso e consentimento antes de uso com clientes reais.

## Estado dos testes
Foi adicionado executarTestesEstruturais(), teste não destrutivo para abas, cabeçalhos, configurações e funções puras. Ele precisa ser executado no editor Apps Script vinculado a uma cópia de planilha. Não equivale a teste de integração ou segurança.

## Fora do escopo concluído
WhatsApp, recorrência, lista de espera, cancelamento/remarcação do cliente, pagamentos/descontos, calendário completo e notificações automáticas completas.
