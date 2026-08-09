export type UserRole = 'superuser' | 'student_group' | 'company_contact';

export type RiskLevel = 'verde' | 'amarillo' | 'rojo';

export interface Student {
  id: string;
  name: string;
  email: string;
  code?: string;
  projectId?: string | null;
  /** A deactivated profile is retained for auditing, but is not assignable. */
  isActive?: boolean;
}

export interface CompanyContact {
  name: string;
  email: string;
  phone?: string;
}

export interface ProjectResourceLink {
  id: string;
  label: string;
  url: string;
}

export interface Project {
  id: string;
  code: string; // ej: '3_CEM', '6_PMO'
  companyName: string;
  title: string;
  challengeDescription?: string;
  whatsappUrl?: string;
  teamsMeetingUrl?: string;
  sharedFolderName?: string;
  progressStatus?: string; // ej: 'Terminado', '80%', '30%', 'No se ha definido'
  progressPct: number; // 0 - 100
  riskLevel: RiskLevel;
  minStudents: number;
  maxStudents: number;
  
  // Organization Contacts
  contacts: CompanyContact[];
  
  // Assigned Students
  assignedStudents: Student[];
  assignedStudentsCount?: number;
  
  // Characterization (Optional)
  aiType: string[]; // ['IA Generativa', 'Clasificación', 'Agentes', etc.]
  copImpactDescription?: string;
  copImpactAnnual?: number; // Numeric value in COP
  impactRating?: number; // 1-10
  complexityRating: number; // 1-10
  aiRisks?: string;
  requiredDatasets?: string;
  dataQualityAvailability?: string;
  techViability?: string;
  
  // Resource Links (Optional)
  githubUrl?: string;
  driveFolderUrl?: string;
  videoUrl?: string;
  pptUrl?: string;
  finalReportUrl?: string;
  baselineDocUrl?: string;
  resourceLinks?: ProjectResourceLink[];
  
  // Activity Timeline & Empty Warning
  lastActivityAt: string; // ISO date
  emptyFieldsWarning?: boolean;
  emptyFieldsCount?: number;
}

export interface Application {
  id: string;
  projectId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: 'pendiente' | 'aceptada' | 'rechazada';
  createdAt: string;
}

export interface MeetingMinute {
  id: string;
  projectId: string;
  meetingId?: string;
  projectTitle: string;
  meetingDate: string;
  title: string;
  summary: string;
  decisions: { decision: string; date?: string }[];
  commitments: { task: string; responsible: string; dueDate?: string }[];
  risksDetected?: string;
  sentiment?: 'Positivo' | 'Neutro' | 'Preocupado/Crítico';
  transcriptFileUrl?: string;
  transcriptStoragePath?: string;
  docFileUrl?: string;
  docStoragePath?: string;
  uploadedBy: string;
  attendees?: string[];
  status?: 'borrador' | 'aprobada';
  createdAt: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  type: 'context_doc' | 'technical_report' | 'ppt' | 'github_repo' | 'drive_folder' | 'video' | 'baseline' | 'weekly_acta';
  title: string;
  url: string;
  status: 'pendiente' | 'entregado' | 'aprobado';
  createdAt: string;
}

export interface AlertItem {
  id: string;
  projectId: string;
  projectCode: string;
  reportedBy: string;
  title: string;
  description: string;
  requestedResources?: string;
  severity: 'baja' | 'media' | 'alta' | 'critica';
  status: 'abierta' | 'en_proceso' | 'resuelta';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  senderRole: 'student' | 'ai' | 'superuser';
  message: string;
  isAiConsultation?: boolean;
  isReadByMonitor?: boolean;
  createdAt: string;
}

export interface FilterOptions {
  company: string;
  risk: string;
  aiType: string;
  minComplexity: number;
  maxComplexity: number;
  searchTerm: string;
}

// Operational model. These records are deliberately independent from the
// legacy project card so they can later map one-to-one to Supabase tables.
export type TaskStatus = 'pendiente' | 'en_progreso' | 'bloqueada' | 'completada';
export type TaskPriority = 'baja' | 'media' | 'alta' | 'critica';
export type IssueStatus = 'abierta' | 'en_revision' | 'esperando_tercero' | 'resuelta';
export type MeetingStatus = 'programada' | 'realizada' | 'cancelada' | 'no_realizada' | 'reprogramada';
export type DocumentStatus = 'borrador' | 'en_revision' | 'aprobado';

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeName: string;
  assigneeEmail?: string;
  dueDate?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: 'manual' | 'acta' | 'incidencia';
  evidenceUrl?: string;
  createdBy?: string;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: 'tecnico' | 'datos_accesos' | 'comunicacion' | 'equipo' | 'recursos' | 'otro';
  priority: TaskPriority;
  status: IssueStatus;
  reportedBy: string;
  reportedByEmail?: string;
  ownerName?: string;
  dueDate?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMeeting {
  id: string;
  projectId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  attendees: string[];
  agenda?: string;
  timezone?: string;
  status: MeetingStatus;
  cancellationReason?: string;
  calendarSync: 'pendiente' | 'simulado' | 'sincronizado' | 'error';
  calendarEventUrl?: string;
  minuteId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'seguimiento' | 'requerimientos' | 'entrega';
  requiredFields: string[];
  htmlTemplate?: string;
  isActive?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  documentType?: InstitutionalDocumentType;
  baseTemplateSha256?: string;
  originalDocxName?: string;
}

export type InstitutionalDocumentType = 'contexto_proyecto' | 'plan_actividades' | 'acta_reunion' | 'reporte_entregables';

export interface DocumentSourceFile {
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  extractedChars: number;
}

export interface ProjectDocumentVersion {
  id: string;
  documentId: string;
  projectId: string;
  version: number;
  title: string;
  htmlContent: string;
  pdfStoragePath?: string;
  sourceFiles: DocumentSourceFile[];
  changeRequest?: string;
  provider: 'openai' | 'template' | 'local';
  model?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  status: DocumentStatus;
  version: number;
  generatedBy: string;
  htmlPreview: string;
  fileUrl?: string;
  storagePath?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  documentType?: InstitutionalDocumentType;
  generationStatus?: 'generando' | 'pdf_pendiente' | 'listo' | 'error';
  provider?: 'openai' | 'template' | 'local';
  model?: string;
  sourceFiles?: DocumentSourceFile[];
  pdfStoragePath?: string;
  lastChangeRequest?: string;
}

export interface ActivityItem {
  id: string;
  projectId: string;
  type: 'tarea' | 'incidencia' | 'reunion' | 'documento' | 'equipo';
  message: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  projectId?: string;
  entityType: 'project' | 'team' | 'application' | 'task' | 'issue' | 'meeting' | 'minute' | 'template' | 'document';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'assign' | 'approve' | 'status_change' | 'upload';
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
}
