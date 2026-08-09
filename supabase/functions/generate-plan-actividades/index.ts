import { handleDocumentGeneration } from '../_shared/document-workflow.ts';

Deno.serve((request) => handleDocumentGeneration(request, {
  documentType: 'plan_actividades', templateId: 'plan-actividades', titlePrefix: 'Plan de actividades',
  expectedTemplateSha256: 'b1667448c4d61b2ff61fcc8d66e56d6483dcf3109e8cc6ebf8a028b1a2a65ab0',
}));
