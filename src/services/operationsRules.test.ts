import { describe, expect, it } from 'vitest';
import { canChangeMeetingTo, isTaskOverdue, meetingNeedsMinute, needsMonitorAttention } from './operationsRules';

describe('operational follow-up rules', () => {
  it('marks incomplete past-due tasks as overdue', () => {
    expect(isTaskOverdue({ dueDate: '2026-08-01', status: 'en_progreso' } as any, '2026-08-07')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-08-01', status: 'completada' } as any, '2026-08-07')).toBe(false);
  });

  it('puts critical and overdue issues in the monitor queue', () => {
    expect(needsMonitorAttention({ priority: 'critica', status: 'abierta' } as any, '2026-08-07')).toBe(true);
    expect(needsMonitorAttention({ priority: 'baja', status: 'resuelta' } as any, '2026-08-07')).toBe(false);
  });

  it('requires a minute only for completed meetings without one', () => {
    expect(meetingNeedsMinute({ status: 'realizada' } as any)).toBe(true);
    expect(meetingNeedsMinute({ status: 'programada' } as any)).toBe(false);
    expect(canChangeMeetingTo('cancelada', 'reprogramada')).toBe(true);
    expect(canChangeMeetingTo('realizada', 'cancelada')).toBe(false);
  });
});
