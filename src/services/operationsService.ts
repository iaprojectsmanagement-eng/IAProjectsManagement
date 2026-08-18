import { ActivityItem, DocumentTemplate, MeetingMinute, MeetingStatus, Project, ProjectDocument, ProjectIssue, ProjectMeeting, ProjectTask, Student, TaskPriority, TaskStatus } from '../types';
import { DataService } from './supabase';
import { assignStudentsExclusively as assignStudentsRule } from './projectRules';
import { normaliseEmail } from './projectRules';
import { canChangeMeetingTo } from './operationsRules';
import { SyncService, toDatabase } from './syncService';
import { AuditService } from './auditService';
import { INSTITUTIONAL_TEMPLATES, mergeInstitutionalTemplates } from '../data/institutionalTemplates';

const KEYS = { tasks: 'ia_hub_operation_tasks', issues: 'ia_hub_operation_issues', meetings: 'ia_hub_operation_meetings', documents: 'ia_hub_operation_documents', activity: 'ia_hub_operation_activity', templates: 'ia_hub_operation_templates' };
const read = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const write = <T,>(key: string, value: T) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { throw new Error('No fue posible guardar los datos en este navegador.'); }
};
const id = (_prefix: string) => crypto.randomUUID();
const day = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };

export const DEFAULT_TEMPLATES: DocumentTemplate[] = INSTITUTIONAL_TEMPLATES;
// Backwards-compatible export for the retired views that remain in the repository.
export const DOCUMENT_TEMPLATES = DEFAULT_TEMPLATES;

const addActivity = (projectId: string, type: ActivityItem['type'], message: string) => {
  const items = read<ActivityItem[]>(KEYS.activity, []);
  const activity = { id: id('activity'), projectId, type, message, createdAt: new Date().toISOString() } satisfies ActivityItem;
  write(KEYS.activity, [activity, ...items]);
  SyncService.enqueueUpsert('project_activity', toDatabase.activity(activity));
  const project = DataService.getProjectById(projectId);
  if (project) DataService.updateProject({ ...project, lastActivityAt: new Date().toISOString() });
};

