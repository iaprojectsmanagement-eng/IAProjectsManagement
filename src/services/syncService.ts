import {
  ActivityItem,
  AuditEvent,
  Application,
  DocumentTemplate,
  MeetingMinute,
  Project,
  ProjectDocument,
  ProjectIssue,
  ProjectMeeting,
  ProjectTask,
  Student,
} from '../types';
import { supabaseClient } from './supabaseClient';

const CACHE = {
  projects: 'ia_hub_projects', students: 'ia_hub_students', applications: 'ia_hub_applications', minutes: 'ia_hub_minutes',
  tasks: 'ia_hub_operation_tasks', issues: 'ia_hub_operation_issues', meetings: 'ia_hub_operation_meetings',
  templates: 'ia_hub_operation_templates', documents: 'ia_hub_operation_documents', activity: 'ia_hub_operation_activity',
};
const OUTBOX_KEY = 'ia_hub_sync_outbox';
// Supabase is the only source of truth. The local adapter exists exclusively
// inside the automated test runner, never as an application runtime option.
const remoteMode = import.meta.env.VITE_TEST_MODE !== 'true';

type TableName = 'projects' | 'project_tasks' | 'project_issues' | 'project_meetings' | 'meeting_minutes' | 'document_templates' | 'project_documents' | 'project_activity' | 'project_applications' | 'audit_log';
type Mutation =
  | { id: string; kind: 'upsert'; table: TableName; payload: Record<string, unknown>; createdAt: string }
  | { id: string; kind: 'delete'; table: TableName; recordId: string; createdAt: string }
  | { id: string; kind: 'replace_team'; projectId: string; emails: string[]; createdAt: string }
  | { id: string; kind: 'set_profile_active'; studentId: string; isActive: boolean; createdAt: string }
  | { id: string; kind: 'accept_application'; applicationId: string; studentId: string; projectId: string; createdAt: string };

export interface SyncState {
  mode: 'local' | 'supabase';
  status: 'idle' | 'loading' | 'synced' | 'pending' | 'error';
  pending: number;
  lastSyncedAt?: string;
  error?: string;
}

let state: SyncState = { mode: remoteMode ? 'supabase' : 'local', status: 'idle', pending: 0 };
let flushing = false;
let flushPromise: Promise<void> | null = null;
let legacyCacheCleared = false;
let realtimeTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(next: SyncState) => void>();
const emit = (patch: Partial<SyncState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener(state)); };
const readQueue = (): Mutation[] => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } };
const writeQueue = (items: Mutation[]) => { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items)); emit({ pending: items.length, status: items.length ? 'pending' : 'synced' }); };
const cache = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const LEGACY_LOCAL_KEYS = [
  'ia_hub_projects', 'ia_hub_students', 'ia_hub_applications', 'ia_hub_minutes',
  'ia_hub_deliverables', 'ia_hub_alerts', 'ia_hub_messages', 'ia_hub_operation_tasks',
  'ia_hub_operation_issues', 'ia_hub_operation_meetings', 'ia_hub_operation_documents',
  'ia_hub_operation_activity', 'ia_hub_operation_templates', 'ia_hub_private_files',
  'ia_hub_audit_events',
];
const clearLegacyLocalCache = () => {
  if (legacyCacheCleared) return;
  LEGACY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  legacyCacheCleared = true;
};
const uuid = () => crypto.randomUUID();
const iso = (value?: string | null) => value || new Date().toISOString();
const hasTimezoneOffset = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
const toStoredMeetingTime = (value: string, timezone?: string) => {
  if (hasTimezoneOffset(value)) return value;
  // The scheduling form uses Bogotá local wall time (YYYY-MM-DDTHH:mm:ss).
  // PostgreSQL treats an offset-less value as UTC, which shifted every event
  // five hours earlier in Google Calendar. Colombia has no daylight-saving
  // time, so the explicit -05:00 offset is stable for this platform.
  return (timezone || 'America/Bogota') === 'America/Bogota' ? `${value}-05:00` : value;
};

