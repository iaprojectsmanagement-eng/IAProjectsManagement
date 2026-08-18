import contextoHtml from '../../Plantillas/Plantilla_01. Contexto del Proyecto.html?raw';
import planHtml from '../../Plantillas/Plantilla_02.Plan de Actividades.html?raw';
import actaHtml from '../../Plantillas/Plantilla_03.Acta de Reunion.html?raw';
import reporteHtml from '../../Plantillas/Plantilla_04.Reporte de Entregables.html?raw';
import { DocumentTemplate, InstitutionalDocumentType } from '../types';

export interface InstitutionalTemplateDefinition extends DocumentTemplate {
  documentType: InstitutionalDocumentType;
  edgeFunction: string;
  acceptedSources: string;
  sourceHelp: string;
  baseTemplateSha256: string;
  originalDocxName: string;
}

export const INSTITUTIONAL_TEMPLATES: InstitutionalTemplateDefinition[] = [
  {
    id: 'contexto-proyecto',
    documentType: 'contexto_proyecto',
    name: 'Contexto del proyecto',
    description: 'Problema, oportunidad de IA, objetivos, alcance, restricciones y equipo.',
    category: 'requerimientos',
    requiredFields: ['problema', 'oportunidad_ia', 'objetivos', 'alcance', 'restricciones'],
    htmlTemplate: contextoHtml,
    isActive: true,
    version: 1,
    edgeFunction: 'generate-contexto-proyecto',
    acceptedSources: '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    sourceHelp: 'Adjunta levantamientos, propuestas, notas o documentos base del proyecto.',
    baseTemplateSha256: '00365211c7d1c5d0afb9b2d0cd34cedec7d14cf8941103cd551f83b7ec91e328',
    originalDocxName: '01. Contexto del Proyecto.docx',
  },
  {
    id: 'plan-actividades',
    documentType: 'plan_actividades',
    name: 'Plan de actividades',
    description: 'Actividades, responsables, fechas, hitos y riesgos del proyecto.',
    category: 'seguimiento',
    requiredFields: ['actividades', 'responsables', 'fechas', 'hitos', 'riesgos'],
    htmlTemplate: planHtml,
    isActive: true,
    version: 1,
    edgeFunction: 'generate-plan-actividades',
    acceptedSources: '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    sourceHelp: 'Adjunta cronogramas, compromisos, requerimientos o notas de planeación.',
    baseTemplateSha256: 'b1667448c4d61b2ff61fcc8d66e56d6483dcf3109e8cc6ebf8a028b1a2a65ab0',
    originalDocxName: '02.Plan de Actividades.docx',
  },
  {
    id: 'acta',
    documentType: 'acta_reunion',
    name: 'Acta de reunión',
    description: 'Datos, asistentes, agenda, decisiones, pendientes y compromisos.',
    category: 'seguimiento',
    requiredFields: ['transcripcion', 'fecha', 'asistentes', 'decisiones', 'compromisos'],
    htmlTemplate: actaHtml,
    isActive: true,
    version: 1,
    edgeFunction: 'generate-acta-reunion',
    acceptedSources: '.txt,.vtt,text/plain,text/vtt',
    sourceHelp: 'Usa la transcripción TXT/VTT de la reunión; el acta permanece ligada a este proyecto.',
    baseTemplateSha256: '11f84c664a44d6f4a1f05b7eab5db529594fc931e0953ab00444bb1a0b5e5f2f',
    originalDocxName: '03.Acta de Reunion.docx',
  },
  {
    id: 'reporte-entregables',
    documentType: 'reporte_entregables',
    name: 'Reporte de entregables',
    description: 'Avance, hitos, entregables, resultados, bloqueos y próximos pasos.',
    category: 'entrega',
    requiredFields: ['avance', 'hitos', 'entregables', 'resultados', 'bloqueos'],
    htmlTemplate: reporteHtml,
    isActive: true,
    version: 1,
    edgeFunction: 'generate-reporte-entregables',
    acceptedSources: '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
    sourceHelp: 'Adjunta evidencias, informes, entregables o notas de avance.',
    baseTemplateSha256: 'c6df020f459e3f4eb65a605f72859569bb81ba338f9c88203ac5cafee16376d8',
    originalDocxName: '04.Reporte de Entregables.docx',
  },
];

export const templateById = (templateId: string) => INSTITUTIONAL_TEMPLATES.find((item) => item.id === templateId);
export const templateByType = (documentType: InstitutionalDocumentType) => INSTITUTIONAL_TEMPLATES.find((item) => item.documentType === documentType);

export const mergeInstitutionalTemplates = (remote: DocumentTemplate[]) => INSTITUTIONAL_TEMPLATES.map((base) => {
  const stored = remote.find((item) => item.id === base.id);
  if (!stored || stored.documentType !== base.documentType) return base;
  return {
    ...base,
    ...stored,
    documentType: stored.documentType || base.documentType,
    htmlTemplate: stored.htmlTemplate?.trim() ? stored.htmlTemplate : base.htmlTemplate,
    baseTemplateSha256: stored.baseTemplateSha256 || base.baseTemplateSha256,
    originalDocxName: stored.originalDocxName || base.originalDocxName,
  } satisfies InstitutionalTemplateDefinition;
});
