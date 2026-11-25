const SHEET_SCHEMAS={
CLIENTES:['ID','NOME','TELEFONE','EMAIL','CRIADO_EM','ATIVO','OBSERVACOES'],
FUNCIONARIOS:['ID','NOME','TELEFONE','EMAIL','ESPECIALIDADES','ATIVO','CRIADO_EM'],
USUARIOS:['ID','REFERENCIA_ID','NOME_EXIBICAO','EMAIL','PERFIL','SENHA_HASH','SENHA_SALT','ATIVO','CRIADO_EM','ULTIMO_ACESSO'],
CATEGORIAS:['ID','NOME','DESCRICAO','ATIVA'],
SERVICOS:['ID','CATEGORIA_ID','NOME','DESCRICAO','ATIVO'],
FUNCIONARIO_SERVICOS:['ID','FUNCIONARIO_ID','SERVICO_ID','PRECO','ATIVO'],
AGENDAMENTOS:['ID','CLIENTE_ID','INICIO','FIM','STATUS','RECORRENCIA_ID','RECORRENCIA_TIPO','OBSERVACOES','CRIADO_POR','CRIADO_EM','ATUALIZADO_EM'],
ITENS_AGENDAMENTO:['ID','AGENDAMENTO_ID','SERVICO_ID','FUNCIONARIO_ID','DURACAO_MINUTOS','PRECO_BASE','DESCONTO_TIPO','DESCONTO_VALOR','PRECO_FINAL','ORDEM'],
HORARIOS_FUNCIONARIOS:['ID','FUNCIONARIO_ID','DIA_SEMANA','HORA_INICIO','HORA_FIM','ATIVO'],
INTERVALOS:['ID','FUNCIONARIO_ID','DIA_SEMANA','HORA_INICIO','HORA_FIM','DESCRICAO','ATIVO'],
BLOQUEIOS:['ID','FUNCIONARIO_ID','INICIO','FIM','MOTIVO','CRIADO_POR'],
LISTA_ESPERA:['ID','CLIENTE_ID','SERVICO_ID','FUNCIONARIO_ID','INICIO_DESEJADO','FIM_DESEJADO','STATUS','CRIADO_EM'],
PAGAMENTOS:['ID','AGENDAMENTO_ID','STATUS','VALOR','FORMA','DATA_PAGAMENTO','OBSERVACOES'],
NOTIFICACOES:['ID','AGENDAMENTO_ID','CLIENTE_ID','CANAL','EVENTO','DESTINO','STATUS','DETALHE','CRIADO_EM'],
CONFIG:['CHAVE','VALOR','DESCRICAO']};
function setupSistema(){
const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Vincule este projeto a uma planilha Google.');
const criadas=[];
Object.keys(SHEET_SCHEMAS).forEach(n=>{let s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);criadas.push(n);}
const h=SHEET_SCHEMAS[n];if(s.getLastRow()===0){s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);s.getRange(1,1,1,h.length).setFontWeight('bold');}
else{const old=s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0].map(String);const add=h.filter(x=>!old.includes(x));if(add.length)s.getRange(1,old.length+1,1,add.length).setValues([add]);s.setFrozenRows(1);}});
const c=ss.getSheetByName('CONFIG'),known=c.getLastRow()>1?c.getRange(2,1,c.getLastRow()-1,1).getValues().flat():[];
[['ANTECEDENCIA_MINIMA_HORAS','2','Antecedência mínima'],['ANTECEDENCIA_MAXIMA_DIAS','60','Antecedência máxima'],['APROVACAO_MANUAL','TRUE','Aprovação manual'],['NOTIFICACAO_EMAIL','TRUE','Notificações por e-mail'],['NOTIFICACAO_WHATSAPP','FALSE','Configurar provedor antes de ativar'],['MOEDA','BRL','Moeda']].forEach(r=>{if(!known.includes(r[0]))c.appendRow(r);});
return{ok:true,abasCriadas:criadas,totalAbas:15};}
function onOpen(){SpreadsheetApp.getUi().createMenu('ProjServiços').addItem('Criar/verificar abas','setupSistema').addToUi();}