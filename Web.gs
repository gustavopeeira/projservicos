/**
 * Entrada do aplicativo Web.
 * Usa template para processar as inclusões <?!= include('...') ?> do HTML.
 */
function doGet() {
  setupSistema();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_CONFIG.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inclui arquivos HTML parciais, como Styles e Scripts.
 */
function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}
