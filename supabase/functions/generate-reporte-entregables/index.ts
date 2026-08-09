import { handleDocumentGeneration } from '../_shared/document-workflow.ts';

Deno.serve((request) => handleDocumentGeneration(request, {
  documentType: 'reporte_entregables', templateId: 'reporte-entregables', titlePrefix: 'Reporte de entregables',
  expectedTemplateSha256: 'c6df020f459e3f4eb65a605f72859569bb81ba338f9c88203ac5cafee16376d8',
}));