const mapProject = (row: any, profiles: any[]): Project => ({
  id: row.id, code: row.folder_name, companyName: row.companies?.name || row.company_name || 'Sin organización', title: row.title,
  challengeDescription: row.challenge_description || undefined, whatsappUrl: row.whatsapp_url || undefined, teamsMeetingUrl: row.teams_meeting_url || undefined,
  sharedFolderName: row.folder_name, progressStatus: row.progress_status || undefined, progressPct: row.progress_pct || 0,
  riskLevel: row.risk_level || 'verde', minStudents: row.min_students ?? 1, maxStudents: row.max_students ?? 5,
  contacts: Array.isArray(row.organization_contacts) ? row.organization_contacts : [],
  assignedStudents: profiles.filter((profile) => profile.project_id === row.id && profile.role === 'student_group' && profile.is_active !== false).map((profile): Student => ({ id: profile.id, name: profile.full_name, email: profile.email, code: profile.student_code, projectId: row.id, isActive: profile.is_active !== false })),
  assignedStudentsCount: row.assigned_students === undefined ? undefined : Number(row.assigned_students),
  aiType: row.ai_type || [], copImpactDescription: row.cop_impact_description || undefined, copImpactAnnual: row.cop_impact_annual ? Number(row.cop_impact_annual) : undefined,
  impactRating: row.impact_rating || undefined, complexityRating: row.complexity_rating || 5, aiRisks: row.ai_risks || undefined,
  requiredDatasets: row.required_datasets || undefined, dataQualityAvailability: row.data_quality_availability || undefined, techViability: row.tech_viability || undefined,
  githubUrl: row.github_url || undefined, driveFolderUrl: row.drive_folder_url || undefined, videoUrl: row.video_url || undefined, pptUrl: row.ppt_url || undefined,
  finalReportUrl: row.final_report_url || undefined, baselineDocUrl: row.baseline_doc_url || undefined,
  resourceLinks: Array.isArray(row.resource_links) ? row.resource_links : [], lastActivityAt: iso(row.last_activity_at),
});
const mapTask = (row: any): ProjectTask => ({ id: row.id, projectId: row.project_id, title: row.title, description: row.description || undefined, assigneeName: row.assignee_name || 'Por asignar', assigneeEmail: row.assignee_email || undefined, dueDate: row.due_date || undefined, status: row.status, priority: row.priority, source: row.source, evidenceUrl: row.evidence_url || undefined, createdBy: row.created_by || undefined, completedBy: row.completed_by || undefined, completedAt: row.completed_at || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapIssue = (row: any): ProjectIssue => ({ id: row.id, projectId: row.project_id, title: row.title, description: row.description, category: row.category, priority: row.priority, status: row.status, reportedBy: row.reported_by_name || 'Usuario', reportedByEmail: row.reported_by_email || undefined, ownerName: row.owner_name || undefined, dueDate: row.due_date || undefined, resolution: row.resolution || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapMeeting = (row: any): ProjectMeeting => ({ id: row.id, projectId: row.project_id, title: row.title, startsAt: row.starts_at, durationMinutes: row.duration_minutes, attendees: Array.isArray(row.attendees) ? row.attendees : [], agenda: row.agenda || undefined, timezone: row.timezone || 'America/Bogota', status: row.status, cancellationReason: row.cancellation_reason || undefined, calendarSync: row.calendar_sync_status || 'pendiente', calendarEventUrl: row.calendar_event_url || undefined, minuteId: row.minute_id || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapMinute = (row: any): MeetingMinute => ({ id: row.id, projectId: row.project_id, meetingId: row.meeting_id || undefined, projectTitle: row.projects?.title || 'Proyecto', meetingDate: row.meeting_date, title: row.title, summary: row.summary || '', decisions: row.decisions || [], commitments: row.commitments || [], risksDetected: row.risks_detected || undefined, sentiment: row.sentiment || undefined, transcriptFileUrl: row.transcript_file_url || undefined, transcriptStoragePath: row.transcript_storage_path || undefined, docFileUrl: row.doc_file_url || undefined, docStoragePath: row.doc_storage_path || undefined, uploadedBy: row.uploaded_by || 'Usuario', attendees: row.attendees || [], status: row.status || 'borrador', createdAt: iso(row.created_at) });
const mapTemplate = (row: any): DocumentTemplate => ({ id: row.id, name: row.name, description: row.description, category: row.category, requiredFields: row.required_fields || [], htmlTemplate: row.html_template, isActive: row.is_active, version: row.version || 1, documentType: row.document_type || undefined, baseTemplateSha256: row.base_template_sha256 || undefined, originalDocxName: row.original_docx_name || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapDocument = (row: any): ProjectDocument => ({ id: row.id, projectId: row.project_id, templateId: row.template_id, documentType: row.document_type || undefined, title: row.title, status: row.status, version: row.version, generatedBy: row.generated_by || 'Usuario', htmlPreview: row.html_content, fileUrl: row.file_url || undefined, storagePath: row.storage_path || undefined, pdfStoragePath: row.pdf_storage_path || row.storage_path || undefined, generationStatus: row.generation_status || 'pdf_pendiente', provider: row.provider || 'template', model: row.model || undefined, sourceFiles: row.source_files || [], lastChangeRequest: row.last_change_request || undefined, approvedBy: row.approved_by || undefined, approvedAt: row.approved_at || undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const mapActivity = (row: any): ActivityItem => ({ id: row.id, projectId: row.project_id, type: row.activity_type, message: row.message, createdAt: iso(row.created_at) });

const withActor = async (table: TableName, payload: Record<string, unknown>) => {
  const userId = (await supabaseClient!.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('La sesión venció antes de sincronizar.');
  const actorField: Partial<Record<TableName, string>> = { project_tasks: 'created_by', project_issues: 'reported_by', project_meetings: 'created_by', meeting_minutes: 'uploaded_by', project_documents: 'generated_by', project_activity: 'actor_id', audit_log: 'actor_id' };
  const field = actorField[table];
  if (!field || payload[field]) return payload;
  if (payload.id && !['project_activity', 'audit_log'].includes(table)) {
    const { data: existing } = await supabaseClient!.from(table).select(field).eq('id', payload.id).maybeSingle();
    const existingRecord = existing as Record<string, unknown> | null;
    if (existingRecord?.[field]) return { ...payload, [field]: existingRecord[field] };
  }
  return { ...payload, [field]: userId };
};

const execute = async (mutation: Mutation) => {
  if (!supabaseClient) throw new Error('Supabase no está configurado.');
  if (mutation.kind === 'upsert') {
    let payload = await withActor(mutation.table, mutation.payload);
    if (mutation.table === 'projects' && payload.company_name) {
      const companyName = String(payload.company_name);
      const { data: company, error: companyError } = await supabaseClient.from('companies').upsert({ name: companyName }, { onConflict: 'name' }).select('id').single();
      if (companyError) throw companyError;
      const { company_name: _ignored, ...projectPayload } = payload;
      payload = { ...projectPayload, company_id: company.id };
    }
    if (['project_activity', 'audit_log'].includes(mutation.table)) {
      const { error } = await supabaseClient.from(mutation.table).insert(payload);
      if (error) throw error;
    } else {
      const { data: existing, error: lookupError } = await supabaseClient.from(mutation.table).select('id').eq('id', payload.id).maybeSingle();
      if (lookupError) throw lookupError;
      const result = existing
        ? await supabaseClient.from(mutation.table).update(payload).eq('id', payload.id)
        : await supabaseClient.from(mutation.table).insert(payload);
      if (result.error) throw result.error;
    }
  } else if (mutation.kind === 'delete') {
    const { error } = await supabaseClient.from(mutation.table).delete().eq('id', mutation.recordId);
    if (error) throw error;
  } else if (mutation.kind === 'replace_team') {
    const normalized = [...new Set(mutation.emails.map((email) => email.trim().toLowerCase()))];
    const { data: profiles, error } = await supabaseClient.from('profiles').select('id,email,project_id,role').eq('role', 'student_group');
    if (error) throw error;
    const selected = (profiles || []).filter((profile) => normalized.includes(profile.email.toLowerCase()));
    if (selected.length !== normalized.length) throw new Error('El padrón remoto cambió; revisa el equipo antes de reintentar.');
    for (const profile of selected) {
      const { error: assignError } = await supabaseClient.rpc('assign_student_to_project', { target_student_id: profile.id, target_project_id: mutation.projectId });
      if (assignError) throw assignError;
    }
    for (const profile of (profiles || []).filter((item) => item.project_id === mutation.projectId && !normalized.includes(item.email.toLowerCase()))) {
      const { error: removeError } = await supabaseClient.rpc('remove_student_from_project', { target_student_id: profile.id, expected_project_id: mutation.projectId });
      if (removeError) throw removeError;
    }
  } else if (mutation.kind === 'set_profile_active') {
    const { error } = await supabaseClient.from('profiles').update({ is_active: mutation.isActive }).eq('id', mutation.studentId);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.rpc('assign_student_to_project', { target_student_id: mutation.studentId, target_project_id: mutation.projectId });
    if (error) throw error;
    const { error: appError } = await supabaseClient.from('project_applications').update({ status: 'aceptada' }).eq('id', mutation.applicationId);
    if (appError) throw appError;
  }
};

export const SyncService = {
  isRemoteMode: () => remoteMode,
  getState: () => state,
  subscribe: (listener: (next: SyncState) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  startRealtime: (onHydrated: () => void) => {
    if (!remoteMode || !supabaseClient) return () => undefined;
    const client = supabaseClient;
    const channel = client
      .channel(`project-hub-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (realtimeTimer) clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
          void SyncService.flush()
            .then(() => SyncService.bootstrap())
            .then(onHydrated)
            .catch(() => undefined);
        }, 350);
      })
      .subscribe();
    return () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      void client.removeChannel(channel);
    };
  },
  bootstrap: async () => {
    if (!remoteMode) { emit({ mode: 'local', status: 'synced', pending: 0, lastSyncedAt: new Date().toISOString() }); return state; }
    if (!supabaseClient) throw new Error('VITE_DATA_MODE=supabase requiere URL y clave de Supabase.');
    clearLegacyLocalCache();
    emit({ status: 'loading', error: undefined });
    try {
      await SyncService.flush();
      const results = await Promise.all([
        supabaseClient.from('profiles').select('id,project_id,full_name,email,student_code,role'),
        supabaseClient.from('projects').select('*,companies(name)'),
        supabaseClient.from('project_tasks').select('*'),
        supabaseClient.from('project_issues').select('*'),
        supabaseClient.from('project_meetings').select('*'),
        supabaseClient.from('meeting_minutes').select('*,projects(title)'),
        supabaseClient.from('document_templates').select('*'),
        supabaseClient.from('project_documents').select('*'),
        supabaseClient.from('project_activity').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('project_applications').select('*'),
        supabaseClient.rpc('list_available_projects'),
      ]);
      // `list_available_projects` is only a student catalog enhancement. It
      // must not prevent monitors from loading if the optional RPC migration
      // has not been applied yet.
      const firstError = results.slice(0, -1).find((result) => result.error)?.error;
      if (firstError) throw firstError;
      const [profilesResult, projectsResult, tasksResult, issuesResult, meetingsResult, minutesResult, templatesResult, documentsResult, activityResult, applicationsResult, catalogResult] = results;
      const profiles = profilesResult.data || [];
      cache(CACHE.students, profiles.filter((profile: any) => profile.role === 'student_group').map((profile: any): Student => ({ id: profile.id, name: profile.full_name, email: profile.email, code: profile.student_code, projectId: profile.project_id, isActive: profile.is_active !== false })));
      const projectRows = (projectsResult.data || []).length ? projectsResult.data || [] : (catalogResult.error ? [] : catalogResult.data || []);
      cache(CACHE.projects, projectRows.map((row: any) => mapProject(row, profiles)));
      cache(CACHE.tasks, (tasksResult.data || []).map(mapTask)); cache(CACHE.issues, (issuesResult.data || []).map(mapIssue));
      cache(CACHE.meetings, (meetingsResult.data || []).map(mapMeeting)); cache(CACHE.minutes, (minutesResult.data || []).map(mapMinute));
      cache(CACHE.templates, (templatesResult.data || []).map(mapTemplate)); cache(CACHE.documents, (documentsResult.data || []).map(mapDocument));
      cache(CACHE.activity, (activityResult.data || []).map(mapActivity));
      cache(CACHE.applications, (applicationsResult.data || []).map((row: any): Application => ({ id: row.id, projectId: row.project_id, studentId: row.student_id, studentName: profiles.find((profile: any) => profile.id === row.student_id)?.full_name || 'Estudiante', studentEmail: profiles.find((profile: any) => profile.id === row.student_id)?.email || '', status: row.status, createdAt: iso(row.created_at) })));
      emit({ status: 'synced', pending: readQueue().length, lastSyncedAt: new Date().toISOString(), error: undefined });
      return state;
    } catch (error) {
      const detail = typeof error === 'object' && error && 'message' in error ? String(error.message) : undefined;
      const message = error instanceof Error ? error.message : detail || 'No se pudieron cargar los datos remotos.';
      emit({ status: 'error', error: message });
      throw new Error(message);
    }
  },
  enqueueUpsert: (table: TableName, payload: Record<string, unknown>) => {
    if (!remoteMode) return;
    writeQueue([...readQueue(), { id: uuid(), kind: 'upsert', table, payload, createdAt: new Date().toISOString() }]);
    void SyncService.flush().catch(() => undefined);
  },
  enqueueDelete: (table: TableName, recordId: string) => {
    if (!remoteMode) return;
    writeQueue([...readQueue(), { id: uuid(), kind: 'delete', table, recordId, createdAt: new Date().toISOString() }]);
    void SyncService.flush().catch(() => undefined);
  },
  enqueueTeamReplacement: (projectId: string, emails: string[]) => {
    if (!remoteMode) return;
    writeQueue([...readQueue(), { id: uuid(), kind: 'replace_team', projectId, emails, createdAt: new Date().toISOString() }]);
    void SyncService.flush().catch(() => undefined);
  },
  enqueueProfileActive: (studentId: string, isActive: boolean) => {
    if (!remoteMode) return;
    writeQueue([...readQueue(), { id: uuid(), kind: 'set_profile_active', studentId, isActive, createdAt: new Date().toISOString() }]);
    void SyncService.flush().catch(() => undefined);
  },
  enqueueApplicationAcceptance: (applicationId: string, studentId: string, projectId: string) => {
    if (!remoteMode) return;
    writeQueue([...readQueue(), { id: uuid(), kind: 'accept_application', applicationId, studentId, projectId, createdAt: new Date().toISOString() }]);
    void SyncService.flush().catch(() => undefined);
  },
  flush: async () => {
    if (!remoteMode || !supabaseClient) return;
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      flushing = true;
      try {
        while (true) {
          const mutation = readQueue()[0];
          if (!mutation) break;
          await execute(mutation);
          // Keep entries queued while an earlier write is in flight. Removing a
          // stale in-memory queue here used to discard newly-created meetings.
          writeQueue(readQueue().filter((item) => item.id !== mutation.id));
        }
        emit({ status: 'synced', pending: 0, lastSyncedAt: new Date().toISOString(), error: undefined });
      } catch (error) {
        emit({ status: 'error', pending: readQueue().length, error: error instanceof Error ? error.message : 'Falló la sincronización.' });
        throw error;
      } finally {
        flushing = false;
        flushPromise = null;
      }
    })();
    return flushPromise;
  },
};

export const toDatabase = {
  project: (project: Project) => ({ id: project.id, company_name: project.companyName, folder_name: project.code, title: project.title, challenge_description: project.challengeDescription || null, whatsapp_url: project.whatsappUrl || null, teams_meeting_url: project.teamsMeetingUrl || null, min_students: project.minStudents, max_students: project.maxStudents, progress_status: project.progressStatus || null, progress_pct: project.progressPct, risk_level: project.riskLevel, organization_contacts: project.contacts, resource_links: project.resourceLinks || [], ai_type: project.aiType, complexity_rating: project.complexityRating, github_url: project.githubUrl || null, drive_folder_url: project.driveFolderUrl || null, last_activity_at: project.lastActivityAt }),
  task: (task: ProjectTask) => ({ id: task.id, project_id: task.projectId, title: task.title, description: task.description || null, assignee_name: task.assigneeName, due_date: task.dueDate || null, status: task.status, priority: task.priority, source: task.source, evidence_url: task.evidenceUrl || null, completed_by: task.completedBy || null, completed_at: task.completedAt || null }),
  issue: (issue: ProjectIssue) => ({ id: issue.id, project_id: issue.projectId, title: issue.title, description: issue.description, category: issue.category, priority: issue.priority, status: issue.status, due_date: issue.dueDate || null, resolution: issue.resolution || null }),
  meeting: (meeting: ProjectMeeting) => ({ id: meeting.id, project_id: meeting.projectId, title: meeting.title, starts_at: toStoredMeetingTime(meeting.startsAt, meeting.timezone), duration_minutes: meeting.durationMinutes, attendees: meeting.attendees, agenda: meeting.agenda || null, timezone: meeting.timezone || 'America/Bogota', status: meeting.status, cancellation_reason: meeting.cancellationReason || null, calendar_sync_status: meeting.calendarSync, calendar_event_url: meeting.calendarEventUrl || null, minute_id: meeting.minuteId || null }),
  minute: (minute: MeetingMinute) => ({ id: minute.id, project_id: minute.projectId, meeting_id: minute.meetingId || null, meeting_date: minute.meetingDate, title: minute.title, summary: minute.summary, decisions: minute.decisions, commitments: minute.commitments, risks_detected: minute.risksDetected || null, sentiment: minute.sentiment || null, transcript_file_url: minute.transcriptFileUrl || null, transcript_storage_path: minute.transcriptStoragePath || null, doc_file_url: minute.docFileUrl || null, doc_storage_path: minute.docStoragePath || null, attendees: minute.attendees || [], status: minute.status || 'borrador' }),
  template: (template: DocumentTemplate) => ({ id: template.id, name: template.name, description: template.description, category: template.category, html_template: template.htmlTemplate || '', required_fields: template.requiredFields, is_active: template.isActive !== false, version: template.version || 1, document_type: template.documentType || null, base_template_sha256: template.baseTemplateSha256 || null, original_docx_name: template.originalDocxName || null }),
  document: (document: ProjectDocument) => ({ id: document.id, project_id: document.projectId, template_id: document.templateId, document_type: document.documentType || null, title: document.title, status: document.status, version: document.version, html_content: document.htmlPreview, file_url: document.fileUrl || null, storage_path: document.storagePath || null, pdf_storage_path: document.pdfStoragePath || null, generation_status: document.generationStatus || 'pdf_pendiente', provider: document.provider || 'local', model: document.model || null, source_files: document.sourceFiles || [], last_change_request: document.lastChangeRequest || null, approved_by: document.approvedBy || null, approved_at: document.approvedAt || null }),
  activity: (activity: ActivityItem) => ({ id: activity.id, project_id: activity.projectId, activity_type: activity.type, message: activity.message, created_at: activity.createdAt }),
  application: (application: Application) => ({ id: application.id, project_id: application.projectId, student_id: application.studentId, status: application.status, created_at: application.createdAt }),
  audit: (event: AuditEvent) => ({ id: event.id, project_id: event.projectId || null, entity_type: event.entityType, entity_id: event.entityId, action: event.action, before_data: event.beforeData ?? null, after_data: event.afterData ?? null, created_at: event.createdAt }),
};
