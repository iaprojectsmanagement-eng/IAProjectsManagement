import { beforeEach, describe, expect, it } from 'vitest';
import { AuditService } from './auditService';
import { DocumentExportService } from './documentExportService';
import { StorageService } from './storageService';
import { SyncService, toDatabase } from './syncService';
import { ProjectDocument, ProjectTask } from '../types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

beforeEach(() => Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }));

describe('platform services', () => {
  it('maps the frontend task contract to Supabase snake_case fields', () => {
    const task: ProjectTask = { id: crypto.randomUUID(), projectId: crypto.randomUUID(), title: 'Validar datos', assigneeName: 'Ana', dueDate: '2026-08-20', status: 'pendiente', priority: 'alta', source: 'manual', createdAt: '2026-08-08T00:00:00Z', updatedAt: '2026-08-08T00:00:00Z' };
    expect(toDatabase.task(task)).toMatchObject({ id: task.id, project_id: task.projectId, assignee_name: 'Ana', due_date: '2026-08-20' });
    expect(toDatabase.task(task)).not.toHaveProperty('projectId');
  });

  it('keeps audit events locally and removes secrets or raw transcript text', () => {
    const event = AuditService.record({ projectId: 'project-1', entityType: 'minute', entityId: 'minute-1', action: 'upload', afterData: { title: 'Acta', token: 'secret-value', rawText: 'contenido privado', summary: 'visible' } });
    expect(event.afterData).toEqual({ title: 'Acta', summary: 'visible' });
    expect(AuditService.getEvents('project-1')).toHaveLength(1);
    expect(SyncService.getState().mode).toBe('local');
  });

  it('stores a valid transcript in the isolated local fallback', async () => {
    const file = new File(['Reunión de prueba con decisiones.'], 'reunion.txt', { type: 'text/plain' });
    const result = await StorageService.uploadTranscript('project-1', file);
    expect(result.mode).toBe('local');
    expect(result.path.startsWith('project-1/')).toBe(true);
    expect(StorageService.getLocalText(result.path)).toContain('decisiones');
  });

  it('rejects unsupported transcript files before storage', async () => {
    const file = new File(['contenido'], 'malware.html', { type: 'text/html' });
    await expect(StorageService.uploadTranscript('project-1', file)).rejects.toThrow(/TXT o VTT/);
  });

  it('converts safe HTML into blocks shared by PDF and DOCX exporters', () => {
    const document = { htmlPreview: '<article><h1>Acta</h1><h2>Decisiones</h2><ul><li>Aprobar piloto</li></ul><p>Resumen &amp; contexto.</p></article>' } as ProjectDocument;
    expect(DocumentExportService.blocksFromHtml(document.htmlPreview)).toEqual([
      { kind: 'title', text: 'Acta' }, { kind: 'heading', text: 'Decisiones' }, { kind: 'list', text: 'Aprobar piloto' }, { kind: 'paragraph', text: 'Resumen & contexto.' },
    ]);
  });
});
