export const swaggerUiHtml = (specUrl = '/api-docs/openapi.json') => [
  '<!doctype html><html lang="en"><head><meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  '<title>DOYBIZ API Documentation</title>',
  '<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />',
  '</head><body><div id="swagger-ui"></div>',
  '<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>',
  '<script>window.onload=()=>{window.ui=SwaggerUIBundle({url:', JSON.stringify(specUrl),
  ',dom_id:"#swagger-ui",deepLinking:true,persistAuthorization:true,presets:[SwaggerUIBundle.presets.apis]});};</script>',
  '</body></html>',
].join('');
