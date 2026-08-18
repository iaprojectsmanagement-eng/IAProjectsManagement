import { handleDocumentGeneration } from '../_shared/document-workflow.ts';

Deno.serve((request) => handleDocumentGeneration(request, {
  documentType: 'acta_reunion', templateId: 'acta', titlePrefix: 'Acta de reunión',
  expectedTemplateSha256: '11f84c664a44d6f4a1f05b7eab5db529594fc931e0953ab00444bb1a0b5e5f2f',
}));
