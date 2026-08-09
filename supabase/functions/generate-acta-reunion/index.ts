import { handleDocumentGeneration } from '../_shared/document-workflow.ts';

Deno.serve((request) => handleDocumentGeneration(request, {
  documentType: 'acta_reunion', templateId: 'acta', titlePrefix: 'Acta de reunión',
  expectedTemplateSha256: 'aa928f827dc30ff3bb11d0037cc38627c2e70a1a9c7ab5498215fa1d96fd9e3c',
}));