const seed = () => {
  // The former local demonstration records are intentionally disabled.
  // Supabase hydration is now the only source of operational records.
  return;
  const [first, second, third] = DataService.getProjects();
  if (!first) return;
  const now = new Date().toISOString();
  const task = (project: Project, title: string, status: TaskStatus, priority: TaskPriority, offset: number): ProjectTask => ({ id: id('seed-task'), projectId: project.id, title, assigneeName: project.assignedStudents[0]?.name || 'Equipo', dueDate: day(offset), status, priority, source: 'manual', createdAt: now, updatedAt: now });
  if (!localStorage.getItem(KEYS.tasks)) write(KEYS.tasks, [task(first, 'Confirmar acceso a datos de la organizacion', 'bloqueada', 'alta', -1), task(second || first, 'Validar criterios de aceptacion con el tutor', 'en_progreso', 'media', 3)]);
  if (!localStorage.getItem(KEYS.issues)) write(KEYS.issues, [{ id: 'seed-issue', projectId: first.id, title: 'Credenciales pendientes', description: 'El equipo solicito acceso a datos y aun no recibe respuesta.', category: 'datos_accesos', priority: 'alta', status: 'abierta', reportedBy: 'Equipo del proyecto', dueDate: day(1), createdAt: now, updatedAt: now } satisfies ProjectIssue]);
  if (!localStorage.getItem(KEYS.meetings)) write(KEYS.meetings, [{ id: 'seed-meeting', projectId: first.id, title: 'Seguimiento semanal', startsAt: `${day(1)}T15:00:00`, durationMinutes: 45, attendees: ['Equipo', 'Monitor'], agenda: 'Revisar avances, bloqueos y próximos compromisos.', timezone: 'America/Bogota', status: 'programada', calendarSync: 'simulado', createdAt: now, updatedAt: now } satisfies ProjectMeeting, { id: 'seed-meeting-minute', projectId: (second || first).id, title: 'Validación de requerimientos', startsAt: `${day(-1)}T10:00:00`, durationMinutes: 45, attendees: ['Equipo'], timezone: 'America/Bogota', status: 'realizada', calendarSync: 'simulado', createdAt: now, updatedAt: now } satisfies ProjectMeeting]);
  if (!localStorage.getItem(KEYS.documents)) write(KEYS.documents, []);
  if (!localStorage.getItem(KEYS.activity)) write(KEYS.activity, []);
  if (!localStorage.getItem(KEYS.templates)) write(KEYS.templates, DEFAULT_TEMPLATES);
};

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const renderDocument = (template: DocumentTemplate, project: Project, tasks: ProjectTask[], issues: ProjectIssue[]) => {
  const list = (items: string[]) => items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>Sin registros abiertos.</p>';
  const taskList = list(tasks.filter((task) => task.status !== 'completada').map((task) => `${task.title} — ${task.assigneeName}${task.dueDate ? ` — ${task.dueDate}` : ''}`));
  const issueList = list(issues.filter((issue) => issue.status !== 'resuelta').map((issue) => `${issue.title}: ${issue.description}`));
  const replacements: Record<string, string> = {
    template: escapeHtml(template.name), project: escapeHtml(project.title), project_title: escapeHtml(project.title), project_code: escapeHtml(project.code),
    company_name: escapeHtml(project.companyName), problem: escapeHtml(project.challengeDescription || 'Pendiente de completar.'), scope: '<p>Pendiente de completar: alcance.</p>',
    tasks: taskList, commitments: taskList, progress: taskList, issues: issueList, blockers: issueList,
    decisions: '<p>Sin decisiones registradas en este documento.</p>', fecha: escapeHtml(new Date().toISOString().slice(0, 10)), asistentes: list(project.assignedStudents.map((student) => student.name)),
  };
  return (template.htmlTemplate || '<article><h1>{{template}}</h1><p>{{project}}</p>{{tasks}}{{issues}}</article>')
    .replace(/{{\s*([\w_]+)\s*}}/g, (_match, key: string) => replacements[key] ?? `<span data-pending="${escapeHtml(key)}">Pendiente de completar: ${escapeHtml(key)}</span>`)
    .replace(/\[Nombre del Proyecto\]/gi, escapeHtml(project.title))
    .replace(/\[Equipo ICESI\]/gi, project.assignedStudents.length ? escapeHtml(project.assignedStudents.map((student) => student.name).join(', ')) : 'Equipo por asignar')
    .replace(/\[(?:Fecha|DD\/MM\/AAAA)\]/gi, escapeHtml(new Intl.DateTimeFormat('es-CO').format(new Date())));
};

