import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleDot,
  ChevronRight,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileText,
  Link as LinkIcon,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Info,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DocumentTemplate,
  DocumentSourceFile,
  InstitutionalDocumentType,
  MeetingMinute,
  Project,
  ProjectDocument,
  ProjectDocumentVersion,
  ProjectIssue,
  ProjectMeeting,
  ProjectTask,
  TaskPriority,
} from '../types';
import { AIService, TranscriptAnalysisResult } from '../services/aiService';
import { OperationsService, taskPriorities, taskStatuses } from '../services/operationsService';
import { isTaskOverdue, meetingNeedsMinute, needsMonitorAttention, priorityLabel } from '../services/operationsRules';
import { StorageService } from '../services/storageService';
import { DocumentExportService } from '../services/documentExportService';
import { CalendarService } from '../services/calendarService';
import { SyncService } from '../services/syncService';
import { DocumentWorkflowService } from '../services/documentWorkflowService';
import { INSTITUTIONAL_TEMPLATES, templateByType } from '../data/institutionalTemplates';

export const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(parsed);
};

const projectCode = (projects: Project[], id: string) => projects.find((project) => project.id === id)?.code || 'Proyecto';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{children}</section>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({
  children,
  tone = 'primary',
  className = '',
  ...props
}) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
      tone === 'primary'
        ? 'bg-[#514ff0] text-white hover:bg-[#403dc9]'
        : tone === 'danger'
          ? 'bg-rose-600 text-white hover:bg-rose-700'
          : tone === 'ghost'
            ? 'text-slate-600 hover:bg-slate-100'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    } ${className}`}
  >
    {children}
  </button>
);

const Badge: React.FC<{ children: React.ReactNode; tone?: 'red' | 'amber' | 'green' | 'indigo' | 'slate' }> = ({ children, tone = 'slate' }) => {
  const label = typeof children === 'string' ? children.toLowerCase() : '';
  const markerTone = label.includes('alta') || label.includes('crit') || label.includes('vencid') || label.includes('acta') ? 'red' as const : tone;
  const Icon = markerTone === 'red' ? AlertTriangle : markerTone === 'amber' ? Clock3 : markerTone === 'green' ? Check : markerTone === 'indigo' ? Info : CircleDot;
  return <span className={`status-marker status-marker--${markerTone}`}><Icon className="h-3 w-3" aria-hidden="true" />{children}</span>;
};

const RiskFilter: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 'todos', label: 'Todos los riesgos', tone: 'slate' as const },
    { value: 'rojo', label: 'Riesgo rojo', tone: 'red' as const },
    { value: 'amarillo', label: 'Riesgo amarillo', tone: 'amber' as const },
    { value: 'verde', label: 'Riesgo verde', tone: 'green' as const },
  ];
  const selected = options.find((option) => option.value === value) || options[0];
  return <div className="risk-filter relative"><button type="button" className="risk-filter-trigger flex w-full items-center justify-between gap-3" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}><Badge tone={selected.tone}>{selected.label}</Badge><ChevronDown className="h-4 w-4" /></button>{open && <div className="risk-filter-menu absolute right-0 top-full z-20 mt-1 w-full min-w-[210px]" role="listbox">{options.map((option) => <button type="button" key={option.value} role="option" aria-selected={option.value === value} className="risk-filter-option flex w-full items-center justify-between" onClick={() => { onChange(option.value); setOpen(false); }}><Badge tone={option.tone}>{option.label}</Badge>{option.value === value && <Check className="h-4 w-4" />}</button>)}</div>}</div>;
};

const Heading: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-black text-slate-900">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{text}</p>
    </div>
    {action}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{text}</p>;

interface Common {
  projects: Project[];
  onChanged: () => void;
  onOpenProject: (id: string) => void;
}

export const MonitorHome: React.FC<Common> = ({ projects, onOpenProject }) => {
  const issues = OperationsService.getIssues().filter((issue) => needsMonitorAttention(issue));
  const overdue = OperationsService.getTasks().filter((task) => isTaskOverdue(task));
  const minutes = OperationsService.getMeetings().filter(meetingNeedsMinute);
  const actions = [
    ...issues.map((issue) => ({ id: issue.id, projectId: issue.projectId, label: issue.title, detail: 'Incidencia prioritaria', tone: 'red' as const })),
    ...overdue.map((task) => ({ id: task.id, projectId: task.projectId, label: task.title, detail: `Tarea vencida · ${task.assigneeName}`, tone: 'amber' as const })),
    ...minutes.map((meeting) => ({ id: meeting.id, projectId: meeting.projectId, label: meeting.title, detail: 'Reunión realizada sin acta', tone: 'indigo' as const })),
  ].slice(0, 10);

  return (
    <div className="home-dashboard mx-auto max-w-6xl">
      <Heading title="Seguimiento del día" text="Una bandeja de trabajo priorizada: abre el proyecto y resuelve lo que requiere intervención." />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [issues.length, 'Incidencias prioritarias', 'text-rose-600'],
          [overdue.length, 'Tareas vencidas', 'text-amber-600'],
          [minutes.length, 'Actas pendientes', 'text-indigo-600'],
        ].map(([count, label, color]) => (
          <Card key={String(label)}>
            <p className="text-xs font-bold text-slate-500">{String(label)}</p>
            <p className={`mt-2 text-3xl font-black ${color}`}>{String(count)}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold">Pendientes a resolver</h2>
          <span className="text-xs text-slate-400">{actions.length} visibles</span>
        </div>
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={`${action.detail}-${action.id}`}
              onClick={() => onOpenProject(action.projectId)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <Badge tone={action.tone}>{action.detail}</Badge>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{action.label}</b>
                <small className="text-slate-500">{projectCode(projects, action.projectId)}</small>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
          {!actions.length && <Empty text="No hay pendientes críticos. Los nuevos bloqueos, vencimientos y actas aparecerán aquí." />}
        </div>
      </Card>
    </div>
  );
};

export const ProjectsView: React.FC<Common> = ({ projects, onOpenProject, onChanged }) => {
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('todos');
  const [create, setCreate] = useState(false);
  const [newProject, setNewProject] = useState({ code: '', companyName: '', title: '', challengeDescription: '', maxStudents: 5 });
  const filtered = projects.filter((project) => {
    const matchesText = `${project.code} ${project.title} ${project.companyName}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (risk === 'todos' || project.riskLevel === risk);
  });

  return (
    <div className="projects-view mx-auto max-w-6xl">
      <div className="mb-4 flex justify-end"><Button onClick={() => setCreate((value) => !value)}><Plus className="h-4 w-4" />Nuevo proyecto</Button></div>
      <Heading title="Proyectos" text="Cada proyecto es un único espacio de trabajo con su equipo, reuniones, tareas, incidencias y documentos." action={<Button onClick={() => setCreate((value) => !value)}><Plus className="h-4 w-4" />Nuevo proyecto</Button>} />
      {create && <form onSubmit={(event) => { event.preventDefault(); OperationsService.createProject({ ...newProject, code: newProject.code.trim(), companyName: newProject.companyName.trim(), title: newProject.title.trim(), challengeDescription: newProject.challengeDescription.trim() }); setNewProject({ code: '', companyName: '', title: '', challengeDescription: '', maxStudents: 5 }); setCreate(false); onChanged(); }} className="mb-4 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-slate-600">Código único<input required value={newProject.code} onChange={(event) => setNewProject({ ...newProject, code: event.target.value })} className={`${inputClass} mt-1`} placeholder="Ej. 21_ANALITICA" /></label><label className="text-xs font-bold text-slate-600">Organización<input required value={newProject.companyName} onChange={(event) => setNewProject({ ...newProject, companyName: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600 md:col-span-2">Nombre del proyecto<input required value={newProject.title} onChange={(event) => setNewProject({ ...newProject, title: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600 md:col-span-2">Descripción del reto<textarea value={newProject.challengeDescription} onChange={(event) => setNewProject({ ...newProject, challengeDescription: event.target.value })} className={`${inputClass} mt-1`} rows={3} /></label><label className="text-xs font-bold text-slate-600">Capacidad máxima<input required type="number" min={1} max={20} value={newProject.maxStudents} onChange={(event) => setNewProject({ ...newProject, maxStudents: Number(event.target.value) })} className={`${inputClass} mt-1`} /></label></div><div className="flex gap-2"><Button type="submit"><Save className="h-4 w-4" />Crear proyecto</Button><Button type="button" tone="ghost" onClick={() => setCreate(false)}>Cancelar</Button></div></form>}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder="Buscar por código, empresa o reto" />
        </label>
        <RiskFilter value={risk} onChange={setRisk} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => {
          const openTasks = OperationsService.getTasks(project.id).filter((task) => task.status !== 'completada').length;
          const openIssues = OperationsService.getIssues(project.id).filter((issue) => issue.status !== 'resuelta').length;
          return (
            <Card key={project.id} className="project-card p-4" onClick={() => onOpenProject(project.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Badge tone={project.riskLevel === 'rojo' ? 'red' : project.riskLevel === 'amarillo' ? 'amber' : 'green'}>{project.code}</Badge><span className="text-xs text-slate-400">{project.companyName}</span></div>
                  <h2 className="mt-2 line-clamp-2 font-extrabold">{project.title}</h2>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2"><b className="block">{project.assignedStudents.length}/{project.maxStudents}</b><small className="text-slate-500">equipo</small></div>
                <div className="rounded-xl bg-slate-50 p-2"><b className="block">{openTasks}</b><small className="text-slate-500">tareas</small></div>
                <div className="rounded-xl bg-slate-50 p-2"><b className="block">{openIssues}</b><small className="text-slate-500">incidencias</small></div>
              </div>
            </Card>
          );
        })}
        {!filtered.length && <Empty text="No hay proyectos que coincidan con los filtros." />}
      </div>
    </div>
  );
};

const TaskForm: React.FC<{ project: Project; onDone: () => void; onCancel: () => void }> = ({ project, onDone, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState(project.assignedStudents[0]?.email || '');
  const [dueDate, setDueDate] = useState(inDays(3));
  const [priority, setPriority] = useState<TaskPriority>('media');
  const selectedStudent = project.assignedStudents.find((student) => student.email === assigneeEmail);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        OperationsService.createTask({
          projectId: project.id,
          title: title.trim(),
          description: description.trim(),
          assigneeName: selectedStudent?.name || 'Por asignar',
          assigneeEmail: selectedStudent?.email,
          dueDate: dueDate || undefined,
          status: 'pendiente',
          priority,
          source: 'manual',
        });
        onDone();
      }}
      className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Título<input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-1`} placeholder="Resultado verificable" /></label>
        <label className="text-xs font-bold text-slate-600">Responsable<select value={assigneeEmail} onChange={(event) => setAssigneeEmail(event.target.value)} className={`${inputClass} mt-1`}><option value="">Por asignar</option>{project.assignedStudents.map((student) => <option key={student.email} value={student.email}>{student.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Fecha límite<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-bold text-slate-600">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={`${inputClass} mt-1`}>{taskPriorities.map((item) => <option key={item} value={item}>{priorityLabel[item]}</option>)}</select></label>
      </div>
      <label className="block text-xs font-bold text-slate-600">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-1`} rows={3} placeholder="Alcance, criterio de terminado o enlace de referencia" /></label>
      <div className="flex gap-2"><Button type="submit"><Save className="h-4 w-4" />Crear tarea</Button><Button type="button" tone="ghost" onClick={onCancel}>Cancelar</Button></div>
    </form>
  );
};

