import { beforeEach, describe, expect, it } from 'vitest';
import { OperationsService } from './operationsService';
import { AuditService } from './auditService';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  OperationsService.initialise();
});

describe('operations service', () => {
  it('records completion metadata and removes it when a task is reopened', () => {
    const project = OperationsService.getProjects()[0];
    const task = OperationsService.createTask({ projectId: project.id, title: 'Validar entrega', assigneeName: 'Equipo', status: 'pendiente', priority: 'media', source: 'manual' });
    const completed = OperationsService.updateTask(task.id, { status: 'completada' });
    expect(completed?.completedAt).toBeTruthy();
    const reopened = OperationsService.updateTask(task.id, { status: 'en_progreso' });
    expect(reopened?.completedAt).toBeUndefined();
    expect(AuditService.getEvents(project.id).filter((event) => event.entityId === task.id).map((event) => event.action)).toEqual(['status_change', 'status_change', 'create']);
  });

  it('rejects an invalid meeting transition', () => {
    const project = OperationsService.getProjects()[0];
    const meeting = OperationsService.createMeeting({ projectId: project.id, title: 'Cierre', startsAt: '2026-08-20T10:00:00', durationMinutes: 45, attendees: [], timezone: 'America/Bogota', status: 'realizada' });
    expect(() => OperationsService.updateMeetingStatus(meeting.id, 'cancelada', 'Cambio tardío')).toThrow(/No se puede cambiar/);
  });

  it('links a generated minute to its meeting and creates only non-empty commitments', () => {
    const project = OperationsService.getProjects()[0];
    const meeting = OperationsService.createMeeting({ projectId: project.id, title: 'Seguimiento', startsAt: '2026-08-20T10:00:00', durationMinutes: 45, attendees: ['ana@example.com'], timezone: 'America/Bogota', status: 'realizada' });
    const tasksBefore = OperationsService.getTasks(project.id).length;
    const minute = OperationsService.saveMinuteFromAnalysis(project, {
      title: 'Acta de seguimiento', summary: 'Resumen revisado.', decisions: [{ decision: 'Continuar el piloto.' }],
      commitments: [{ task: 'Preparar datos', responsible: 'Ana', dueDate: '2026-08-25' }, { task: '   ', responsible: 'Equipo' }],
      risksDetected: 'Sin riesgos.', sentiment: 'Positivo',
    }, { meetingId: meeting.id, uploadedBy: 'Monitor' });
    expect(OperationsService.getMeetings(project.id).find((item) => item.id === meeting.id)?.minuteId).toBe(minute.id);
    expect(OperationsService.getTasks(project.id)).toHaveLength(tasksBefore + 1);
    expect(() => OperationsService.saveMinuteFromAnalysis(project, { title: 'Duplicada', summary: '', decisions: [], commitments: [], risksDetected: '', sentiment: 'Neutro' }, { meetingId: meeting.id })).toThrow(/ya tiene un acta/);
  });

  it('escapes project data when rendering a template document', () => {
    const project = OperationsService.getProjects()[0];
    const task = OperationsService.createTask({ projectId: project.id, title: '<script>alert(1)</script>', assigneeName: 'Equipo', status: 'pendiente', priority: 'media', source: 'manual' });
    const document = OperationsService.generateDocument(project.id, 'plan-actividades');
    expect(document.htmlPreview).not.toContain(task.title);
    expect(document.htmlPreview).toContain(project.title);
  });

  it('accepts an application and leaves the student in exactly one project', () => {
    const [first, second] = OperationsService.getProjects();
    const applicant = { id: 'student-transfer', name: 'Persona Transferida', email: 'transfer@example.com' };
    OperationsService.updateProject({ ...first, assignedStudents: [...first.assignedStudents, applicant] });
    const applications = OperationsService.applyToProject(second.id, applicant);
    OperationsService.acceptApplication(applications[0].id);
    const memberships = OperationsService.getProjects().filter((project) => project.assignedStudents.some((student) => student.email === applicant.email));
    expect(memberships.map((project) => project.id)).toEqual([second.id]);
  });
});
