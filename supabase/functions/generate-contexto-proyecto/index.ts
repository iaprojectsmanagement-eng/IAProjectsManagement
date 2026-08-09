import { handleDocumentGeneration } from '../_shared/document-workflow.ts';

Deno.serve((request) => handleDocumentGeneration(request, {
  documentType: 'contexto_proyecto', templateId: 'contexto-proyecto', titlePrefix: 'Contexto del proyecto',
  expectedTemplateSha256: '00365211c7d1c5d0afb9b2d0cd34cedec7d14cf8941103cd551f83b7ec91e328',
}));