export const TasksView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({ projects, projectId, onChanged, onOpenProject, isMonitor = true }) => {
  const [create, setCreate] = useState(false);
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState('abiertas');
  const project = projects.find((item) => item.id === (projectId || globalProject));
  const tasks = OperationsService.getTasks(projectId).filter((task) => statusFilter === 'todas' || (statusFilter === 'abiertas' ? task.status !== 'completada' : task.status === statusFilter));

  return (
    <div className="mx-auto max-w-6xl">
      <Heading
        title={projectId ? 'Tareas del equipo' : 'Tareas'}
        text={projectId ? 'Toda nueva tarea queda vinculada automáticamente a este proyecto.' : 'Vista transversal para seguimiento del monitor.'}
        action={<Button onClick={() => setCreate((value) => !value)}><Plus className="h-4 w-4" />Nueva tarea</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold" aria-label="Filtrar tareas">
          <option value="abiertas">Abiertas</option><option value="todas">Todas</option>{taskStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
      </div>
      {create && project && (
        <div className="mb-4">
          {!projectId && <label className="mb-3 block max-w-md text-xs font-bold text-slate-600">Proyecto<select value={globalProject} onChange={(event) => setGlobalProject(event.target.value)} className={`${inputClass} mt-1`}>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>}
          <TaskForm project={project} onCancel={() => setCreate(false)} onDone={() => { setCreate(false); onChanged(); }} />
        </div>
      )}
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center gap-3 p-4">
              <button
                aria-label={task.status === 'completada' ? 'Reabrir tarea' : 'Marcar tarea como completada'}
                onClick={() => { OperationsService.updateTask(task.id, { status: task.status === 'completada' ? 'pendiente' : 'completada' }); onChanged(); }}
                className={`grid h-7 w-7 place-items-center rounded-full border ${task.status === 'completada' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:text-slate-400'}`}
              ><Check className="h-4 w-4" /></button>
              <div className="min-w-[220px] flex-1">
                <b className={`block text-sm ${task.status === 'completada' ? 'text-slate-400 line-through' : ''}`}>{task.title}</b>
                {task.description && <p className="mt-1 text-xs text-slate-500">{task.description}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{projectCode(projects, task.projectId)} · {task.assigneeName} · {formatDate(task.dueDate)} · fuente: {task.source}</p>
              </div>
              <Badge tone={isTaskOverdue(task) ? 'red' : task.priority === 'alta' || task.priority === 'critica' ? 'amber' : 'slate'}>{isTaskOverdue(task) ? 'vencida' : priorityLabel[task.priority]}</Badge>
              <select value={task.status} onChange={(event) => { OperationsService.updateTask(task.id, { status: event.target.value as ProjectTask['status'] }); onChanged(); }} className="rounded-lg border border-slate-200 p-2 text-xs" aria-label={`Estado de ${task.title}`}>{taskStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
              {!projectId && <Button tone="secondary" onClick={() => onOpenProject(task.projectId)}>Ver</Button>}
              {isMonitor && <Button tone="ghost" aria-label={`Eliminar ${task.title}`} onClick={() => { if (window.confirm('¿Eliminar esta tarea?')) { OperationsService.deleteTask(task.id); onChanged(); } }}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
            </div>
          ))}
          {!tasks.length && <div className="p-5"><Empty text="No hay tareas en este filtro." /></div>}
        </div>
      </Card>
    </div>
  );
};

const IssueForm: React.FC<{ project: Project; onDone: () => void; onCancel: () => void }> = ({ project, onDone, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProjectIssue['category']>('tecnico');
  const [priority, setPriority] = useState<TaskPriority>('media');
  return (
    <form onSubmit={(event) => { event.preventDefault(); OperationsService.createIssue({ projectId: project.id, title: title.trim(), description: description.trim(), category, priority, reportedBy: 'Equipo del proyecto' }); onDone(); }} className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Título<input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-1`} placeholder="¿Qué impide avanzar?" /></label>
        <label className="text-xs font-bold text-slate-600">Categoría<select value={category} onChange={(event) => setCategory(event.target.value as ProjectIssue['category'])} className={`${inputClass} mt-1`}><option value="tecnico">Técnico</option><option value="datos_accesos">Datos o accesos</option><option value="comunicacion">Comunicación</option><option value="equipo">Equipo</option><option value="recursos">Recursos</option><option value="otro">Otro</option></select></label>
      </div>
      <label className="block text-xs font-bold text-slate-600">Contexto<textarea required value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-1`} rows={4} placeholder="Describe qué ocurrió, qué intentaron, desde cuándo y qué ayuda necesitan." /></label>
      <label className="block max-w-xs text-xs font-bold text-slate-600">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={`${inputClass} mt-1`}>{taskPriorities.map((item) => <option key={item} value={item}>{priorityLabel[item]}</option>)}</select></label>
      <div className="flex gap-2"><Button type="submit" tone="danger"><AlertTriangle className="h-4 w-4" />Enviar al monitor</Button><Button type="button" tone="ghost" onClick={onCancel}>Cancelar</Button></div>
    </form>
  );
};

export const IssuesView: React.FC<Common & { projectId?: string; isStudent?: boolean }> = ({ projects, projectId, onChanged, onOpenProject, isStudent }) => {
  const [create, setCreate] = useState(false);
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const project = projects.find((item) => item.id === (projectId || globalProject));
  const issues = OperationsService.getIssues(projectId);

  return (
    <div className="mx-auto max-w-6xl">
      <Heading title={isStudent ? 'Incidencias de mi proyecto' : 'Incidencias'} text={isStudent ? 'Reporta un bloqueo con contexto suficiente. El proyecto ya está seleccionado.' : 'Clasifica, asigna y documenta la resolución de cada bloqueo.'} action={<Button tone="danger" onClick={() => setCreate((value) => !value)}><Plus className="h-4 w-4" />Reportar incidente</Button>} />
      {create && project && <div className="mb-4">{!projectId && <label className="mb-3 block max-w-md text-xs font-bold text-slate-600">Proyecto<select value={globalProject} onChange={(event) => setGlobalProject(event.target.value)} className={`${inputClass} mt-1`}>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>}<IssueForm project={project} onCancel={() => setCreate(false)} onDone={() => { setCreate(false); onChanged(); }} /></div>}
      <div className="grid gap-3 md:grid-cols-2">
        {issues.map((issue) => (
          <Card key={issue.id}>
            <div className="flex justify-between gap-3"><div><h2 className="font-extrabold">{issue.title}</h2><p className="mt-1 text-xs text-slate-500">{projectCode(projects, issue.projectId)} · {issue.category.replace('_', ' ')} · {formatDate(issue.createdAt)}</p></div><Badge tone={issue.priority === 'alta' || issue.priority === 'critica' ? 'red' : 'amber'}>{priorityLabel[issue.priority]}</Badge></div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{issue.description}</p>
            {issue.resolution && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><b>Resolución:</b> {issue.resolution}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isStudent ? <Badge tone={issue.status === 'resuelta' ? 'green' : 'indigo'}>{issue.status.replace('_', ' ')}</Badge> : <>
                <select value={issue.status} onChange={(event) => { const status = event.target.value as ProjectIssue['status']; const resolution = status === 'resuelta' ? window.prompt('Describe brevemente la resolución:', issue.resolution || '') || issue.resolution : issue.resolution; OperationsService.updateIssue(issue.id, { status, resolution }); onChanged(); }} className="rounded-lg border border-slate-200 p-2 text-xs" aria-label={`Estado de ${issue.title}`}><option value="abierta">Abierta</option><option value="en_revision">En revisión</option><option value="esperando_tercero">Esperando tercero</option><option value="resuelta">Resuelta</option></select>
                <Button tone="ghost" onClick={() => { if (window.confirm('¿Eliminar esta incidencia?')) { OperationsService.deleteIssue(issue.id); onChanged(); } }}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
              </>}
              {!projectId && <Button tone="secondary" onClick={() => onOpenProject(issue.projectId)}>Abrir proyecto</Button>}
            </div>
          </Card>
        ))}
        {!issues.length && <Empty text="No hay incidencias registradas." />}
      </div>
    </div>
  );
};

const MeetingForm: React.FC<{ project: Project; onDone: () => void; onCancel: () => void }> = ({ project, onDone, onCancel }) => {
  const [title, setTitle] = useState('Seguimiento de proyecto');
  const [date, setDate] = useState(inDays(1));
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(45);
  const [agenda, setAgenda] = useState('Revisar avances, bloqueos, decisiones y próximos compromisos.');
  const [attendees, setAttendees] = useState(project.assignedStudents.map((student) => student.email));
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    const meeting = OperationsService.createMeeting({ projectId: project.id, title: title.trim(), startsAt: `${date}T${time}:00`, durationMinutes: duration, attendees, agenda: agenda.trim(), timezone: 'America/Bogota', status: 'programada' });
    try {
      if (SyncService.isRemoteMode()) {
        const result = await CalendarService.sync(meeting.id);
        if (result.mode === 'simulado' && result.message) window.alert(result.message);
      }
    } catch (caught) {
      OperationsService.updateMeeting(meeting.id, { calendarSync: 'error' });
      window.alert(`La reunión quedó guardada, pero Calendar no se sincronizó: ${caught instanceof Error ? caught.message : 'error desconocido'}`);
    } finally { setSaving(false); onDone(); }
  };
  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600 md:col-span-2">Título<input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-bold text-slate-600">Fecha<input required type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-bold text-slate-600">Hora<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-bold text-slate-600">Duración (min)<input required type="number" min={15} max={240} step={15} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-bold text-slate-600 md:col-span-2 lg:col-span-3">Agenda<textarea required value={agenda} onChange={(event) => setAgenda(event.target.value)} className={`${inputClass} mt-1`} rows={2} /></label>
      </div>
      <fieldset><legend className="text-xs font-bold text-slate-600">Invitados del equipo</legend><div className="mt-2 flex flex-wrap gap-2">{project.assignedStudents.map((student) => <label key={student.email} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs"><input type="checkbox" checked={attendees.includes(student.email)} onChange={(event) => setAttendees(event.target.checked ? [...attendees, student.email] : attendees.filter((email) => email !== student.email))} />{student.name}</label>)}</div></fieldset>
      <p className="text-[11px] text-slate-500">Zona horaria: America/Bogota. {SyncService.isRemoteMode() ? 'Al guardar se intentará sincronizar con Google Calendar.' : 'Google Calendar está simulado en el entorno local.'}</p>
      <div className="flex gap-2"><Button disabled={saving} type="submit"><CalendarDays className="h-4 w-4" />{saving ? 'Programando…' : 'Programar'}</Button><Button disabled={saving} type="button" tone="ghost" onClick={onCancel}>Cancelar</Button></div>
    </form>
  );
};

const ActaUploader: React.FC<{ project: Project; meeting?: ProjectMeeting; onDone: () => void }> = ({ project, meeting, onDone }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranscriptAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const updateCommitment = (index: number, patch: Partial<TranscriptAnalysisResult['commitments'][number]>) => setResult((current) => current ? { ...current, commitments: current.commitments.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  const updateDecision = (index: number, decision: string) => setResult((current) => current ? { ...current, decisions: current.decisions.map((item, itemIndex) => itemIndex === index ? { ...item, decision } : item) } : current);
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|vtt)$/i.test(file.name)) { setError('Solo se admiten archivos .txt o .vtt.'); return; }
    if (file.size > 2_000_000) { setError('El archivo supera 2 MB. Divide la transcripción antes de cargarla.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result || '')); setSelectedFile(file); setError(''); };
    reader.onerror = () => setError('No fue posible leer el archivo.');
    reader.readAsText(file);
  };
  const analyze = async () => {
    setBusy(true); setError('');
    try { setResult(await AIService.analyzeTranscript(text, project.title, project.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo analizar la transcripción.'); }
    finally { setBusy(false); }
  };
  const saveMinute = async () => {
    if (!result) return;
    setSaving(true); setError('');
    try {
      const file = selectedFile || new File([text], `transcripcion-${meeting?.id || Date.now()}.txt`, { type: 'text/plain' });
      const stored = await StorageService.uploadTranscript(project.id, file);
      OperationsService.saveMinuteFromAnalysis(project, result, { meetingId: meeting?.id, meetingDate: meeting?.startsAt.slice(0, 10), attendees: meeting?.attendees, transcriptStoragePath: stored.path });
      try {
        const sourceFile: DocumentSourceFile = { name: file.name, mimeType: file.type || 'text/plain', size: file.size, storagePath: stored.path, extractedChars: Math.min(text.length, 120_000) };
        const generated = await DocumentWorkflowService.generate({ projectId: project.id, documentType: 'acta_reunion', sourceText: text.slice(0, 120_000), sourceFiles: [sourceFile], instructions: `Reunión: ${meeting?.title || result.title}. Usa como hechos confirmados el resumen, las decisiones y los compromisos revisados por el usuario: ${JSON.stringify(result).slice(0, 12_000)}` });
        const pdf = await DocumentExportService.createAndStorePdf(generated.document);
        await DocumentWorkflowService.attachPdf(generated.document, pdf.stored.path);
      } catch (documentError) {
        window.alert(`El acta estructurada y sus tareas sí quedaron guardadas. La generación del documento institucional quedó pendiente: ${documentError instanceof Error ? documentError.message : 'error desconocido'}`);
      }
      onDone();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar el acta y su transcripción.'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="mt-3 border-indigo-100 bg-indigo-50/20">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-extrabold">{meeting ? `Crear acta · ${meeting.title}` : 'Crear acta sin reunión programada'}</h3><p className="text-xs text-slate-500">TXT/VTT → análisis → revisión humana → acta y tareas de este proyecto.</p></div><Badge tone={AIService.isConfigured() ? 'green' : 'amber'}>{AIService.isConfigured() ? 'IA remota disponible' : 'análisis local demostrativo'}</Badge></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {!result ? (
        <div key="transcript-source" className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-slate-600">Archivo de transcripción<input type="file" accept=".txt,.vtt,text/plain,text/vtt" onChange={upload} className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm" /></label>
          <label className="block text-xs font-bold text-slate-600">Contenido<textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} placeholder="También puedes pegar aquí la transcripción." className={`${inputClass} mt-1`} /></label>
          <Button disabled={!text.trim() || busy} onClick={() => void analyze()}><Sparkles className="h-4 w-4" />{busy ? 'Analizando…' : 'Generar borrador editable'}</Button>
        </div>
      ) : (
        <div key="minute-editor" className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-slate-600">Título<input value={result.title || ''} onChange={(event) => setResult({ ...result, title: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs font-bold text-slate-600">Resumen<textarea value={result.summary || ''} onChange={(event) => setResult({ ...result, summary: event.target.value })} className={`${inputClass} mt-1`} rows={4} /></label>
          <fieldset><legend className="text-xs font-extrabold text-slate-700">Decisiones</legend><div className="mt-2 space-y-2">{result.decisions.map((item, index) => <div key={index} className="flex gap-2"><input value={item.decision || ''} onChange={(event) => updateDecision(index, event.target.value)} className={inputClass} /><Button tone="ghost" aria-label="Eliminar decisión" onClick={() => setResult({ ...result, decisions: result.decisions.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-4 w-4" /></Button></div>)}<Button tone="secondary" onClick={() => setResult({ ...result, decisions: [...result.decisions, { decision: '' }] })}><Plus className="h-4 w-4" />Decisión</Button></div></fieldset>
          <fieldset><legend className="text-xs font-extrabold text-slate-700">Compromisos que crearán tareas</legend><div className="mt-2 space-y-2">{result.commitments.map((item, index) => <div key={index} className="grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1fr_180px_150px_auto]"><input value={item.task || ''} onChange={(event) => updateCommitment(index, { task: event.target.value })} className={inputClass} placeholder="Compromiso" /><select value={item.responsible || 'Por asignar'} onChange={(event) => updateCommitment(index, { responsible: event.target.value })} className={inputClass}><option value="Por asignar">Por asignar</option>{project.assignedStudents.map((student) => <option key={student.email} value={student.name}>{student.name}</option>)}</select><input type="date" value={item.dueDate || ''} onChange={(event) => updateCommitment(index, { dueDate: event.target.value || undefined })} className={inputClass} /><Button tone="ghost" aria-label="Eliminar compromiso" onClick={() => setResult({ ...result, commitments: result.commitments.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-4 w-4" /></Button></div>)}<Button tone="secondary" onClick={() => setResult({ ...result, commitments: [...result.commitments, { task: '', responsible: 'Por asignar', dueDate: inDays(7) }] })}><Plus className="h-4 w-4" />Compromiso</Button></div></fieldset>
          <label className="block text-xs font-bold text-slate-600">Riesgos detectados<textarea value={result.risksDetected || ''} onChange={(event) => setResult({ ...result, risksDetected: event.target.value })} className={`${inputClass} mt-1`} rows={3} /></label>
           <p className="text-[11px] text-slate-500">Proveedor: {result.provider === 'openai' ? 'OpenAI' : result.provider === 'gemini' ? 'Gemini' : 'heurística local'}. Revisa el contenido antes de guardarlo.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void saveMinute()}><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar acta y crear tareas'}</Button><Button disabled={saving} tone="secondary" onClick={() => setResult(null)}>Volver a la transcripción</Button></div>
        </div>
      )}
    </Card>
  );
};

export const MeetingsView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({ projects, projectId, onChanged, onOpenProject, isMonitor = true }) => {
  const [create, setCreate] = useState(false);
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [standaloneActa, setStandaloneActa] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState<string | null>(null);
  const project = projects.find((item) => item.id === (projectId || globalProject));
  const meetings = OperationsService.getMeetings(projectId).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const minutes = OperationsService.getMinutes(projectId);
  const syncCalendar = async (meeting: ProjectMeeting, action: 'upsert' | 'cancel' = 'upsert') => {
    setCalendarBusy(meeting.id);
    try {
      const result = await CalendarService.sync(meeting.id, action);
      onChanged();
      if (result.mode === 'simulado' && result.message) window.alert(result.message);
    } catch (caught) {
      OperationsService.updateMeeting(meeting.id, { calendarSync: 'error' });
      onChanged();
      window.alert(caught instanceof Error ? caught.message : 'No se pudo sincronizar Google Calendar.');
    } finally { setCalendarBusy(null); }
  };
  const changeStatus = (meeting: ProjectMeeting, status: ProjectMeeting['status']) => {
    let reason: string | undefined;
    if (status === 'cancelada' || status === 'no_realizada') {
      reason = window.prompt(status === 'cancelada' ? 'Motivo de cancelación:' : 'Motivo por el que no se realizó:')?.trim();
      if (!reason) return;
    }
    try {
      const updated = OperationsService.updateMeetingStatus(meeting.id, status, reason);
      onChanged();
      if (updated && SyncService.isRemoteMode()) {
        const action = status === 'cancelada' || status === 'no_realizada' ? 'cancel' : 'upsert';
        void syncCalendar(updated, action);
      }
    }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : 'No se pudo cambiar el estado.'); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Heading title={projectId ? 'Reuniones y actas' : 'Agenda'} text={projectId ? 'Las reuniones y actas quedan vinculadas únicamente a este equipo.' : 'Vista transversal del monitor; al crear eliges el proyecto una sola vez.'} action={<Button onClick={() => setCreate((value) => !value)}><Plus className="h-4 w-4" />Programar reunión</Button>} />
      {create && project && <div className="mb-4">{!projectId && <label className="mb-3 block max-w-md text-xs font-bold text-slate-600">Proyecto<select value={globalProject} onChange={(event) => setGlobalProject(event.target.value)} className={`${inputClass} mt-1`}>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>}<MeetingForm project={project} onCancel={() => setCreate(false)} onDone={() => { setCreate(false); onChanged(); }} /></div>}
      {projectId && project && <div className="mb-4"><Button tone="secondary" onClick={() => setStandaloneActa((value) => !value)}><FileText className="h-4 w-4" />{standaloneActa ? 'Ocultar carga' : 'Crear acta desde TXT sin reunión'}</Button>{standaloneActa && <ActaUploader project={project} onDone={() => { setStandaloneActa(false); onChanged(); }} />}</div>}
      <div className="space-y-3">
        {meetings.map((meeting) => {
          const meetingProject = projects.find((item) => item.id === meeting.projectId);
          return (
            <Card key={meeting.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-extrabold">{meeting.title}</h2><p className="mt-1 text-xs text-slate-500">{projectCode(projects, meeting.projectId)} · {formatDate(meeting.startsAt)} · {meeting.durationMinutes} min</p>{meeting.agenda && <p className="mt-2 text-sm text-slate-600">{meeting.agenda}</p>}{meeting.cancellationReason && <p className="mt-2 text-xs font-bold text-rose-600">Motivo: {meeting.cancellationReason}</p>}</div>
                <Badge tone={meeting.status === 'realizada' ? 'green' : meeting.status === 'programada' || meeting.status === 'reprogramada' ? 'indigo' : 'red'}>{meeting.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(meeting.status === 'programada' || meeting.status === 'reprogramada') && <><Button tone="secondary" onClick={() => changeStatus(meeting, 'realizada')}><Check className="h-4 w-4" />Realizada</Button><Button tone="secondary" onClick={() => changeStatus(meeting, 'no_realizada')}>No realizada</Button><Button tone="secondary" onClick={() => changeStatus(meeting, 'cancelada')}>Cancelar</Button></>}
                {(meeting.status === 'cancelada' || meeting.status === 'no_realizada') && <Button tone="secondary" onClick={() => changeStatus(meeting, 'reprogramada')}>Reprogramar</Button>}
                 {meeting.calendarEventUrl ? <a href={meeting.calendarEventUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><CalendarDays className="h-4 w-4" />Abrir Calendar</a> : <span className="inline-flex items-center gap-1 px-2 text-[11px] text-slate-400">Calendar: {meeting.calendarSync}</span>}
                 {SyncService.isRemoteMode() && meeting.status !== 'cancelada' && meeting.status !== 'no_realizada' && <Button disabled={calendarBusy === meeting.id} tone="secondary" onClick={() => void syncCalendar(meeting)}><CalendarDays className="h-4 w-4" />{calendarBusy === meeting.id ? 'Sincronizando…' : 'Sincronizar Calendar'}</Button>}
                {!projectId && <Button tone="secondary" onClick={() => onOpenProject(meeting.projectId)}>Abrir proyecto</Button>}
              </div>
              {meetingNeedsMinute(meeting) && projectId && meetingProject && <ActaUploader project={meetingProject} meeting={meeting} onDone={onChanged} />}
            </Card>
          );
        })}
        {!meetings.length && <Empty text="No hay reuniones registradas." />}
      </div>
      {projectId && (
        <Card className="mt-5">
          <h2 className="font-extrabold">Actas guardadas</h2>
          <div className="mt-3 space-y-2">{minutes.map((minute) => <details key={minute.id} className="rounded-xl border border-slate-100 p-3"><summary className="cursor-pointer text-sm font-bold">{minute.title} <span className="font-normal text-slate-400">· {formatDate(minute.meetingDate)}</span></summary><p className="mt-3 text-sm text-slate-600">{minute.summary}</p><p className="mt-2 text-xs text-slate-500">{minute.decisions.length} decisiones · {minute.commitments.length} compromisos · {minute.status || 'aprobada'}</p></details>)}{!minutes.length && <Empty text="Todavía no hay actas guardadas." />}</div>
        </Card>
      )}
    </div>
  );
};

const downloadHtml = (projectDocument: ProjectDocument) => {
  const url = URL.createObjectURL(new Blob([projectDocument.htmlPreview], { type: 'text/html;charset=utf-8' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${projectDocument.title.replace(/[^a-z0-9áéíóúñ_-]+/gi, '-')}.html`;
  link.click();
  URL.revokeObjectURL(url);
};

const TemplateEditor: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const templates = OperationsService.getTemplates().filter((template) => template.documentType);
  const [selected, setSelected] = useState(templates[0]?.id || '');
  const current = templates.find((item) => item.id === selected);
  const [name, setName] = useState(current?.name || '');
  const [description, setDescription] = useState(current?.description || '');
  const [category, setCategory] = useState<DocumentTemplate['category']>(current?.category || 'seguimiento');
  const [html, setHtml] = useState(current?.htmlTemplate || '');
  const [showPreview, setShowPreview] = useState(true);
  const choose = (template: DocumentTemplate) => { setSelected(template.id); setName(template.name); setDescription(template.description || ''); setCategory(template.category); setHtml(template.htmlTemplate || ''); };
  const save = () => {
    if (!current || !name.trim() || !html.trim()) return;
    OperationsService.saveTemplate({ ...current, name: name.trim(), description: description.trim(), category, htmlTemplate: html, updatedAt: new Date().toISOString(), version: (current.version || 1) + 1 });
    onDone();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">Plantillas institucionales</h2><p className="mt-1 text-xs text-slate-500">Estas cuatro plantillas definen la estructura que la IA debe conservar. Cada cambio crea una nueva versión de la plantilla.</p></div><Button tone="secondary" onClick={() => setShowPreview((value) => !value)}><Eye className="h-4 w-4" />{showPreview ? 'Ocultar vista' : 'Ver plantilla'}</Button></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">{templates.map((template) => <button key={template.id} onClick={() => choose(template)} className={`w-full rounded-xl border p-3 text-left text-sm ${selected === template.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}><b>{template.name}</b><small className="mt-1 block text-slate-500">v{template.version || 1} · {template.originalDocxName}</small></button>)}</div>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-slate-600">Nombre<input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600">Categoría<select value={category} onChange={(event) => setCategory(event.target.value as DocumentTemplate['category'])} className={`${inputClass} mt-1`}><option value="seguimiento">Seguimiento</option><option value="requerimientos">Requerimientos</option><option value="entrega">Entrega</option></select></label></div>
          <label className="block text-xs font-bold text-slate-600">Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs font-bold text-slate-600">HTML<textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={12} className={`${inputClass} mt-1 font-mono text-xs`} /></label>
          <div className="flex flex-wrap gap-2"><Button disabled={!current} onClick={save}><Save className="h-4 w-4" />Guardar nueva versión</Button>{current && <Button tone="secondary" onClick={() => { OperationsService.saveTemplate({ ...current, isActive: current.isActive === false, updatedAt: new Date().toISOString() }); onDone(); }}>{current.isActive === false ? 'Activar' : 'Desactivar'}</Button>}</div>
          {showPreview && html && <iframe title="Vista previa de la plantilla" sandbox="" srcDoc={html} className="h-[560px] w-full rounded-xl border border-slate-200 bg-white" />}
        </div>
      </div>
    </Card>
  );
};

export const DocumentsView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({ projects, projectId, isMonitor, onChanged, onOpenProject }) => {
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [preview, setPreview] = useState<ProjectDocument | null>(null);
  const [documentType, setDocumentType] = useState<InstitutionalDocumentType>('acta_reunion');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [exporting, setExporting] = useState('');
  const [revision, setRevision] = useState('');
  const [revising, setRevising] = useState(false);
  const [versions, setVersions] = useState<ProjectDocumentVersion[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const selectedId = projectId || globalProject;
  const documents = OperationsService.getDocuments(projectId);
  const template = templateByType(documentType) || INSTITUTIONAL_TEMPLATES[0];

  const showDocument = async (document: ProjectDocument) => {
    setPreview(document); setRevision(''); setError('');
    try { setVersions(await DocumentWorkflowService.getVersions(document.id)); }
    catch (caught) { setVersions([]); setError(caught instanceof Error ? caught.message : 'No fue posible cargar el historial.'); }
  };

  const create = async () => {
    if (!selectedId) { setError('Selecciona un proyecto.'); return; }
    if (documentType === 'acta_reunion' && !sourceFiles.length && !sourceText.trim()) { setError('El acta requiere una transcripción TXT/VTT, PDF/DOCX con texto o contenido pegado.'); return; }
    setBusyTemplate(true); setError(''); setWarnings([]);
    try {
      const prepared = await DocumentWorkflowService.prepareSources(selectedId, sourceFiles);
      const combinedText = [prepared.sourceText, sourceText.trim() ? `\n===== INFORMACIÓN PEGADA =====\n${sourceText.trim()}` : ''].filter(Boolean).join('\n').slice(0, 120_000);
      setWarnings(prepared.warnings);
      const generated = await DocumentWorkflowService.generate({ projectId: selectedId, documentType, sourceText: combinedText, sourceFiles: prepared.sourceFiles, instructions: instructions.trim() });
      let completed = generated.document;
      try {
        const pdf = await DocumentExportService.createAndStorePdf(generated.document);
        await DocumentWorkflowService.attachPdf(generated.document, pdf.stored.path);
        completed = { ...generated.document, storagePath: pdf.stored.path, pdfStoragePath: pdf.stored.path, generationStatus: 'listo' };
      } catch (pdfError) {
        setWarnings((items) => [...items, `El documento quedó guardado, pero el PDF debe regenerarse: ${pdfError instanceof Error ? pdfError.message : 'error desconocido'}`]);
      }
      await showDocument(completed);
      setSourceFiles([]); setSourceText(''); setInstructions(''); setFileInputKey((value) => value + 1);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible generar el documento.');
    } finally { setBusyTemplate(false); }
  };

  const exportDocument = async (document: ProjectDocument, format: 'pdf' | 'docx' | 'html') => {
    const key = `${document.id}-${format}`; setExporting(key);
    try {
      if (format === 'html') { downloadHtml(document); return; }
      if (format === 'pdf' && document.pdfStoragePath && SyncService.isRemoteMode()) { await DocumentExportService.downloadStoredPdf(document); return; }
      const result = await DocumentExportService.exportAndDownload(document, format);
      if (format === 'pdf') await DocumentWorkflowService.attachPdf(document, result.stored.path);
      else OperationsService.updateDocument(document.id, { storagePath: result.stored.path });
      onChanged();
    }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : `No se pudo exportar ${format.toUpperCase()}.`); }
    finally { setExporting(''); }
  };

  const requestRevision = async () => {
    if (!preview || revision.trim().length < 5) { setError('Describe con precisión el cambio que debe hacer la IA.'); return; }
    setRevising(true); setError('');
    try {
      const result = await DocumentWorkflowService.revise(preview.id, revision.trim());
      let revised = result.document;
      try {
        const pdf = await DocumentExportService.createAndStorePdf(result.document);
        await DocumentWorkflowService.attachPdf(result.document, pdf.stored.path);
        revised = { ...result.document, storagePath: pdf.stored.path, pdfStoragePath: pdf.stored.path, generationStatus: 'listo' };
      } catch (pdfError) {
        setWarnings((items) => [...items, `La revisión se guardó, pero falta regenerar su PDF: ${pdfError instanceof Error ? pdfError.message : 'error desconocido'}`]);
      }
      setRevision(''); await showDocument(revised); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible revisar el documento.'); }
    finally { setRevising(false); }
  };

  const openVersion = (version: ProjectDocumentVersion) => {
    if (!preview) return;
    setPreview({ ...preview, title: version.title, version: version.version, htmlPreview: version.htmlContent, pdfStoragePath: version.pdfStoragePath, storagePath: version.pdfStoragePath, sourceFiles: version.sourceFiles, provider: version.provider, model: version.model, updatedAt: version.createdAt });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Heading title={projectId ? 'Documentos del proyecto' : 'Documentos'} text={projectId ? 'Todo lo que generes queda vinculado automáticamente a este proyecto y a ninguna otra relación.' : 'Vista transversal del monitor: selecciona el proyecto antes de iniciar una generación.'} />
      {!projectId && <label className="mb-4 block max-w-xl text-xs font-bold text-slate-600">Proyecto para generar<select value={globalProject} onChange={(event) => setGlobalProject(event.target.value)} className={`${inputClass} mt-1`}>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.title}</option>)}</select></label>}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="font-extrabold">Crear documento institucional</h2><p className="mt-1 text-xs text-slate-500">La IA recibe la plantilla elegida, el contexto real del proyecto y solamente las fuentes que adjuntes.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">{INSTITUTIONAL_TEMPLATES.map((item) => <button key={item.id} onClick={() => setDocumentType(item.documentType)} className={`rounded-xl border p-3 text-left ${documentType === item.documentType ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}><FileText className="mb-2 h-4 w-4 text-indigo-600" /><b className="block text-xs">{item.name}</b><small className="mt-1 block text-[10px] text-slate-500">{item.acceptedSources.split(',').filter((value) => value.startsWith('.')).join(', ')}</small></button>)}</div>
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><b>{template.name}:</b> {template.sourceHelp}</p>
            <label className="block text-xs font-bold text-slate-600">Archivos fuente (máximo 8)<input key={fileInputKey} type="file" multiple accept=".txt,.vtt,.pdf,.docx,text/plain,text/vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setSourceFiles(Array.from(event.target.files || []))} className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm" /></label>
            {sourceFiles.length > 0 && <div className="flex flex-wrap gap-2">{sourceFiles.map((file) => <Badge key={`${file.name}-${file.size}`}>{file.name}</Badge>)}</div>}
            <label className="block text-xs font-bold text-slate-600">Información adicional<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={4} className={`${inputClass} mt-1`} placeholder="Pega una transcripción, notas o datos confirmados." /></label>
            <label className="block text-xs font-bold text-slate-600">Instrucciones opcionales<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className={`${inputClass} mt-1`} placeholder="Ej. enfatiza los riesgos y no propongas fechas aún." /></label>
            <Button disabled={!selectedId || busyTemplate} onClick={() => void create()}><Sparkles className="h-4 w-4" />{busyTemplate ? 'Extrayendo, generando y guardando…' : `Crear ${template.name.toLowerCase()}`}</Button>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
            {warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{warning}</p>)}
          </div>
        </Card>
        <Card><h2 className="font-extrabold">Documentos generados</h2><div className="mt-3 space-y-2">{documents.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-2"><div><b className="text-sm">{item.title}</b><p className="mt-1 text-xs text-slate-500">{projectCode(projects, item.projectId)} · v{item.version} · {item.provider || 'plantilla'}{item.model ? ` / ${item.model}` : ''}</p></div><Badge tone={item.status === 'aprobado' ? 'green' : item.status === 'en_revision' ? 'indigo' : item.generationStatus === 'listo' ? 'green' : 'amber'}>{item.status}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button tone="secondary" onClick={() => void showDocument(item)}><Eye className="h-4 w-4" />Abrir</Button><Button disabled={Boolean(exporting)} tone="secondary" onClick={() => void exportDocument(item, 'pdf')}><Download className="h-4 w-4" />{exporting === `${item.id}-pdf` ? 'Preparando…' : item.pdfStoragePath ? 'PDF' : 'Crear PDF'}</Button><Button disabled={Boolean(exporting)} tone="secondary" onClick={() => void exportDocument(item, 'html')}><Download className="h-4 w-4" />HTML</Button><Button disabled={Boolean(exporting)} tone="secondary" onClick={() => void exportDocument(item, 'docx')}><Download className="h-4 w-4" />DOCX</Button>{isMonitor && item.status !== 'aprobado' && <Button tone="secondary" onClick={() => { OperationsService.updateDocument(item.id, { status: item.status === 'borrador' ? 'en_revision' : 'aprobado', approvedBy: item.status === 'en_revision' ? 'Monitor' : undefined, approvedAt: item.status === 'en_revision' ? new Date().toISOString() : undefined }); onChanged(); }}>{item.status === 'borrador' ? 'Enviar a revisión' : 'Aprobar'}</Button>}{!projectId && <Button tone="secondary" onClick={() => onOpenProject(item.projectId)}>Proyecto</Button>}</div></div>)}{!documents.length && <Empty text="Aún no hay documentos generados." />}</div></Card>
      </div>
      {preview && <Card className="mt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">Vista previa · {preview.title}</h2><p className="text-xs text-slate-500">Versión {preview.version} · {preview.sourceFiles?.length || 0} archivos fuente</p></div><Button tone="ghost" onClick={() => setPreview(null)}><X className="h-4 w-4" />Cerrar</Button></div><div className="grid gap-4 xl:grid-cols-[1fr_280px]"><iframe title={`Vista previa de ${preview.title}`} sandbox="" srcDoc={preview.htmlPreview} className="h-[680px] w-full rounded-xl border border-slate-200 bg-white" /><aside className="space-y-4"><div><h3 className="text-xs font-extrabold uppercase text-slate-500">Solicitar cambios a la IA</h3><textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={5} className={`${inputClass} mt-2`} placeholder="Ej. corrige el responsable del compromiso 2 y agrega la decisión aprobada…" /><Button disabled={revising || preview.status === 'aprobado'} onClick={() => void requestRevision()} className="mt-2 w-full"><Sparkles className="h-4 w-4" />{revising ? 'Creando nueva versión…' : 'Aplicar y versionar'}</Button>{preview.status === 'aprobado' && <p className="mt-2 text-[11px] text-slate-500">Los documentos aprobados no se modifican.</p>}</div><div><h3 className="text-xs font-extrabold uppercase text-slate-500">Historial</h3><div className="mt-2 space-y-2">{versions.map((version) => <button key={version.id} onClick={() => openVersion(version)} className={`w-full rounded-xl border p-3 text-left text-xs ${version.version === preview.version ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100'}`}><b>Versión {version.version}</b><span className="mt-1 block text-slate-500">{formatDate(version.createdAt)} · {version.provider}</span>{version.changeRequest && <span className="mt-1 line-clamp-2 block text-slate-600">{version.changeRequest}</span>}</button>)}</div></div></aside></div></Card>}
      {isMonitor && !projectId && <div className="mt-5"><TemplateEditor onDone={onChanged} /></div>}
    </div>
  );
};

const TeamManager: React.FC<{ project: Project; projects: Project[]; onDone: () => void }> = ({ project, projects, onDone }) => {
  const [selected, setSelected] = useState<string[]>(project.assignedStudents.map((student) => student.email.toLowerCase()));
  const students = OperationsService.getStudents();
  const assignment = (email: string) => projects.find((item) => item.assignedStudents.some((student) => student.email.toLowerCase() === email.toLowerCase()));
  const save = () => {
    try { OperationsService.assignStudentsExclusively(project.id, selected); onDone(); }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : 'No se pudo asignar el equipo.'); }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-extrabold">Gestionar integrantes</h2><p className="mt-1 text-xs text-slate-500">La selección guardada será el equipo exacto. Si alguien estaba en otro proyecto, se trasladará automáticamente.</p></div><Badge tone={selected.length > project.maxStudents ? 'red' : 'indigo'}>{selected.length}/{project.maxStudents}</Badge></div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{students.map((student) => { const currentProject = assignment(student.email); const checked = selected.includes(student.email.toLowerCase()); return <label key={student.email} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}><input type="checkbox" checked={checked} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, student.email.toLowerCase()])] : selected.filter((email) => email !== student.email.toLowerCase()))} /><span className="min-w-0"><b className="block">{student.name}</b><small className="block truncate text-slate-500">{student.email}</small>{currentProject && currentProject.id !== project.id && <small className="mt-1 block font-bold text-amber-700">Actualmente en {currentProject.code}; será trasladado</small>}</span></label>; })}</div>
      <div className="mt-4 flex items-center gap-3"><Button disabled={selected.length > project.maxStudents} onClick={save}><UserPlus className="h-4 w-4" />Guardar equipo exacto</Button>{selected.length > project.maxStudents && <span className="text-xs font-bold text-rose-600">Supera la capacidad máxima.</span>}</div>
    </Card>
  );
};

export const ProjectDetail: React.FC<Common & { projectId: string; onBack?: () => void; isMonitor?: boolean }> = ({ projects, projectId, onChanged, onOpenProject, onBack, isMonitor }) => {
  const project = projects.find((item) => item.id === projectId);
  const [tab, setTab] = useState<'resumen' | 'tareas' | 'reuniones' | 'incidencias' | 'documentos' | 'equipo'>('resumen');
  useEffect(() => setTab('resumen'), [projectId, isMonitor]);
  if (!project) return <Empty text="El proyecto ya no existe o no está disponible." />;
  const tabs = ['resumen', 'tareas', 'reuniones', 'incidencias', 'documentos', 'equipo'] as const;
  const links = [{ label: 'Carpeta Drive', url: project.driveFolderUrl }, { label: 'GitHub', url: project.githubUrl }, { label: 'WhatsApp', url: project.whatsappUrl }, { label: 'Teams', url: project.teamsMeetingUrl }].filter((item) => item.url);
  const activity = OperationsService.getActivity(project.id).slice(0, 8);
  return (
    <div className="mx-auto max-w-6xl">
      {onBack && <button onClick={onBack} className="mb-3 text-xs font-bold text-[#514ff0]">← Volver a proyectos</button>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge tone={project.riskLevel === 'rojo' ? 'red' : project.riskLevel === 'amarillo' ? 'amber' : 'green'}>{project.code}</Badge><h1 className="mt-2 text-2xl font-black">{project.title}</h1><p className="mt-1 text-sm text-slate-500">{project.companyName} · equipo de {project.assignedStudents.length} personas · avance {project.progressPct}%</p></div><div className="flex flex-wrap gap-2">{links.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><LinkIcon className="h-3.5 w-3.5" />{link.label}</a>)}</div></div>
        <div className="mt-4 flex gap-2 overflow-x-auto border-t pt-3">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold capitalize ${tab === item ? 'bg-indigo-50 text-[#514ff0]' : 'text-slate-500 hover:bg-slate-50'}`}>{item}</button>)}</div>
      </Card>
      <div className="mt-5">
        {tab === 'resumen' && <div className="grid gap-4 lg:grid-cols-3"><Card><h2 className="font-extrabold">Estado operativo</h2><div className="mt-3 space-y-2 text-sm text-slate-600"><p>{OperationsService.getTasks(project.id).filter((task) => task.status !== 'completada').length} tareas abiertas</p><p>{OperationsService.getIssues(project.id).filter((issue) => issue.status !== 'resuelta').length} incidencias abiertas</p><p>{OperationsService.getMeetings(project.id).filter(meetingNeedsMinute).length} actas pendientes</p></div></Card><Card><h2 className="font-extrabold">Acciones rápidas</h2><div className="mt-3 flex flex-wrap gap-2"><Button tone="secondary" onClick={() => setTab('incidencias')}>Reportar incidencia</Button><Button tone="secondary" onClick={() => setTab('reuniones')}>Cargar TXT / acta</Button><Button tone="secondary" onClick={() => setTab('tareas')}>Crear tarea</Button></div></Card><Card><h2 className="font-extrabold">Contacto de organización</h2><div className="mt-3 space-y-2">{project.contacts.map((contact) => <p key={contact.email} className="text-sm"><b className="block">{contact.name}</b><a className="text-xs text-indigo-600" href={`mailto:${contact.email}`}>{contact.email}</a></p>)}{!project.contacts.length && <p className="text-sm text-slate-500">Sin contactos registrados.</p>}</div></Card><Card className="lg:col-span-3"><h2 className="font-extrabold">Actividad reciente</h2><div className="mt-3 divide-y divide-slate-100">{activity.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm"><span>{item.message}</span><small className="whitespace-nowrap text-slate-400">{formatDate(item.createdAt)}</small></div>)}{!activity.length && <Empty text="La actividad aparecerá al crear tareas, incidencias, reuniones, documentos o cambios de equipo." />}</div></Card></div>}
        {tab === 'tareas' && <TasksView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'reuniones' && <MeetingsView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'incidencias' && <IssuesView projects={projects} projectId={project.id} isStudent={!isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'documentos' && <DocumentsView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'equipo' && (isMonitor ? <TeamManager project={project} projects={projects} onDone={onChanged} /> : <Card><h2 className="font-extrabold">Mi equipo</h2><div className="mt-3 space-y-2">{project.assignedStudents.map((student) => <p key={student.email} className="rounded-lg bg-slate-50 p-3 text-sm"><b>{student.name}</b><small className="ml-2 text-slate-500">{student.email}</small></p>)}</div></Card>)}
      </div>
    </div>
  );
};

export const PeopleView: React.FC<Common> = ({ projects, onOpenProject, onChanged }) => {
  const students = OperationsService.getStudents();
  const applications = OperationsService.getApplications().filter((application) => application.status === 'pendiente');
  return <div className="mx-auto max-w-6xl"><Heading title="Personas y equipos" text="Cada estudiante aparece una sola vez y su asignación actual es explícita." />{applications.length > 0 && <Card className="mb-5"><h2 className="font-extrabold">Postulaciones pendientes</h2><div className="mt-3 space-y-2">{applications.map((application) => <div key={application.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3"><div className="min-w-0 flex-1"><b className="block text-sm">{application.studentName}</b><small className="text-slate-500">Solicita {projectCode(projects, application.projectId)} · {formatDate(application.createdAt)}</small></div><Button onClick={() => { try { OperationsService.acceptApplication(application.id); onChanged(); } catch (caught) { window.alert(caught instanceof Error ? caught.message : 'No se pudo aceptar.'); } }}>Aceptar y reasignar</Button><Button tone="secondary" onClick={() => { OperationsService.rejectApplication(application.id); onChanged(); }}>Rechazar</Button></div>)}</div></Card>}<Card className="overflow-hidden p-0"><div className="divide-y divide-slate-100">{students.map((student) => { const project = projects.find((item) => item.assignedStudents.some((member) => member.email.toLowerCase() === student.email.toLowerCase())); return <div key={student.email} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><b className="block text-sm">{student.name}</b><small className="text-slate-500">{student.email}</small></div>{project ? <><Badge tone="indigo">{project.code}</Badge><Button tone="secondary" onClick={() => onOpenProject(project.id)}>Gestionar</Button></> : <Badge tone="amber">Sin proyecto</Badge>}</div>; })}</div></Card></div>;
};

const downloadCsv = (projects: Project[]) => {
  const rows = [['Proyecto', 'Empresa', 'Integrantes', 'Tareas abiertas', 'Tareas vencidas', 'Incidencias abiertas', 'Actas pendientes'], ...projects.map((project) => {
    const tasks = OperationsService.getTasks(project.id);
    return [project.code, project.companyName, String(project.assignedStudents.length), String(tasks.filter((task) => task.status !== 'completada').length), String(tasks.filter((task) => isTaskOverdue(task)).length), String(OperationsService.getIssues(project.id).filter((issue) => issue.status !== 'resuelta').length), String(OperationsService.getMeetings(project.id).filter(meetingNeedsMinute).length)];
  })];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.split('"').join('""')}"`).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = window.document.createElement('a'); link.href = url; link.download = `seguimiento-proyectos-${today()}.csv`; link.click(); URL.revokeObjectURL(url);
};

export const ReportsView: React.FC<Common> = ({ projects, onOpenProject }) => {
  const totals = { tasks: OperationsService.getTasks().filter((task) => task.status !== 'completada').length, overdue: OperationsService.getTasks().filter((task) => isTaskOverdue(task)).length, issues: OperationsService.getIssues().filter((issue) => issue.status !== 'resuelta').length };
  return <div className="mx-auto max-w-6xl"><Heading title="Reportes" text="Indicadores operativos calculados sobre los registros actuales." action={<Button tone="secondary" onClick={() => downloadCsv(projects)}><Download className="h-4 w-4" />Exportar CSV</Button>} /><div className="mb-5 grid gap-3 md:grid-cols-3"><Card><p className="text-xs text-slate-500">Tareas abiertas</p><p className="mt-1 text-3xl font-black">{totals.tasks}</p></Card><Card><p className="text-xs text-slate-500">Tareas vencidas</p><p className="mt-1 text-3xl font-black text-amber-600">{totals.overdue}</p></Card><Card><p className="text-xs text-slate-500">Incidencias abiertas</p><p className="mt-1 text-3xl font-black text-rose-600">{totals.issues}</p></Card></div><Card className="overflow-hidden p-0"><div className="divide-y divide-slate-100">{projects.map((project) => { const tasks = OperationsService.getTasks(project.id); const issues = OperationsService.getIssues(project.id); return <button key={project.id} onClick={() => onOpenProject(project.id)} className="grid w-full gap-2 p-4 text-left hover:bg-slate-50 md:grid-cols-[1fr_repeat(3,120px)_auto]"><span><b className="block">{project.code}</b><small className="text-slate-500">{project.companyName}</small></span><span className="text-sm"><b>{tasks.filter((task) => task.status !== 'completada').length}</b><small className="block text-slate-500">tareas abiertas</small></span><span className="text-sm"><b>{tasks.filter((task) => isTaskOverdue(task)).length}</b><small className="block text-slate-500">vencidas</small></span><span className="text-sm"><b>{issues.filter((issue) => issue.status !== 'resuelta').length}</b><small className="block text-slate-500">incidencias</small></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>; })}</div></Card></div>;
};
