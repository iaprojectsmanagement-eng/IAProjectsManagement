import { InstitutionalTemplateDefinition, templateByType } from '../data/institutionalTemplates';
import { DocumentSourceFile, InstitutionalDocumentType, ProjectDocument, ProjectDocumentVersion } from '../types';
import { OperationsService } from './operationsService';
import { SourceExtractionService } from './sourceExtractionService';
import { StorageService } from './storageService';
import { getAuthorizationHeaders, supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

interface GenerateInput {
  projectId: string;
  documentType: InstitutionalDocumentType;
  sourceText?: string;
  sourceFiles?: DocumentSourceFile[];
  instructions?: string;
}

const iso = (value?: string | null) => value || new Date().toISOString();
const mapDocument = (row: any): ProjectDocument => ({
  id: row.id,
  projectId: row.project_id,
  templateId: row.template_id,
  documentType: row.document_type || undefined,
  title: row.title,
  status: row.status,
  version: Number(row.version || 1),
  generatedBy: row.generated_by || 'Usuario',
  htmlPreview: row.html_content,
  fileUrl: row.file_url || undefined,
  storagePath: row.storage_path || undefined,
  pdfStoragePath: row.pdf_storage_path || row.storage_path || undefined,
  generationStatus: row.generation_status || 'pdf_pendiente',
  provider: row.provider || 'template',
  model: row.model || undefined,
  sourceFiles: Array.isArray(row.source_files) ? row.source_files : [],
  lastChangeRequest: row.last_change_request || undefined,
  approvedBy: row.approved_by || undefined,
  approvedAt: row.approved_at || undefined,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});
const mapVersion = (row: any): ProjectDocumentVersion => ({
  id: row.id,
  documentId: row.document_id,
  projectId: row.project_id,
  version: Number(row.version),
  title: row.title,
  htmlContent: row.html_content,
  pdfStoragePath: row.pdf_storage_path || undefined,
  sourceFiles: Array.isArray(row.source_files) ? row.source_files : [],
  changeRequest: row.change_request || undefined,
  provider: row.provider || 'template',
  model: row.model || undefined,
  createdBy: row.created_by || undefined,
  createdAt: iso(row.created_at),
});

const callFunction = async (functionName: string, payload: Record<string, unknown>) => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const authorization = await getAuthorizationHeaders();
  if (!url || !authorization) throw new Error('Inicia sesión para usar la generación documental.');
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authorization },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `La función ${functionName} no respondió correctamente.`);
  return data;
};

const localGenerate = (input: GenerateInput, template: InstitutionalTemplateDefinition) => {
  const document = OperationsService.generateDocument(input.projectId, template.id, 'Plantilla institucional local');
  const updated = OperationsService.updateDocument(document.id, {
    documentType: input.documentType,
    provider: 'local',
    sourceFiles: input.sourceFiles || [],
    generationStatus: 'pdf_pendiente',
  }) || document;
  const version: ProjectDocumentVersion = {
    id: crypto.randomUUID(), documentId: updated.id, projectId: updated.projectId, version: updated.version,
    title: updated.title, htmlContent: updated.htmlPreview, sourceFiles: updated.sourceFiles || [], provider: 'local', createdAt: updated.createdAt,
  };
  return { document: updated, version, provider: 'local' as const, aiConfigured: false };
};

export const DocumentWorkflowService = {
  prepareSources: async (projectId: string, files: File[]) => {
    if (files.length > 8) throw new Error('Puedes adjuntar máximo 8 archivos por documento.');
    const metadata: DocumentSourceFile[] = [];
    const textParts: string[] = [];
    const warnings: string[] = [];
    for (const file of files) {
      const extracted = await SourceExtractionService.extractFile(file);
      const stored = await StorageService.uploadSourceFile(projectId, file, extracted.text);
      metadata.push({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, storagePath: stored.path, extractedChars: extracted.text.length });
      textParts.push(`\n===== ${file.name} =====\n${extracted.text}`);
      if (extracted.warning) warnings.push(`${file.name}: ${extracted.warning}`);
    }
    const combined = textParts.join('\n').slice(0, SourceExtractionService.maxCombinedChars);
    if (textParts.join('\n').length > SourceExtractionService.maxCombinedChars) warnings.push('El conjunto de fuentes se limitó a 120.000 caracteres para controlar costo y latencia.');
    return { sourceFiles: metadata, sourceText: combined, warnings };
  },
  generate: async (input: GenerateInput) => {
    const template = templateByType(input.documentType);
    if (!template) throw new Error('Tipo de documento institucional no reconocido.');
    if (!SyncService.isRemoteMode()) return localGenerate(input, template);
    const data = await callFunction(template.edgeFunction, {
      projectId: input.projectId,
      documentId: crypto.randomUUID(),
      templateHtml: template.htmlTemplate,
      sourceText: input.sourceText || '',
      sourceFiles: input.sourceFiles || [],
      instructions: input.instructions || '',
    });
    await SyncService.bootstrap();
    return { document: mapDocument(data.document), version: mapVersion(data.version), provider: data.provider, aiConfigured: Boolean(data.aiConfigured) };
  },
  revise: async (documentId: string, changeRequest: string) => {
    if (!SyncService.isRemoteMode()) throw new Error('Las revisiones automáticas requieren iniciar sesión y configurar OpenAI en Supabase.');
    const data = await callFunction('revise-project-document', { documentId, changeRequest });
    await SyncService.bootstrap();
    return { document: mapDocument(data.document), version: mapVersion(data.version), provider: data.provider };
  },
  getVersions: async (documentId: string): Promise<ProjectDocumentVersion[]> => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      const document = OperationsService.getDocuments().find((item) => item.id === documentId);
      return document ? [{ id: document.id, documentId, projectId: document.projectId, version: document.version, title: document.title, htmlContent: document.htmlPreview, pdfStoragePath: document.pdfStoragePath, sourceFiles: document.sourceFiles || [], provider: document.provider || 'local', createdAt: document.updatedAt }] : [];
    }
    const { data, error } = await supabaseClient.from('project_document_versions').select('*').eq('document_id', documentId).order('version', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapVersion);
  },
  delete: async (document: ProjectDocument) => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      OperationsService.deleteDocument(document.id);
      return;
    }
    if (document.pdfStoragePath) {
      const { error: storageError } = await supabaseClient.storage.from('project-documents').remove([document.pdfStoragePath]);
      if (storageError) throw new Error('No se pudo eliminar el PDF privado del documento.');
    }
    const { error } = await supabaseClient.from('project_documents').delete().eq('id', document.id);
    if (error) throw error;
    await SyncService.bootstrap();
  },
  attachPdf: async (document: ProjectDocument, storagePath: string) => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      return OperationsService.updateDocument(document.id, { storagePath, pdfStoragePath: storagePath, generationStatus: 'listo' });
    }
    const { error } = await supabaseClient.rpc('attach_document_pdf', { target_document_id: document.id, target_version: document.version, target_storage_path: storagePath });
    if (error) throw error;
    await SyncService.bootstrap();
    return undefined;
  },
};
