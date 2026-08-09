import { AuditEvent } from '../types';
import { SyncService, toDatabase } from './syncService';

const KEY = 'ia_hub_audit_log';
const read = (): AuditEvent[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const sensitive = /password|token|secret|rawText|transcriptText/i;
const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, sanitize(item)]));
  if (typeof value === 'string' && value.length > 2_000) return `${value.slice(0, 2_000)}… [recortado para auditoría]`;
  return value;
};

export const AuditService = {
  getEvents: (projectId?: string) => projectId ? read().filter((event) => event.projectId === projectId) : read(),
  record: (event: Omit<AuditEvent, 'id' | 'createdAt'>) => {
    const item: AuditEvent = { ...event, beforeData: sanitize(event.beforeData), afterData: sanitize(event.afterData), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify([item, ...read()].slice(0, 5_000)));
    SyncService.enqueueUpsert('audit_log', toDatabase.audit(item));
    return item;
  },
};