export const OperationsService = {
  initialise: () => undefined,
  getProjects: (): Project[] => DataService.getProjects(),
  getStudents: (): Student[] => {
    const map = new Map<string, Student>();
    [...DataService.getStudents(), ...DataService.getProjects().flatMap((project) => project.assignedStudents)].forEach((student) => map.set(student.email.toLowerCase(), student));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  createProject: (data: { code: string; companyName: string; title: string; challengeDescription?: string; maxStudents: number }) => { const projects = DataService.addProject({ ...data, progressPct: 0, riskLevel: 'verde', minStudents: 1, contacts: [], assignedStudents: [], aiType: [], complexityRating: 5 }); const project = projects[0]; SyncService.enqueueUpsert('projects', toDatabase.project(project)); AuditService.record({ projectId: project.id, entityType: 'project', entityId: project.id, action: 'create', afterData: project }); return projects; },
  updateProject: (project: Project) => { const before = DataService.getProjectById(project.id); const projects = DataService.updateProject(project); SyncService.enqueueUpsert('projects', toDatabase.project(project)); AuditService.record({ projectId: project.id, entityType: 'project', entityId: project.id, action: 'update', beforeData: before, afterData: project }); return projects; },
  updateProjectLinks: (projectId: string, links: Pick<Project, 'resourceLinks' | 'whatsappUrl' | 'teamsMeetingUrl' | 'githubUrl' | 'driveFolderUrl'>) => {
    const before = DataService.getProjectById(projectId);
    if (!before) throw new Error('Proyecto no encontrado.');
    const updated: Project = { ...before, ...links, resourceLinks: links.resourceLinks || [], lastActivityAt: new Date().toISOString() };
    const projects = DataService.updateProject(updated);
    SyncService.enqueueProjectLinks(projectId, {
      resourceLinks: updated.resourceLinks || [], whatsappUrl: updated.whatsappUrl, teamsMeetingUrl: updated.teamsMeetingUrl,
      githubUrl: updated.githubUrl, driveFolderUrl: updated.driveFolderUrl,
    });
    AuditService.record({ projectId, entityType: 'project', entityId: projectId, action: 'update', beforeData: before, afterData: updated });
    return projects;
  },
  getApplications: () => DataService.getApplications(),
  applyToProject: (projectId: string, student: { id: string; name: string; email: string }) => { const items = DataService.applyToProject(projectId, student); const application = items.find((item) => item.projectId === projectId && normaliseEmail(item.studentEmail) === normaliseEmail(student.email)); if (application) SyncService.enqueueUpsert('project_applications', toDatabase.application(application)); return items; },
  acceptApplication: (applicationId: string) => { const result = DataService.acceptApplication(applicationId); const application = result.applications.find((item) => item.id === applicationId); if (application) { SyncService.enqueueApplicationAcceptance(application.id, application.studentId, application.projectId); addActivity(application.projectId, 'equipo', `${application.studentName} fue aceptado en el proyecto.`); } return result; },
  rejectApplication: (applicationId: string) => { const applications = DataService.rejectApplication(applicationId); const application = applications.find((item) => item.id === applicationId); if (application) SyncService.enqueueUpsert('project_applications', toDatabase.application(application)); return applications; },
  assignStudentsExclusively: (projectId: string, emails: string[]): Project[] => {
    const projects = DataService.getProjects(); const target = projects.find((project) => project.id === projectId);
    if (!target) throw new Error('Proyecto de destino no encontrado.');
    const selectedEmails = new Set(emails.map(normaliseEmail));
    const wanted = OperationsService.getStudents().filter((student) => selectedEmails.has(normaliseEmail(student.email)));
    if (wanted.length !== selectedEmails.size) throw new Error('Uno o más estudiantes seleccionados ya no existen en el padrón.');
    const previousEmails = new Set(target.assignedStudents.map((student) => normaliseEmail(student.email)));
    const next = assignStudentsRule(projects, projectId, wanted);
    DataService.saveProjects(next);
    SyncService.enqueueTeamReplacement(projectId, wanted.map((student) => student.email));
    AuditService.record({ projectId, entityType: 'team', entityId: projectId, action: 'assign', beforeData: target.assignedStudents, afterData: wanted });
    wanted.filter((student) => !previousEmails.has(normaliseEmail(student.email))).forEach((student) => addActivity(projectId, 'equipo', `${student.name} fue asignado al proyecto.`));
    target.assignedStudents.filter((student) => !selectedEmails.has(normaliseEmail(student.email))).forEach((student) => addActivity(projectId, 'equipo', `${student.name} fue retirado del proyecto.`));
    return next;
  },
  removeStudent: (projectId: string, email: string): Project[] => { const next = DataService.getProjects().map((project) => project.id === projectId ? { ...project, assignedStudents: project.assignedStudents.filter((student) => normaliseEmail(student.email) !== normaliseEmail(email)) } : project); DataService.saveProjects(next); SyncService.enqueueTeamReplacement(projectId, next.find((project) => project.id === projectId)?.assignedStudents.map((student) => student.email) || []); addActivity(projectId, 'equipo', 'Un integrante fue retirado del proyecto.'); return next; },
  getTasks: (projectId?: string) => { seed(); const items = read<ProjectTask[]>(KEYS.tasks, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  createTask: (data: Omit<ProjectTask, 'id' | 'createdAt' | 'updatedAt'>) => { seed(); const now = new Date().toISOString(); const item = { ...data, id: id('task'), createdAt: now, updatedAt: now }; write(KEYS.tasks, [item, ...read<ProjectTask[]>(KEYS.tasks, [])]); SyncService.enqueueUpsert('project_tasks', toDatabase.task(item)); AuditService.record({ projectId: item.projectId, entityType: 'task', entityId: item.id, action: 'create', afterData: item }); addActivity(data.projectId, 'tarea', `Nueva tarea: ${data.title}`); return item; },
  updateTask: (taskId: string, patch: Partial<ProjectTask>) => { const now = new Date().toISOString(); const current = read<ProjectTask[]>(KEYS.tasks, []); const before = current.find((item) => item.id === taskId); const items = current.map((item) => item.id === taskId ? { ...item, ...patch, completedAt: patch.status === 'completada' ? now : patch.status ? undefined : item.completedAt, updatedAt: now } : item); write(KEYS.tasks, items); const updated = items.find((item) => item.id === taskId); if (updated) { SyncService.enqueueUpsert('project_tasks', toDatabase.task(updated)); AuditService.record({ projectId: updated.projectId, entityType: 'task', entityId: updated.id, action: patch.status && patch.status !== before?.status ? 'status_change' : 'update', beforeData: before, afterData: updated }); } return updated; },
  deleteTask: (taskId: string) => { const current = read<ProjectTask[]>(KEYS.tasks, []); const task = current.find((item) => item.id === taskId); write(KEYS.tasks, current.filter((item) => item.id !== taskId)); SyncService.enqueueDelete('project_tasks', taskId); if (task) { AuditService.record({ projectId: task.projectId, entityType: 'task', entityId: task.id, action: 'delete', beforeData: task }); addActivity(task.projectId, 'tarea', `Tarea eliminada: ${task.title}`); } },
  getIssues: (projectId?: string) => { seed(); const items = read<ProjectIssue[]>(KEYS.issues, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  createIssue: (data: Omit<ProjectIssue, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => { seed(); const now = new Date().toISOString(); const item = { ...data, id: id('issue'), status: 'abierta' as const, createdAt: now, updatedAt: now }; write(KEYS.issues, [item, ...read<ProjectIssue[]>(KEYS.issues, [])]); SyncService.enqueueUpsert('project_issues', toDatabase.issue(item)); AuditService.record({ projectId: item.projectId, entityType: 'issue', entityId: item.id, action: 'create', afterData: item }); addActivity(data.projectId, 'incidencia', `Incidencia reportada: ${data.title}`); return item; },
  updateIssue: (issueId: string, patch: Partial<ProjectIssue>) => { const current = read<ProjectIssue[]>(KEYS.issues, []); const before = current.find((item) => item.id === issueId); const items = current.map((item) => item.id === issueId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item); write(KEYS.issues, items); const updated = items.find((item) => item.id === issueId); if (updated) { SyncService.enqueueUpsert('project_issues', toDatabase.issue(updated)); AuditService.record({ projectId: updated.projectId, entityType: 'issue', entityId: updated.id, action: patch.status && patch.status !== before?.status ? 'status_change' : 'update', beforeData: before, afterData: updated }); } return updated; },
  deleteIssue: (issueId: string) => { const current = read<ProjectIssue[]>(KEYS.issues, []); const issue = current.find((item) => item.id === issueId); write(KEYS.issues, current.filter((item) => item.id !== issueId)); SyncService.enqueueDelete('project_issues', issueId); if (issue) { AuditService.record({ projectId: issue.projectId, entityType: 'issue', entityId: issue.id, action: 'delete', beforeData: issue }); addActivity(issue.projectId, 'incidencia', `Incidencia eliminada: ${issue.title}`); } },
  getMeetings: (projectId?: string) => { seed(); const items = read<ProjectMeeting[]>(KEYS.meetings, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  createMeeting: (data: Omit<ProjectMeeting, 'id' | 'createdAt' | 'calendarSync'>) => { seed(); const now = new Date().toISOString(); const item = { ...data, id: id('meeting'), calendarSync: SyncService.isRemoteMode() ? 'pendiente' as const : 'simulado' as const, createdAt: now, updatedAt: now }; write(KEYS.meetings, [item, ...read<ProjectMeeting[]>(KEYS.meetings, [])]); SyncService.enqueueUpsert('project_meetings', toDatabase.meeting(item)); AuditService.record({ projectId: item.projectId, entityType: 'meeting', entityId: item.id, action: 'create', afterData: item }); addActivity(data.projectId, 'reunion', `Reunión programada: ${data.title}`); return item; },
  updateMeeting: (meetingId: string, patch: Partial<ProjectMeeting>) => { const now = new Date().toISOString(); const items = read<ProjectMeeting[]>(KEYS.meetings, []).map((item) => item.id === meetingId ? { ...item, ...patch, updatedAt: now } : item); write(KEYS.meetings, items); const updated = items.find((item) => item.id === meetingId); if (updated) SyncService.enqueueUpsert('project_meetings', toDatabase.meeting(updated)); return updated; },
  updateMeetingStatus: (meetingId: string, status: MeetingStatus, cancellationReason?: string) => { const current = read<ProjectMeeting[]>(KEYS.meetings, []); const meeting = current.find((item) => item.id === meetingId); if (!meeting) throw new Error('Reunión no encontrada.'); if (!canChangeMeetingTo(meeting.status, status)) throw new Error(`No se puede cambiar una reunión ${meeting.status} a ${status}.`); const now = new Date().toISOString(); const items = current.map((item) => item.id === meetingId ? { ...item, status, cancellationReason, updatedAt: now } : item); write(KEYS.meetings, items); const updated = items.find((item) => item.id === meetingId); if (updated) { SyncService.enqueueUpsert('project_meetings', toDatabase.meeting(updated)); AuditService.record({ projectId: updated.projectId, entityType: 'meeting', entityId: updated.id, action: 'status_change', beforeData: meeting, afterData: updated }); } addActivity(meeting.projectId, 'reunion', `Reunión “${meeting.title}” marcada como ${status.replace('_', ' ')}.`); return updated; },
  getTemplates: () => { seed(); return mergeInstitutionalTemplates(read<DocumentTemplate[]>(KEYS.templates, DEFAULT_TEMPLATES)); },
  saveTemplate: (template: DocumentTemplate) => { const items = OperationsService.getTemplates(); write(KEYS.templates, items.some((item) => item.id === template.id) ? items.map((item) => item.id === template.id ? template : item) : [...items, template]); SyncService.enqueueUpsert('document_templates', toDatabase.template(template)); },
  createTemplate: (template: Omit<DocumentTemplate, 'id'>) => { const now = new Date().toISOString(); const item: DocumentTemplate = { ...template, id: id('template'), version: 1, createdAt: now, updatedAt: now }; OperationsService.saveTemplate(item); return item; },
  deleteTemplate: (templateId: string) => { if (DEFAULT_TEMPLATES.some((item) => item.id === templateId)) throw new Error('Las plantillas base se pueden desactivar, pero no eliminar.'); write(KEYS.templates, OperationsService.getTemplates().filter((item) => item.id !== templateId)); SyncService.enqueueDelete('document_templates', templateId); },
  getDocuments: (projectId?: string) => { seed(); const items = read<ProjectDocument[]>(KEYS.documents, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  generateDocument: (projectId: string, templateId: string, generatedBy = 'Monitor') => { const project = DataService.getProjectById(projectId); if (!project) throw new Error('Proyecto no encontrado.'); const template = OperationsService.getTemplates().find((item) => item.id === templateId); if (!template) throw new Error('Plantilla no encontrada.'); const now = new Date().toISOString(); const item: ProjectDocument = { id: id('document'), projectId, templateId, title: `${template.name} — ${project.code}`, status: 'borrador', version: 1, generatedBy, htmlPreview: renderDocument(template, project, OperationsService.getTasks(projectId), OperationsService.getIssues(projectId)), createdAt: now, updatedAt: now }; write(KEYS.documents, [item, ...read<ProjectDocument[]>(KEYS.documents, [])]); SyncService.enqueueUpsert('project_documents', toDatabase.document(item)); AuditService.record({ projectId, entityType: 'document', entityId: item.id, action: 'create', afterData: item }); addActivity(projectId, 'documento', `Documento creado desde la plantilla ${template.name}.`); return item; },
  updateDocument: (documentId: string, patch: Partial<ProjectDocument>) => { const current = read<ProjectDocument[]>(KEYS.documents, []); const before = current.find((item) => item.id === documentId); const items = current.map((item) => item.id === documentId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item); write(KEYS.documents, items); const updated = items.find((item) => item.id === documentId); if (updated) { SyncService.enqueueUpsert('project_documents', toDatabase.document(updated)); AuditService.record({ projectId: updated.projectId, entityType: 'document', entityId: updated.id, action: patch.status === 'aprobado' ? 'approve' : 'update', beforeData: before, afterData: updated }); } return updated; },
  deleteDocument: (documentId: string) => { const current = read<ProjectDocument[]>(KEYS.documents, []); const document = current.find((item) => item.id === documentId); if (!document) throw new Error('Documento no encontrado.'); write(KEYS.documents, current.filter((item) => item.id !== documentId)); SyncService.enqueueDelete('project_documents', documentId); AuditService.record({ projectId: document.projectId, entityType: 'document', entityId: document.id, action: 'delete', beforeData: document }); addActivity(document.projectId, 'documento', `Documento eliminado: ${document.title}.`); },
  saveMinuteFromAnalysis: (
    project: Project,
    analysis: { title: string; summary: string; decisions: MeetingMinute['decisions']; commitments: MeetingMinute['commitments']; risksDetected: string; sentiment: MeetingMinute['sentiment'] },
    options?: { meetingId?: string; uploadedBy?: string; meetingDate?: string; attendees?: string[]; transcriptStoragePath?: string },
  ) => {
    const now = new Date().toISOString();
    const meeting = options?.meetingId ? OperationsService.getMeetings(project.id).find((item) => item.id === options.meetingId) : undefined;
    if (meeting?.minuteId) throw new Error('Esta reunión ya tiene un acta asociada.');
    const minute: MeetingMinute = {
      id: id('minute'),
      projectId: project.id,
      meetingId: meeting?.id,
      projectTitle: project.title,
      meetingDate: options?.meetingDate || meeting?.startsAt.slice(0, 10) || now.slice(0, 10),
      title: analysis.title,
      summary: analysis.summary,
      decisions: analysis.decisions,
      commitments: analysis.commitments,
      risksDetected: analysis.risksDetected,
      sentiment: analysis.sentiment,
      transcriptStoragePath: options?.transcriptStoragePath,
      uploadedBy: options?.uploadedBy || 'Usuario autenticado',
      attendees: options?.attendees || meeting?.attendees || [],
      status: 'aprobada',
      createdAt: now,
    };
    DataService.addMinute(minute);
    SyncService.enqueueUpsert('meeting_minutes', toDatabase.minute(minute));
    AuditService.record({ projectId: project.id, entityType: 'minute', entityId: minute.id, action: 'upload', afterData: minute });
    analysis.commitments
      .filter((commitment) => commitment.task.trim())
      .forEach((commitment) => OperationsService.createTask({
        projectId: project.id,
        title: commitment.task.trim(),
        assigneeName: commitment.responsible?.trim() || 'Por asignar',
        dueDate: commitment.dueDate,
        status: 'pendiente',
        priority: 'media',
        source: 'acta',
      }));
    if (meeting) OperationsService.updateMeeting(meeting.id, { minuteId: minute.id });
    addActivity(project.id, 'documento', `Acta estructurada desde transcripción y ${analysis.commitments.length} tareas extraídas. El documento institucional se genera a continuación.`);
    return minute;
  },
  getMinutes: (projectId?: string) => projectId ? DataService.getMinutesByProject(projectId) : DataService.getMinutes(),
  getActivity: (projectId?: string) => { seed(); const items = read<ActivityItem[]>(KEYS.activity, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  resetDemoData: () => Object.values(KEYS).forEach((key) => localStorage.removeItem(key))
};

export const taskPriorities: TaskPriority[] = ['baja', 'media', 'alta', 'critica'];
export const taskStatuses: TaskStatus[] = ['pendiente', 'en_progreso', 'bloqueada', 'completada'];
