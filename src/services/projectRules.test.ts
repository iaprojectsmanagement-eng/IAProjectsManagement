import { describe, expect, it } from 'vitest';
import { Project } from '../types';
import { assignStudentsExclusively, canAcceptStudent, hasAvailableCapacity, normaliseEmail } from './projectRules';

const createProject = (assignedStudents: Project['assignedStudents'], maxStudents = 2): Project => ({
  id: 'project-1',
  code: 'PRJ-1',
  companyName: 'Coomeva',
  title: 'Proyecto de prueba',
  progressPct: 0,
  riskLevel: 'verde',
  minStudents: 2,
  maxStudents,
  contacts: [],
  assignedStudents,
  aiType: ['IA'],
  complexityRating: 5,
  lastActivityAt: '2026-07-31T00:00:00.000Z'
});

describe('project rules', () => {
  it('normalises email addresses before identity checks', () => {
    expect(normaliseEmail('  Student@U.Icesi.edu.co ')).toBe('student@u.icesi.edu.co');
  });

  it('keeps capacity informational when management accepts a new student', () => {
    const project = createProject([
      { id: 'student-1', name: 'Student One', email: 'one@u.icesi.edu.co' },
      { id: 'student-2', name: 'Student Two', email: 'two@u.icesi.edu.co' }
    ]);

    expect(hasAvailableCapacity(project)).toBe(false);
    expect(canAcceptStudent(project, 'new@u.icesi.edu.co')).toBe(true);
  });

  it('allows accepting a student already assigned without duplicating capacity', () => {
    const project = createProject([
      { id: 'student-1', name: 'Student One', email: 'one@u.icesi.edu.co' },
      { id: 'student-2', name: 'Student Two', email: 'two@u.icesi.edu.co' }
    ]);

    expect(canAcceptStudent(project, 'ONE@u.icesi.edu.co')).toBe(true);
  });

  it('moves a student to the destination project and removes prior membership', () => {
    const first = createProject([{ id: 'student-a', name: 'A', email: 'a@u.icesi.edu.co' }]);
    const second = { ...createProject([], 2), id: 'project-2' };
    const moved = assignStudentsExclusively([first, second], 'project-2', [{ id: 'student-a', name: 'A', email: 'a@u.icesi.edu.co' }]);

    expect(moved[0].assignedStudents).toHaveLength(0);
    expect(moved[1].assignedStudents.map((student) => student.email)).toEqual(['a@u.icesi.edu.co']);
  });

  it('removes a deselected student from the destination team', () => {
    const first = createProject([
      { id: 'student-a', name: 'A', email: 'a@u.icesi.edu.co' },
      { id: 'student-b', name: 'B', email: 'b@u.icesi.edu.co' }
    ]);

    const updated = assignStudentsExclusively(
      [first],
      first.id,
      [{ id: 'student-b', name: 'B', email: 'b@u.icesi.edu.co' }]
    );

    expect(updated[0].assignedStudents.map((student) => student.email)).toEqual(['b@u.icesi.edu.co']);
  });

  it('deduplicates a selected team by normalized email', () => {
    const project = createProject([], 3);
    const updated = assignStudentsExclusively([project], project.id, [
      { id: 'student-a', name: 'A', email: 'A@u.icesi.edu.co' },
      { id: 'student-a-copy', name: 'A duplicado', email: ' a@u.icesi.edu.co ' }
    ]);

    expect(updated[0].assignedStudents).toHaveLength(1);
  });
});
