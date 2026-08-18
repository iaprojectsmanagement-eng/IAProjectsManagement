import { Project, Student } from '../types';

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export const hasAvailableCapacity = (project: Project): boolean =>
  project.assignedStudents.length < project.maxStudents;

/** Capacity informs the catalog; it does not reject a team decision by management. */
export const canAcceptStudent = (_project: Project, _studentEmail: string): boolean => true;

/** Moves students to one destination and removes them from every other team.
 * Capacity is informational: management may deliberately keep an oversized team.
 */
export const assignStudentsExclusively = (projects: Project[], targetProjectId: string, students: Student[]): Project[] => {
  const target = projects.find((project) => project.id === targetProjectId);
  if (!target) throw new Error('Proyecto de destino no encontrado.');
  const selectedByEmail = new Map(
    students.map((student) => [normaliseEmail(student.email), { ...student, projectId: targetProjectId }])
  );
  const selectedStudents = [...selectedByEmail.values()];
  return projects.map((project) => ({
    ...project,
    assignedStudents: project.id === targetProjectId
      ? selectedStudents
      : project.assignedStudents.filter((student) => !selectedByEmail.has(normaliseEmail(student.email)))
  }));
};
