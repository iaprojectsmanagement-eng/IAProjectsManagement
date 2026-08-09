import { Project, Student, Application, MeetingMinute, Deliverable, AlertItem, ChatMessage } from '../types';
import { INITIAL_PROJECTS } from '../data/seedProjects';
import Papa from 'papaparse';
import { assignStudentsExclusively, canAcceptStudent, normaliseEmail } from './projectRules';

const STORAGE_KEYS = {
  PROJECTS: 'ia_hub_projects',
  APPLICATIONS: 'ia_hub_applications',
  MINUTES: 'ia_hub_minutes',
  DELIVERABLES: 'ia_hub_deliverables',
  ALERTS: 'ia_hub_alerts',
  MESSAGES: 'ia_hub_messages',
  STUDENTS: 'ia_hub_students',
};

const getStoredData = <T>(key: string, defaultData: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch (e) {
    return defaultData;
  }
};

const setStoredData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Storage save error:', e);
  }
};

export const DataService = {
  // --- Projects CRUD ---
  getProjects: (): Project[] => {
    return getStoredData<Project[]>(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  },

  saveProjects: (projects: Project[]): void => {
    setStoredData(STORAGE_KEYS.PROJECTS, projects);
  },

  getStudents: (): Student[] => getStoredData<Student[]>(STORAGE_KEYS.STUDENTS, []),

  saveStudents: (students: Student[]): void => setStoredData(STORAGE_KEYS.STUDENTS, students),

  getProjectById: (id: string): Project | undefined => {
    const projects = DataService.getProjects();
    return projects.find((p) => p.id === id);
  },

  addProject: (newProjectData: Omit<Project, 'id' | 'lastActivityAt'>): Project[] => {
    const projects = DataService.getProjects();
    const created: Project = {
      ...newProjectData,
      id: crypto.randomUUID(),
      lastActivityAt: new Date().toISOString()
    };
    const updated = [created, ...projects];
    DataService.saveProjects(updated);
    return updated;
  },

  editProject: (updatedProject: Project): Project[] => {
    const projects = DataService.getProjects();
    const index = projects.findIndex((p) => p.id === updatedProject.id);
    if (index !== -1) {
      projects[index] = {
        ...updatedProject,
        lastActivityAt: new Date().toISOString()
      };
      DataService.saveProjects(projects);
    }
    return projects;
  },

  deleteProject: (projectId: string): Project[] => {
    const projects = DataService.getProjects();
    const updated = projects.filter((p) => p.id !== projectId);
    DataService.saveProjects(updated);
    return updated;
  },

  updateProject: (updatedProject: Project): Project[] => {
    return DataService.editProject(updatedProject);
  },

  /**
   * Automatically parses any uploaded CSV and extracts projects data,
   * making all non-essential fields optional.
   */
  importProjectsFromCSV: (csvText: string): { importedCount: number; projects: Project[] } => {
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true
    });

    const currentProjects = DataService.getProjects();
    const newProjectsList: Project[] = [...currentProjects];
    let count = 0;

    parsed.data.forEach((row, idx) => {
      // Extract key column headers with fuzzy matching
      const company = row['Organización'] || row['Organización'] || row['Empresa'] || row['Organizacion'] || 'Coomeva';
      const code = row['Carpeta compartida'] || row['Grupo'] || row['Codigo'] || `PROJ_${Date.now()}_${idx}`;
      const description = row['Descripción del reto'] || row['Descripcion del reto'] || row['Detalle'] || '';
      const wapp = row['Wapp'] || row['WhatsApp'] || '';
      const progressStr = row['Progreso 10 Julio 2026'] || row['Progreso'] || 'En Progreso';
      const studentsStr = row['Equipo de estudiantes ICESI'] || row['Estudiantes'] || '';
      const contactsStr = row['Datos de integrantes Organización'] || row['Contactos'] || '';
      const aiTypeStr = row['Tipo de IA (Clasificación, regresión, pronóstico, Automatización, Visión Artificial, recomendadores, Agentes, Inteligencia Artificial )'] || row['Tipo de IA'] || '';
      const copImpactStr = row['Describa el impacto en COP al año'] || row['Impacto en COP'] || '';
      const complexityStr = row['Complejidad \n( 1-  a 10+)'] || row['Complejidad'] || '5';
      const impactRatingStr = row['Evaluación cuantitativa del Impacto en la organización (1 a 10)'] || row['Impacto'] || '8';
      const aiRisks = row['Riesgos asociados al uso de la IA  (IA Responsable)'] || row['Riesgos'] || '';
      const datasets = row['Datasets necesarios'] || row['Datasets'] || '';
      const dataQuality = row['Disponibilidad y Calidad de los datos'] || '';
      const techViability = row['Viabilidad tecnológica'] || '';

      // Parse students if present
      const assignedStudents: Student[] = [];
      if (studentsStr.trim()) {
        const studentParts = studentsStr.split(',');
        studentParts.forEach((part, sIdx) => {
          const trimmed = part.trim();
          if (trimmed) {
            assignedStudents.push({
              id: `st-csv-${Date.now()}-${sIdx}`,
              name: trimmed.split('-')[0]?.trim() || trimmed,
              email: trimmed.includes('@') ? trimmed.split('-').pop()?.trim() || '' : `${trimmed.toLowerCase().replace(/\s+/g, '')}@u.icesi.edu.co`,
              code: `220${1000 + idx * 5 + sIdx}`
            });
          }
        });
      }

      // Parse contacts if present
      const contacts: { name: string; email: string }[] = [];
      if (contactsStr.trim()) {
        const contactParts = contactsStr.split(',');
        contactParts.forEach((cp) => {
          const cTrim = cp.trim();
          if (cTrim) {
            contacts.push({
              name: cTrim.split(':')[0]?.trim() || cTrim,
              email: cTrim.includes('@') ? cTrim.split(':').pop()?.trim() || '' : ''
            });
          }
        });
      }

      // Parse numeric values safely
      const complexityRating = parseInt(complexityStr.replace(/[^0-9]/g, '')) || 5;
      const impactRating = parseInt(impactRatingStr.replace(/[^0-9]/g, '')) || 8;

      // Extract COP numeric value if possible
      let copImpactAnnual = 0;
      if (copImpactStr.includes('280') || copImpactStr.includes('480')) copImpactAnnual = 380000000;
      else if (copImpactStr.includes('466')) copImpactAnnual = 466000000;
      else if (copImpactStr.includes('34')) copImpactAnnual = 34000000;
      else if (copImpactStr.includes('20')) copImpactAnnual = 20000000;

      // Calculate progress %
      let progressPct = 40;
      if (progressStr.toLowerCase().includes('terminado')) progressPct = 100;
      else if (progressStr.includes('80')) progressPct = 80;
      else if (progressStr.includes('30')) progressPct = 30;

      const aiType = aiTypeStr
        .split(/[,+]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const title = description ? description.slice(0, 100) + '...' : `Proyecto ${code}`;

      const newProj: Project = {
        id: `proj-csv-${Date.now()}-${idx}`,
        code: code.trim() || `PROJ_${idx + 1}`,
        companyName: company.trim() || 'Coomeva',
        title: title.trim(),
        challengeDescription: description.trim() || 'Descripción pendiente por definir.',
        whatsappUrl: wapp.startsWith('http') ? wapp.trim() : undefined,
        sharedFolderName: code.trim(),
        progressStatus: progressStr.trim() || 'En Progreso',
        progressPct,
        riskLevel: progressPct === 100 ? 'verde' : progressPct < 20 ? 'rojo' : 'amarillo',
        minStudents: 2,
        maxStudents: 5,
        contacts,
        assignedStudents,
        aiType: aiType.length > 0 ? aiType : ['IA'],
        copImpactDescription: copImpactStr.trim(),
        copImpactAnnual: copImpactAnnual > 0 ? copImpactAnnual : undefined,
        impactRating,
        complexityRating,
        aiRisks: aiRisks.trim(),
        requiredDatasets: datasets.trim(),
        dataQualityAvailability: dataQuality.trim(),
        techViability: techViability.trim(),
        lastActivityAt: new Date().toISOString()
      };

      newProjectsList.unshift(newProj);
      count++;
    });

    DataService.saveProjects(newProjectsList);
    return { importedCount: count, projects: newProjectsList };
  },

  // --- Applications ---
  getApplications: (): Application[] => {
    return getStoredData<Application[]>(STORAGE_KEYS.APPLICATIONS, []);
  },

  applyToProject: (projectId: string, student: { id: string; name: string; email: string }): Application[] => {
    const apps = DataService.getApplications();
    const project = DataService.getProjectById(projectId);
    if (!project) throw new Error('El proyecto seleccionado ya no existe.');
    if (!canAcceptStudent(project, student.email)) throw new Error('Este proyecto ya alcanzó el máximo de estudiantes.');

    const existing = apps.find((a) => a.projectId === projectId && normaliseEmail(a.studentEmail) === normaliseEmail(student.email));
    if (existing) return apps;

    const newApp: Application = {
      id: crypto.randomUUID(),
      projectId,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      status: 'pendiente',
      createdAt: new Date().toISOString()
    };
    const updated = [newApp, ...apps];
    setStoredData(STORAGE_KEYS.APPLICATIONS, updated);
    return updated;
  },

  acceptApplication: (applicationId: string): { projects: Project[]; applications: Application[] } => {
    let apps = DataService.getApplications();
    const targetApp = apps.find((a) => a.id === applicationId);
    if (!targetApp) return { projects: DataService.getProjects(), applications: apps };

    let projects = DataService.getProjects();
    const project = projects.find((p) => p.id === targetApp.projectId);

    if (project) {
      if (!canAcceptStudent(project, targetApp.studentEmail)) {
        throw new Error('No se puede aceptar la postulación: el proyecto ya alcanzó su capacidad máxima.');
      }
      const newStudent: Student = { id: targetApp.studentId, name: targetApp.studentName, email: targetApp.studentEmail, projectId: project.id };
      const exactTeam = [...project.assignedStudents.filter((student) => normaliseEmail(student.email) !== normaliseEmail(newStudent.email)), newStudent];
      projects = assignStudentsExclusively(projects, project.id, exactTeam);
      DataService.saveProjects(projects);
    }

    apps = apps.map((a) => (a.id === applicationId ? { ...a, status: 'aceptada' as const } : a));
    apps = apps.map((application) => application.studentId === targetApp.studentId && application.id !== applicationId ? { ...application, status: 'rechazada' as const } : application);

    setStoredData(STORAGE_KEYS.APPLICATIONS, apps);
    return { projects, applications: apps };
  },

  rejectApplication: (applicationId: string): Application[] => {
    let apps = DataService.getApplications();
    apps = apps.map((a) => (a.id === applicationId ? { ...a, status: 'rechazada' as const } : a));
    setStoredData(STORAGE_KEYS.APPLICATIONS, apps);
    return apps;
  },

  // --- Meeting Minutes ---
  getMinutesByProject: (projectId: string): MeetingMinute[] => {
    const minutes = getStoredData<MeetingMinute[]>(STORAGE_KEYS.MINUTES, []);
    return minutes.filter((m) => m.projectId === projectId);
  },

  getMinutes: (): MeetingMinute[] => getStoredData<MeetingMinute[]>(STORAGE_KEYS.MINUTES, []),

  addMinute: (minute: MeetingMinute): MeetingMinute[] => {
    const minutes = getStoredData<MeetingMinute[]>(STORAGE_KEYS.MINUTES, []);
    const updated = [minute, ...minutes];
    setStoredData(STORAGE_KEYS.MINUTES, updated);

    const projects = DataService.getProjects();
    const proj = projects.find((p) => p.id === minute.projectId);
    if (proj) {
      proj.lastActivityAt = new Date().toISOString();
      proj.emptyFieldsWarning = false;
      DataService.saveProjects(projects);
    }
    return updated;
  },

  reassignMinute: (minuteId: string, targetProjectId: string): void => {
    const minutes = getStoredData<MeetingMinute[]>(STORAGE_KEYS.MINUTES, []);
    const min = minutes.find((m) => m.id === minuteId);
    if (min) {
      const targetProj = DataService.getProjectById(targetProjectId);
      min.projectId = targetProjectId;
      if (targetProj) min.projectTitle = targetProj.title;
      setStoredData(STORAGE_KEYS.MINUTES, minutes);
    }
  },

  deleteMinute: (minuteId: string): void => {
    const minutes = getStoredData<MeetingMinute[]>(STORAGE_KEYS.MINUTES, []);
    const updated = minutes.filter((m) => m.id !== minuteId);
    setStoredData(STORAGE_KEYS.MINUTES, updated);
  },

  // --- Hybrid Chat Messages ---
  getMessagesByProject: (projectId: string): ChatMessage[] => {
    const messages = getStoredData<ChatMessage[]>(STORAGE_KEYS.MESSAGES, []);
    return messages.filter((m) => m.projectId === projectId);
  },

  sendMessage: (msg: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage => {
    const messages = getStoredData<ChatMessage[]>(STORAGE_KEYS.MESSAGES, []);
    const newMsg: ChatMessage = {
      ...msg,
      id: 'msg-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    const updated = [...messages, newMsg];
    setStoredData(STORAGE_KEYS.MESSAGES, updated);
    return newMsg;
  },

  // --- Alerts ---
  getAlerts: (): AlertItem[] => {
    return getStoredData<AlertItem[]>(STORAGE_KEYS.ALERTS, []);
  },

  createAlert: (alert: Omit<AlertItem, 'id' | 'createdAt'>): AlertItem => {
    const alerts = DataService.getAlerts();
    const newAlert: AlertItem = {
      ...alert,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    setStoredData(STORAGE_KEYS.ALERTS, [newAlert, ...alerts]);
    return newAlert;
  }
};
