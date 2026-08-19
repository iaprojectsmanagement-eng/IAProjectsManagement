import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  Eye,
  FileText,
  Info,
  Link as LinkIcon,
  List,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DocumentSourceFile,
  DocumentTemplate,
  InstitutionalDocumentType,
  Project,
  ProjectDocument,
  ProjectDocumentVersion,
  ProjectIssue,
  ProjectMeeting,
  ProjectResourceLink,
  ProjectTask,
  Student,
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
import { AiLimitIncident, AiLimitIncidentService } from '../services/aiLimitIncidentService';
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
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 placeholder:text-slate-400';
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const GOOGLE_CALENDAR_EMBED_URL =
  'https://calendar.google.com/calendar/embed?height=500&wkst=1&ctz=America%2FBogota&mode=MONTH&showPrint=0&showTitle=0&src=aWFwcm9qZWN0c21hbmFnZW1lbnRAZ21haWwuY29t&src=ZXMuY28jaG9saWRheUBncm91cC52LmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23039be5&color=%230b8043';

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children,
  className = '',
  onClick,
}) => (
  <section
    className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-150 ${
      onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
    } ${className}`}
    onClick={onClick}
    onKeyDown={(event) => {
      if (onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick();
      }
    }}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </section>
);

const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  noScroll?: boolean;
  size?: string;
  maxHeight?: string;
}> = ({ open, title, onClose, children, noScroll = false, size = 'max-w-2xl', maxHeight = 'max-h-[calc(100vh-2rem)]' }) => {
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${size} flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl ${maxHeight} ${
          noScroll ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
          <h2 className="text-base font-extrabold text-[#0E2C40]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

const ChoiceMenu: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}> = ({ value, options, onChange, ariaLabel, className = '' }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-[#0E2C40] transition hover:border-[#0D9488]"
      >
        <span className="truncate">{selected?.label || 'Seleccionar'}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#0D9488]" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
          role="listbox"
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                option.value === value ? 'bg-teal-50 font-bold text-[#0D9488]' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectPicker: React.FC<{
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}> = ({ projects, value, onChange, ariaLabel = 'Proyecto' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = projects.find((project) => project.id === value);
  const filtered = projects.filter((project) =>
    `${project.code} ${project.companyName} ${project.title}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-[#0E2C40] transition hover:border-[#0D9488]"
      >
        <span className="truncate">{selected ? `${selected.code} · ${selected.title}` : 'Selecciona un proyecto'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#0D9488]" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15"
          role="listbox"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar por código, empresa o nombre"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {filtered.map((project) => (
              <button
                type="button"
                role="option"
                aria-selected={project.id === value}
                key={project.id}
                onClick={() => {
                  onChange(project.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                  project.id === value ? 'bg-teal-50 font-bold text-[#0D9488]' : 'hover:bg-slate-50'
                }`}
              >
                <b>{project.code}</b>
                <span className="ml-2 text-slate-600">{project.title}</span>
              </button>
            ))}
            {!filtered.length && <p className="p-3 text-center text-xs text-slate-400">No hay coincidencias.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const FilePicker: React.FC<{
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  inputKey?: number;
  label?: string;
}> = ({ files, onChange, accept, multiple = true, inputKey = 0, label = 'Elegir archivos' }) => (
  <div>
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0D9488] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]">
      <Upload className="h-4 w-4" />
      {label}
      <input
        key={inputKey}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => onChange(Array.from(event.target.files || []))}
      />
    </label>
    {files.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-2">
        {files.map((file) => (
          <Badge key={`${file.name}-${file.size}`}>{file.name}</Badge>
        ))}
      </div>
    )}
  </div>
);

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' | 'ghost' }
> = ({ children, tone = 'primary', className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
      tone === 'primary'
        ? 'bg-[#0D9488] text-white shadow-sm hover:bg-[#0F766E]'
        : tone === 'danger'
          ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
          : tone === 'ghost'
            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50'
    } ${className}`}
  >
    {children}
  </button>
);

const Badge: React.FC<{ children: React.ReactNode; tone?: 'red' | 'amber' | 'green' | 'indigo' | 'slate' }> = ({
  children,
  tone = 'slate',
}) => {
  const label = typeof children === 'string' ? children.toLowerCase() : '';
  const markerTone =
    label.includes('alta') || label.includes('crit') || label.includes('vencid') || label.includes('acta') || label.includes('rojo')
      ? ('red' as const)
      : label.includes('amarillo') || label.includes('pend')
        ? ('amber' as const)
        : label.includes('verde') || label.includes('realiz') || label.includes('aprob')
          ? ('green' as const)
          : tone;
  const Icon =
    markerTone === 'red'
      ? AlertTriangle
      : markerTone === 'amber'
        ? Clock3
        : markerTone === 'green'
          ? Check
          : markerTone === 'indigo'
            ? Info
            : CircleDot;
  return (
    <span className={`status-marker status-marker--${markerTone}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {children}
    </span>
  );
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
  return (
    <div className="risk-filter relative">
      <button
        type="button"
        className="risk-filter-trigger flex w-full items-center justify-between gap-3"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Badge tone={selected.tone}>{selected.label}</Badge>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="risk-filter-menu absolute right-0 top-full z-20 mt-1.5 w-full min-w-[210px]" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className="risk-filter-option flex w-full items-center justify-between"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <Badge tone={option.tone}>{option.label}</Badge>
              {option.value === value && <Check className="h-4 w-4 text-[#0D9488]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Heading: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-black text-[#0E2C40]">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{text}</p>
    </div>
    {action}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

interface Common {
  projects: Project[];
  onChanged: () => void;
  onOpenProject: (id: string, target?: 'resumen' | 'reuniones') => void;
}

const limitWindowLabel: Record<AiLimitIncident['limitWindow'], string> = {
  minute: '3 llamadas/minuto',
  hour: '10 llamadas/hora',
  day: '20 llamadas/día',
};

const AiLimitIncidentsPanel: React.FC = () => {
  const [items, setItems] = useState<AiLimitIncident[]>([]);
  const [status, setStatus] = useState<'abierta' | 'archivada'>('abierta');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async (nextStatus = status) => {
    try {
      setError('');
      setItems(await AiLimitIncidentService.list(nextStatus));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar los excesos de IA.');
    }
  };

  useEffect(() => {
    void load(status);
  }, [status]);

  if (!SyncService.isRemoteMode()) return null;

  const archive = async (id: string) => {
    try {
      setBusyId(id);
      await AiLimitIncidentService.archive(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible archivar el registro.');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro privado de exceso de IA?')) return;
    try {
      setBusyId(id);
      await AiLimitIncidentService.remove(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible eliminar el registro.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-[#0E2C40]">Excesos de límite de IA</h2>
          <p className="mt-1 text-xs text-slate-500">Registro privado para monitor y profesor; no guarda textos enviados a la IA.</p>
        </div>
        <Button tone="secondary" onClick={() => setStatus((current) => (current === 'abierta' ? 'archivada' : 'abierta'))}>
          Ver {status === 'abierta' ? 'archivadas' : 'abiertas'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
            <div className="min-w-0 flex-1">
              <b className="block text-sm text-[#0E2C40]">
                {item.actorName} · {limitWindowLabel[item.limitWindow]}
              </b>
              <span className="block truncate text-slate-500">
                {item.actorEmail} · {item.projectLabel} · {item.operation === 'document' ? 'Documento' : 'Transcripción'} ·{' '}
                {formatDate(item.createdAt)}
              </span>
            </div>
            {status === 'abierta' && (
              <Button disabled={busyId === item.id} tone="secondary" onClick={() => void archive(item.id)}>
                Archivar
              </Button>
            )}
            <Button disabled={busyId === item.id} tone="danger" onClick={() => void remove(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        ))}
        {!items.length && <Empty text={status === 'abierta' ? 'No hay excesos de IA abiertos.' : 'No hay excesos de IA archivados.'} />}
      </div>
    </Card>
  );
};

export const MonitorHome: React.FC<Common> = ({ projects, onOpenProject }) => {
  const issues = OperationsService.getIssues().filter((issue) => needsMonitorAttention(issue));
  const overdue = OperationsService.getTasks().filter((task) => isTaskOverdue(task));
  const minutes = OperationsService.getMeetings().filter(meetingNeedsMinute);
  const actions = [
    ...issues.map((issue) => ({ id: issue.id, projectId: issue.projectId, label: issue.title, detail: 'Incidencia prioritaria', tone: 'red' as const, target: 'resumen' as const })),
    ...overdue.map((task) => ({ id: task.id, projectId: task.projectId, label: task.title, detail: `Tarea vencida · ${task.assigneeName}`, tone: 'amber' as const, target: 'resumen' as const })),
    ...minutes.map((meeting) => ({ id: meeting.id, projectId: meeting.projectId, label: meeting.title, detail: 'Reunión realizada sin acta', tone: 'indigo' as const, target: 'reuniones' as const })),
  ].slice(0, 10);

  return (
    <div className="home-dashboard mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [issues.length, 'Incidencias prioritarias', 'text-rose-600', 'border-rose-100 bg-rose-50/30'],
          [overdue.length, 'Tareas vencidas', 'text-amber-600', 'border-amber-100 bg-amber-50/30'],
          [minutes.length, 'Actas pendientes', 'text-teal-600', 'border-teal-100 bg-teal-50/30'],
        ].map(([count, label, color, containerBg]) => (
          <Card key={String(label)} className={`p-5 ${containerBg}`}>
            <p className="text-xs font-bold text-slate-500">{String(label)}</p>
            <p className={`mt-2 text-3xl font-black ${color}`}>{String(count)}</p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-extrabold text-[#0E2C40]">Pendientes a resolver</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{actions.length} visibles</span>
        </div>
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={`${action.detail}-${action.id}`}
              onClick={() => onOpenProject(action.projectId, action.target)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3.5 text-left transition hover:border-teal-200 hover:bg-teal-50/30"
            >
              <Badge tone={action.tone}>{action.detail}</Badge>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm text-[#0E2C40]">{action.label}</b>
                <small className="text-slate-400">{projectCode(projects, action.projectId)}</small>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
          {!actions.length && <Empty text="No hay pendientes críticos. Los nuevos bloqueos, vencimientos y actas aparecerán aquí." />}
        </div>
      </Card>
      <AiLimitIncidentsPanel />
    </div>
  );
};

export const ProjectsView: React.FC<Common> = ({ projects, onOpenProject, onChanged }) => {
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('todos');
  const [create, setCreate] = useState(false);
  const [newProject, setNewProject] = useState({
    code: '',
    companyName: '',
    title: '',
    challengeDescription: '',
    maxStudents: 5,
  });

  const filtered = projects.filter((project) => {
    const matchesText = `${project.code} ${project.title} ${project.companyName}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (risk === 'todos' || project.riskLevel === risk);
  });

  return (
    <div className="projects-view mx-auto max-w-6xl space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setCreate(true)}>
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Button>
      </div>

      <Modal open={create} title="Nuevo proyecto" onClose={() => setCreate(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            OperationsService.createProject({
              ...newProject,
              code: newProject.code.trim(),
              companyName: newProject.companyName.trim(),
              title: newProject.title.trim(),
              challengeDescription: newProject.challengeDescription.trim(),
            });
            setNewProject({ code: '', companyName: '', title: '', challengeDescription: '', maxStudents: 5 });
            setCreate(false);
            onChanged();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">
              Código único
              <input
                required
                value={newProject.code}
                onChange={(event) => setNewProject({ ...newProject, code: event.target.value })}
                className={`${inputClass} mt-1`}
                placeholder="Ej. 21_ANALITICA"
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Organización
              <input
                required
                value={newProject.companyName}
                onChange={(event) => setNewProject({ ...newProject, companyName: event.target.value })}
                className={`${inputClass} mt-1`}
                placeholder="Nombre de la empresa o entidad"
              />
            </label>
            <label className="text-xs font-bold text-slate-700 md:col-span-2">
              Nombre del proyecto
              <input
                required
                value={newProject.title}
                onChange={(event) => setNewProject({ ...newProject, title: event.target.value })}
                className={`${inputClass} mt-1`}
                placeholder="Objetivo principal del reto"
              />
            </label>
            <label className="text-xs font-bold text-slate-700 md:col-span-2">
              Descripción del reto
              <textarea
                value={newProject.challengeDescription}
                onChange={(event) => setNewProject({ ...newProject, challengeDescription: event.target.value })}
                className={`${inputClass} mt-1`}
                rows={3}
                placeholder="Detalla el problema a resolver y el enfoque de IA..."
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Capacidad máxima
              <input
                required
                type="number"
                min={1}
                max={20}
                value={newProject.maxStudents}
                onChange={(event) => setNewProject({ ...newProject, maxStudents: Number(event.target.value) })}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" tone="ghost" onClick={() => setCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4" />
              Crear proyecto
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <label className="relative block">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
            placeholder="Buscar por código, empresa o reto…"
          />
        </label>
        <RiskFilter value={risk} onChange={setRisk} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => {
          const openTasks = OperationsService.getTasks(project.id).filter((task) => task.status !== 'completada').length;
          const openIssues = OperationsService.getIssues(project.id).filter((issue) => issue.status !== 'resuelta').length;
          return (
            <Card key={project.id} className="project-card p-5" onClick={() => onOpenProject(project.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={project.riskLevel === 'rojo' ? 'red' : project.riskLevel === 'amarillo' ? 'amber' : 'green'}>
                      {project.code}
                    </Badge>
                    <span className="text-xs font-medium text-slate-400">{project.companyName}</span>
                  </div>
                  <h2 className="mt-3 line-clamp-2 font-medium text-slate-700">{project.title}</h2>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50/80 p-2.5">
                  <b className="block text-sm text-[#0E2C40]">
                    {project.assignedStudents.length}/{project.maxStudents}
                  </b>
                  <small className="text-[11px] font-medium text-slate-400">equipo</small>
                </div>
                <div className="rounded-xl bg-slate-50/80 p-2.5">
                  <b className="block text-sm text-[#0E2C40]">{openTasks}</b>
                  <small className="text-[11px] font-medium text-slate-400">tareas</small>
                </div>
                <div className="rounded-xl bg-slate-50/80 p-2.5">
                  <b className="block text-sm text-[#0E2C40]">{openIssues}</b>
                  <small className="text-[11px] font-medium text-slate-400">incidencias</small>
                </div>
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
      className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/30 p-5"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">
          Título
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="Resultado verificable"
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Responsable
          <div className="mt-1">
            <ChoiceMenu
              value={assigneeEmail}
              onChange={setAssigneeEmail}
              ariaLabel="Responsable"
              options={[
                { value: '', label: 'Por asignar' },
                ...project.assignedStudents.map((student) => ({ value: student.email, label: student.name })),
              ]}
            />
          </div>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Fecha límite
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Prioridad
          <div className="mt-1">
            <ChoiceMenu
              value={priority}
              onChange={(value) => setPriority(value as TaskPriority)}
              ariaLabel="Prioridad"
              options={taskPriorities.map((item) => ({ value: item, label: priorityLabel[item] }))}
            />
          </div>
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-700">
        Descripción
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${inputClass} mt-1`}
          rows={3}
          placeholder="Alcance, criterio de terminado o enlace de referencia"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <Button type="submit">
          <Save className="h-4 w-4" />
          Crear tarea
        </Button>
        <Button type="button" tone="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

const ProjectEditForm: React.FC<{ project: Project; onDone: (project: Project) => void; onCancel: () => void }> = ({
  project,
  onDone,
  onCancel,
}) => {
  const [draft, setDraft] = useState<Project>({ ...project, aiType: [...(project.aiType || [])] });
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onDone({
      ...draft,
      code: draft.code.trim(),
      companyName: draft.companyName.trim(),
      title: draft.title.trim(),
      challengeDescription: draft.challengeDescription?.trim() || undefined,
      progressPct: Math.max(0, Math.min(100, Number(draft.progressPct) || 0)),
      minStudents: Math.max(1, Number(draft.minStudents) || 1),
      maxStudents: Math.max(Number(draft.minStudents) || 1, Number(draft.maxStudents) || 1),
      aiType: draft.aiType.map((item) => item.trim()).filter(Boolean),
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">
          Código
          <input required value={draft.code} onChange={(event) => update('code', event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Organización
          <input
            required
            value={draft.companyName}
            onChange={(event) => update('companyName', event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Nombre del proyecto
          <input required value={draft.title} onChange={(event) => update('title', event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Descripción del reto
          <textarea
            value={draft.challengeDescription || ''}
            onChange={(event) => update('challengeDescription', event.target.value)}
            rows={3}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs font-bold text-slate-700">
          Avance (%)
          <input
            type="number"
            min="0"
            max="100"
            value={draft.progressPct}
            onChange={(event) => update('progressPct', Number(event.target.value))}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Estado operativo
          <input
            value={draft.progressStatus || ''}
            onChange={(event) => update('progressStatus', event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Riesgo
          <select
            value={draft.riskLevel}
            onChange={(event) => update('riskLevel', event.target.value as Project['riskLevel'])}
            className={`${inputClass} mt-1`}
          >
            <option value="verde">Verde</option>
            <option value="amarillo">Amarillo</option>
            <option value="rojo">Rojo</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Complejidad
          <input
            type="number"
            min="1"
            max="10"
            value={draft.complexityRating}
            onChange={(event) => update('complexityRating', Number(event.target.value))}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">
          Mínimo de estudiantes
          <input
            type="number"
            min="1"
            value={draft.minStudents}
            onChange={(event) => update('minStudents', Number(event.target.value))}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Máximo de estudiantes
          <input
            type="number"
            min="1"
            value={draft.maxStudents}
            onChange={(event) => update('maxStudents', Number(event.target.value))}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Tipo de IA
          <input
            value={draft.aiType.join(', ')}
            onChange={(event) => update('aiType', event.target.value.split(','))}
            className={`${inputClass} mt-1`}
            placeholder="Generativa, clasificación…"
          />
        </label>
      </div>
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-xs font-bold text-[#0E2C40]">Caracterización y enlaces de recursos</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Impacto COP anual
            <input
              type="number"
              value={draft.copImpactAnnual || ''}
              onChange={(event) => update('copImpactAnnual', event.target.value ? Number(event.target.value) : undefined)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Impacto / descripción
            <input
              value={draft.copImpactDescription || ''}
              onChange={(event) => update('copImpactDescription', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Datos requeridos
            <input
              value={draft.requiredDatasets || ''}
              onChange={(event) => update('requiredDatasets', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Calidad y disponibilidad
            <input
              value={draft.dataQualityAvailability || ''}
              onChange={(event) => update('dataQualityAvailability', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Viabilidad técnica
            <input
              value={draft.techViability || ''}
              onChange={(event) => update('techViability', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Riesgos de IA
            <input
              value={draft.aiRisks || ''}
              onChange={(event) => update('aiRisks', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            WhatsApp
            <input
              type="url"
              value={draft.whatsappUrl || ''}
              onChange={(event) => update('whatsappUrl', event.target.value || undefined)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Drive
            <input
              type="url"
              value={draft.driveFolderUrl || ''}
              onChange={(event) => update('driveFolderUrl', event.target.value || undefined)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            GitHub
            <input
              type="url"
              value={draft.githubUrl || ''}
              onChange={(event) => update('githubUrl', event.target.value || undefined)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Teams
            <input
              type="url"
              value={draft.teamsMeetingUrl || ''}
              onChange={(event) => update('teamsMeetingUrl', event.target.value || undefined)}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
      </details>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4" />
          Guardar cambios
        </Button>
      </div>
    </form>
  );
};

export const TasksView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({
  projects,
  projectId,
  onChanged,
  onOpenProject,
  isMonitor = true,
}) => {
  const [create, setCreate] = useState(false);
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState('todas');
  const project = projects.find((item) => item.id === (projectId || globalProject));
  const priorityRank: Record<TaskPriority, number> = { critica: 4, alta: 3, media: 2, baja: 1 };
  const tasks = OperationsService.getTasks(projectId)
    .filter((task) => statusFilter === 'todas' || (statusFilter === 'abiertas' ? task.status !== 'completada' : task.status === statusFilter))
    .sort(
      (a, b) =>
        Number(a.status === 'completada') - Number(b.status === 'completada') ||
        priorityRank[b.priority] - priorityRank[a.priority] ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="dynamic-copy text-xs font-semibold">{tasks.length} tarea(s) listadas</div>
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceMenu
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filtrar tareas"
            className="w-44"
            options={[
              { value: 'abiertas', label: 'Abiertas' },
              { value: 'todas', label: 'Todas' },
              ...taskStatuses.map((status) => ({ value: status, label: status.replace('_', ' ') })),
            ]}
          />
          <Button onClick={() => setCreate(true)}>
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
        </div>
      </div>

      <Modal open={create} title="Nueva tarea" onClose={() => setCreate(false)}>
        {project && (
          <>
            {!projectId && (
              <label className="mb-3 block text-xs font-bold text-slate-700">
                Proyecto
                <ProjectPicker projects={projects} value={globalProject} onChange={setGlobalProject} />
              </label>
            )}
            <TaskForm
              project={project}
              onCancel={() => setCreate(false)}
              onDone={() => {
                setCreate(false);
                onChanged();
              }}
            />
          </>
        )}
      </Modal>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-slate-50/50">
              <div className="dynamic-copy min-w-[220px] flex-1">
                <b className={`block text-sm font-bold ${task.status === 'completada' ? 'text-slate-400 line-through' : 'text-[#0E2C40]'}`}>
                  {task.title}
                </b>
                {task.description && <p className="mt-1 text-xs text-slate-500">{task.description}</p>}
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {projectCode(projects, task.projectId)} · {task.assigneeName} · {formatDate(task.dueDate)} · fuente: {task.source}
                </p>
              </div>
              <Badge tone={isTaskOverdue(task) ? 'red' : task.priority === 'alta' || task.priority === 'critica' ? 'amber' : 'slate'}>
                {isTaskOverdue(task) ? 'vencida' : priorityLabel[task.priority]}
              </Badge>
              <ChoiceMenu
                value={task.status}
                onChange={(value) => {
                  OperationsService.updateTask(task.id, { status: value as ProjectTask['status'] });
                  onChanged();
                }}
                ariaLabel={`Estado de ${task.title}`}
                className="w-36"
                options={taskStatuses.map((status) => ({ value: status, label: status.replace('_', ' ') }))}
              />
              <Button
                tone="secondary"
                onClick={() => {
                  OperationsService.updateTask(task.id, { status: task.status === 'completada' ? 'pendiente' : 'completada' });
                  onChanged();
                }}
              >
                <Check className="h-4 w-4" />
                {task.status === 'completada' ? 'Reabrir' : 'Marcar realizada'}
              </Button>
              {!projectId && (
                <Button tone="secondary" onClick={() => onOpenProject(task.projectId)}>
                  Ver
                </Button>
              )}
              {isMonitor && (
                <Button
                  tone="ghost"
                  aria-label={`Eliminar ${task.title}`}
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta tarea?')) {
                      OperationsService.deleteTask(task.id);
                      onChanged();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              )}
            </div>
          ))}
          {!tasks.length && (
            <div className="p-6">
              <Empty text="No hay tareas en este filtro." />
            </div>
          )}
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        OperationsService.createIssue({
          projectId: project.id,
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          reportedBy: 'Equipo del proyecto',
        });
        onDone();
      }}
      className="space-y-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-5"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">
          Título
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="¿Qué impide avanzar?"
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Categoría
          <div className="mt-1">
            <ChoiceMenu
              value={category}
              onChange={(value) => setCategory(value as ProjectIssue['category'])}
              ariaLabel="Categoría"
              options={[
                { value: 'tecnico', label: 'Técnico' },
                { value: 'datos_accesos', label: 'Datos o accesos' },
                { value: 'comunicacion', label: 'Comunicación' },
                { value: 'equipo', label: 'Equipo' },
                { value: 'recursos', label: 'Recursos' },
                { value: 'otro', label: 'Otro' },
              ]}
            />
          </div>
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-700">
        Contexto
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${inputClass} mt-1`}
          rows={4}
          placeholder="Describe qué ocurrió, qué intentaron, desde cuándo y qué ayuda necesitan."
        />
      </label>
      <label className="block max-w-xs text-xs font-bold text-slate-700">
        Prioridad
        <div className="mt-1">
          <ChoiceMenu
            value={priority}
            onChange={(value) => setPriority(value as TaskPriority)}
            ariaLabel="Prioridad"
            options={taskPriorities.map((item) => ({ value: item, label: priorityLabel[item] }))}
          />
        </div>
      </label>
      <div className="flex gap-2 pt-2">
        <Button type="submit" tone="danger">
          <AlertTriangle className="h-4 w-4" />
          Enviar al monitor
        </Button>
        <Button type="button" tone="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export const IssuesView: React.FC<Common & { projectId?: string; isStudent?: boolean }> = ({
  projects,
  projectId,
  onChanged,
  onOpenProject,
  isStudent,
}) => {
  const [create, setCreate] = useState(false);
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const project = projects.find((item) => item.id === (projectId || globalProject));
  const issues = OperationsService.getIssues(projectId).sort(
    (a, b) =>
      Number(a.status === 'resuelta') - Number(b.status === 'resuelta') ||
      ({ critica: 4, alta: 3, media: 2, baja: 1 }[b.priority] || 0) - ({ critica: 4, alta: 3, media: 2, baja: 1 }[a.priority] || 0) ||
      b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="dynamic-copy text-xs font-semibold">{issues.length} incidencia(s) registradas</div>
        <Button tone="danger" onClick={() => setCreate(true)}>
          <Plus className="h-4 w-4" />
          Reportar incidente
        </Button>
      </div>

      <Modal open={create} title="Reportar incidente" onClose={() => setCreate(false)}>
        {project && (
          <>
            {!projectId && (
              <label className="mb-3 block text-xs font-bold text-slate-700">
                Proyecto
                <ProjectPicker projects={projects} value={globalProject} onChange={setGlobalProject} />
              </label>
            )}
            <IssueForm
              project={project}
              onCancel={() => setCreate(false)}
              onDone={() => {
                setCreate(false);
                onChanged();
              }}
            />
          </>
        )}
      </Modal>

      <div className="grid gap-4 md:grid-cols-2">
        {issues.map((issue) => (
          <Card key={issue.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="dynamic-copy">
                  <h2 className="font-extrabold text-[#0E2C40]">{issue.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {projectCode(projects, issue.projectId)} · {issue.category.replace('_', ' ')} · {formatDate(issue.createdAt)}
                  </p>
                </div>
                <Badge tone={issue.priority === 'alta' || issue.priority === 'critica' ? 'red' : 'amber'}>
                  {priorityLabel[issue.priority]}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{issue.description}</p>
              {issue.resolution && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                  <b className="font-bold">Resolución:</b> {issue.resolution}
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <ChoiceMenu
                value={issue.status}
                onChange={(value) => {
                  const status = value as ProjectIssue['status'];
                  const resolution = status === 'resuelta' ? issue.resolution || 'Incidencia marcada como resuelta.' : issue.resolution;
                  OperationsService.updateIssue(issue.id, { status, resolution });
                  onChanged();
                }}
                ariaLabel={`Estado de ${issue.title}`}
                className="w-40"
                options={[
                  { value: 'abierta', label: 'Abierta' },
                  { value: 'en_revision', label: 'En revisión' },
                  { value: 'esperando_tercero', label: 'Esperando tercero' },
                  { value: 'resuelta', label: 'Resuelta' },
                ]}
              />
              {issue.status !== 'resuelta' && (
                <Button
                  tone="secondary"
                  onClick={() => {
                    OperationsService.updateIssue(issue.id, {
                      status: 'resuelta',
                      resolution: issue.resolution || 'Incidencia marcada como resuelta.',
                    });
                    onChanged();
                  }}
                >
                  <Check className="h-4 w-4" />
                  Marcar resuelta
                </Button>
              )}
              {isStudent ? (
                <span className="text-[11px] font-medium text-slate-400">Puedes actualizar el estado</span>
              ) : (
                <Button
                  tone="ghost"
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta incidencia?')) {
                      OperationsService.deleteIssue(issue.id);
                      onChanged();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              )}
              {!projectId && (
                <Button tone="secondary" onClick={() => onOpenProject(issue.projectId)}>
                  Abrir proyecto
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!issues.length && <Empty text="No hay incidencias registradas." />}
      </div>
    </div>
  );
};

const MeetingForm: React.FC<{
  project: Project;
  meeting?: ProjectMeeting;
  onDone: () => void;
  onCancel: () => void;
  onCalendarSynced?: () => void;
}> = ({ project, meeting: existingMeeting, onDone, onCancel, onCalendarSynced }) => {
  const [title, setTitle] = useState(existingMeeting?.title || 'Seguimiento de proyecto');
  const [date, setDate] = useState(existingMeeting?.startsAt.slice(0, 10) || inDays(1));
  const [time, setTime] = useState(existingMeeting?.startsAt.slice(11, 16) || '15:00');
  const [duration, setDuration] = useState(existingMeeting?.durationMinutes || 45);
  const [agenda, setAgenda] = useState(existingMeeting?.agenda || 'Revisar avances, bloqueos, decisiones y próximos compromisos.');
  const [meetingUrl, setMeetingUrl] = useState(existingMeeting?.meetingUrl || '');
  const [meetingPassword, setMeetingPassword] = useState(existingMeeting?.meetingPassword || '');
  const [attendees, setAttendees] = useState(existingMeeting?.attendees || project.assignedStudents.map((student) => student.email));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const meeting = existingMeeting
      ? OperationsService.updateMeeting(existingMeeting.id, {
          title: title.trim(),
          startsAt: `${date}T${time}:00`,
          durationMinutes: duration,
          attendees,
          agenda: agenda.trim(),
          meetingUrl: meetingUrl.trim() || undefined,
          meetingPassword: meetingPassword.trim() || undefined,
          calendarSync: SyncService.isRemoteMode() ? 'pendiente' : 'simulado',
        })!
      : OperationsService.createMeeting({
          projectId: project.id,
          title: title.trim(),
          startsAt: `${date}T${time}:00`,
          durationMinutes: duration,
          attendees,
          agenda: agenda.trim(),
          meetingUrl: meetingUrl.trim() || undefined,
          meetingPassword: meetingPassword.trim() || undefined,
          timezone: 'America/Bogota',
          status: 'programada',
        });
    try {
      if (SyncService.isRemoteMode()) {
        const result = await CalendarService.sync(meeting.id);
        if (result.mode === 'google') onCalendarSynced?.();
        if (result.mode === 'simulado' && result.message) window.alert(result.message);
      }
    } catch (caught) {
      OperationsService.updateMeeting(meeting.id, { calendarSync: 'error' });
      window.alert(`La reunión quedó guardada, pero Calendar no se sincronizó: ${caught instanceof Error ? caught.message : 'error desconocido'}`);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/30 p-5"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Título
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Fecha
          <input required type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Hora
          <input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Duración (min)
          <input
            required
            type="number"
            min={15}
            max={240}
            step={15}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2 lg:col-span-3">
          Agenda
          <textarea required value={agenda} onChange={(event) => setAgenda(event.target.value)} className={`${inputClass} mt-1`} rows={2} />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Enlace de reunión
          <input
            type="url"
            value={meetingUrl}
            onChange={(event) => setMeetingUrl(event.target.value)}
            placeholder="https://teams.microsoft.com/..."
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-bold text-slate-700 md:col-span-2">
          Contraseña de reunión
          <input
            value={meetingPassword}
            onChange={(event) => setMeetingPassword(event.target.value)}
            autoComplete="off"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <fieldset>
        <legend className="text-xs font-bold text-slate-700">Invitados del equipo</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {project.assignedStudents.map((student) => (
            <label key={student.email} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={attendees.includes(student.email)}
                onChange={(event) =>
                  setAttendees(
                    event.target.checked
                      ? [...attendees, student.email]
                      : attendees.filter((email) => email !== student.email)
                  )
                }
              />
              {student.name}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[11px] text-slate-400">
        Zona horaria: America/Bogota. {SyncService.isRemoteMode() ? 'Al guardar se intentará sincronizar con Google Calendar.' : 'Google Calendar está simulado en el entorno local.'}
      </p>
      <div className="flex gap-2 pt-2">
        <Button disabled={saving} type="submit">
          <CalendarDays className="h-4 w-4" />
          {saving ? 'Guardando…' : existingMeeting ? 'Guardar cambios' : 'Programar'}
        </Button>
        <Button disabled={saving} type="button" tone="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
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

  const updateCommitment = (index: number, patch: Partial<TranscriptAnalysisResult['commitments'][number]>) =>
    setResult((current) =>
      current
        ? {
            ...current,
            commitments: current.commitments.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
          }
        : current
    );

  const updateDecision = (index: number, decision: string) =>
    setResult((current) =>
      current
        ? {
            ...current,
            decisions: current.decisions.map((item, itemIndex) => (itemIndex === index ? { ...item, decision } : item)),
          }
        : current
    );

  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|vtt)$/i.test(file.name)) {
      setError('Solo se admiten archivos .txt o .vtt.');
      return;
    }
    if (file.size > 2_000_000) {
      setError('El archivo supera 2 MB. Divide la transcripción antes de cargarla.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      setSelectedFile(file);
      setError('');
    };
    reader.onerror = () => setError('No fue posible leer el archivo.');
    reader.readAsText(file);
  };

  const analyze = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await AIService.analyzeTranscript(text, project.title, project.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo analizar la transcripción.');
    } finally {
      setBusy(false);
    }
  };

  const saveMinute = async () => {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      const file = selectedFile || new File([text], `transcripcion-${meeting?.id || Date.now()}.txt`, { type: 'text/plain' });
      const stored = await StorageService.uploadTranscript(project.id, file);
      OperationsService.saveMinuteFromAnalysis(project, result, {
        meetingId: meeting?.id,
        meetingDate: meeting?.startsAt.slice(0, 10),
        attendees: meeting?.attendees,
        transcriptStoragePath: stored.path,
      });
      try {
        const sourceFile: DocumentSourceFile = {
          name: file.name,
          mimeType: file.type || 'text/plain',
          size: file.size,
          storagePath: stored.path,
          extractedChars: Math.min(text.length, 120_000),
        };
        const generated = await DocumentWorkflowService.generate({
          projectId: project.id,
          documentType: 'acta_reunion',
          sourceText: text.slice(0, 120_000),
          sourceFiles: [sourceFile],
          instructions: `Reunión: ${meeting?.title || result.title}. Usa como hechos confirmados el resumen, las decisiones y los compromisos revisados por el usuario: ${JSON.stringify(
            result
          ).slice(0, 12_000)}`,
        });
        const pdf = await DocumentExportService.createAndStorePdf(generated.document);
        await DocumentWorkflowService.attachPdf(generated.document, pdf.stored.path);
      } catch (documentError) {
        window.alert(
          `El acta estructurada y sus tareas sí quedaron guardadas. La generación del documento institucional quedó pendiente: ${
            documentError instanceof Error ? documentError.message : 'error desconocido'
          }`
        );
      }
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el acta y su transcripción.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4 border-teal-200/80 bg-teal-50/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-[#0E2C40]">{meeting ? `Crear acta · ${meeting.title}` : 'Crear acta sin reunión programada'}</h3>
          <p className="text-xs text-slate-500">TXT/VTT → análisis → revisión humana → acta y tareas de este proyecto.</p>
        </div>
        <Badge tone={AIService.isConfigured() ? 'green' : 'amber'}>
          {AIService.isConfigured() ? 'IA remota disponible' : 'análisis local demostrativo'}
        </Badge>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {!result ? (
        <div key="transcript-source" className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Archivo de transcripción
            <input
              type="file"
              accept=".txt,.vtt,text/plain,text/vtt"
              onChange={upload}
              className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Contenido
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder="También puedes pegar aquí la transcripción..."
              className={`${inputClass} mt-1`}
            />
          </label>
          <Button disabled={!text.trim() || busy} onClick={() => void analyze()}>
            <Sparkles className="h-4 w-4" />
            {busy ? 'Analizando…' : 'Generar borrador editable'}
          </Button>
        </div>
      ) : (
        <div key="minute-editor" className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Título
            <input value={result.title || ''} onChange={(event) => setResult({ ...result, title: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Resumen
            <textarea value={result.summary || ''} onChange={(event) => setResult({ ...result, summary: event.target.value })} className={`${inputClass} mt-1`} rows={4} />
          </label>
          <fieldset>
            <legend className="text-xs font-extrabold text-slate-800">Decisiones</legend>
            <div className="mt-2 space-y-2">
              {result.decisions.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input value={item.decision || ''} onChange={(event) => updateDecision(index, event.target.value)} className={inputClass} />
                  <Button tone="ghost" aria-label="Eliminar decisión" onClick={() => setResult({ ...result, decisions: result.decisions.filter((_, itemIndex) => itemIndex !== index) })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button tone="secondary" onClick={() => setResult({ ...result, decisions: [...result.decisions, { decision: '' }] })}>
                <Plus className="h-4 w-4" />
                Decisión
              </Button>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-extrabold text-slate-800">Compromisos que crearán tareas</legend>
            <div className="mt-2 space-y-2">
              {result.commitments.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_150px_auto]">
                  <input value={item.task || ''} onChange={(event) => updateCommitment(index, { task: event.target.value })} className={inputClass} placeholder="Compromiso" />
                  <select value={item.responsible || 'Por asignar'} onChange={(event) => updateCommitment(index, { responsible: event.target.value })} className={inputClass}>
                    <option value="Por asignar">Por asignar</option>
                    {project.assignedStudents.map((student) => (
                      <option key={student.email} value={student.name}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={item.dueDate || ''} onChange={(event) => updateCommitment(index, { dueDate: event.target.value || undefined })} className={inputClass} />
                  <Button tone="ghost" aria-label="Eliminar compromiso" onClick={() => setResult({ ...result, commitments: result.commitments.filter((_, itemIndex) => itemIndex !== index) })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button tone="secondary" onClick={() => setResult({ ...result, commitments: [...result.commitments, { task: '', responsible: 'Por asignar', dueDate: inDays(7) }] })}>
                <Plus className="h-4 w-4" />
                Compromiso
              </Button>
            </div>
          </fieldset>
          <label className="block text-xs font-bold text-slate-700">
            Riesgos detectados
            <textarea value={result.risksDetected || ''} onChange={(event) => setResult({ ...result, risksDetected: event.target.value })} className={`${inputClass} mt-1`} rows={3} />
          </label>
          <p className="text-[11px] text-slate-400">
            Proveedor: {result.provider === 'openai' ? 'OpenAI' : result.provider === 'gemini' ? 'Gemini' : 'heurística local'}. Revisa el contenido antes de guardarlo.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={saving} onClick={() => void saveMinute()}>
              <Save className="h-4 w-4" />
              {saving ? 'Guardando…' : 'Guardar acta y crear tareas'}
            </Button>
            <Button disabled={saving} tone="secondary" onClick={() => setResult(null)}>
              Volver a la transcripción
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export const MeetingsView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({
  projects,
  projectId,
  onChanged,
  onOpenProject,
  isMonitor = true,
}) => {
  const [createModal, setCreateModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ProjectMeeting | null>(null);
  const [agendaView, setAgendaView] = useState<'lista' | 'calendario'>('lista');
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [standaloneActa, setStandaloneActa] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState<string | null>(null);
  const [batchCalendarBusy, setBatchCalendarBusy] = useState(false);
  const [calendarEmbedVersion, setCalendarEmbedVersion] = useState(0);

  const project = projects.find((item) => item.id === (projectId || globalProject));
  const meetings = OperationsService.getMeetings(projectId).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const minutes = OperationsService.getMinutes(projectId);

  const syncCalendar = async (meeting: ProjectMeeting, action: 'upsert' | 'cancel' = 'upsert') => {
    setCalendarBusy(meeting.id);
    try {
      const result = await CalendarService.sync(meeting.id, action);
      if (result.mode === 'google') setCalendarEmbedVersion((value) => value + 1);
      onChanged();
      if (result.mode === 'simulado' && result.message) window.alert(result.message);
    } catch (caught) {
      OperationsService.updateMeeting(meeting.id, { calendarSync: 'error' });
      onChanged();
      window.alert(caught instanceof Error ? caught.message : 'No se pudo sincronizar Google Calendar.');
    } finally {
      setCalendarBusy(null);
    }
  };

  const changeStatus = (meeting: ProjectMeeting, status: ProjectMeeting['status']) => {
    try {
      const updated = OperationsService.updateMeetingStatus(meeting.id, status);
      onChanged();
      if (updated && SyncService.isRemoteMode()) {
        const action = status === 'cancelada' || status === 'no_realizada' ? 'cancel' : 'upsert';
        void syncCalendar(updated, action);
      }
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : 'No se pudo cambiar el estado.');
    }
  };

  const syncPendingMeetings = async () => {
    const pending = meetings.filter(
      (meeting) => (meeting.status === 'programada' || meeting.status === 'reprogramada') && meeting.calendarSync !== 'sincronizado'
    );
    if (!pending.length) {
      window.alert('No hay reuniones pendientes de sincronizar.');
      return;
    }
    setBatchCalendarBusy(true);
    let synced = 0;
    let failed = 0;
    for (const meeting of pending) {
      try {
        const result = await CalendarService.sync(meeting.id);
        if (result.mode === 'google') synced += 1;
      } catch {
        failed += 1;
        OperationsService.updateMeeting(meeting.id, { calendarSync: 'error' });
      }
    }
    setBatchCalendarBusy(false);
    if (synced) setCalendarEmbedVersion((value) => value + 1);
    onChanged();
    window.alert(failed ? `${synced} reunión(es) sincronizada(s). ${failed} no pudieron sincronizarse.` : `${synced} reunión(es) sincronizada(s) con Google Calendar.`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Modal
        open={createModal || Boolean(editingMeeting)}
        title={editingMeeting ? 'Editar reunión' : 'Programar reunión'}
        maxHeight="max-h-[calc(100vh-7rem)]"
        onClose={() => {
          setCreateModal(false);
          setEditingMeeting(null);
        }}
      >
        {project && (
          <>
            {!projectId && !editingMeeting && (
              <label className="mb-3 block text-xs font-bold text-slate-700">
                Proyecto
                <ProjectPicker projects={projects} value={globalProject} onChange={setGlobalProject} />
              </label>
            )}
            <MeetingForm
              project={projects.find((item) => item.id === (editingMeeting?.projectId || project.id)) || project}
              meeting={editingMeeting || undefined}
              onCancel={() => {
                setCreateModal(false);
                setEditingMeeting(null);
              }}
              onDone={() => {
                setCreateModal(false);
                setEditingMeeting(null);
                onChanged();
              }}
              onCalendarSynced={() => setCalendarEmbedVersion((value) => value + 1)}
            />
          </>
        )}
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="dynamic-copy text-xs font-semibold">{meetings.length} reunión(es) en agenda</div>
        <div className="flex flex-wrap items-center gap-2">
          {isMonitor && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Vista de agenda">
              <button
                type="button"
                aria-pressed={agendaView === 'lista'}
                onClick={() => setAgendaView('lista')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  agendaView === 'lista' ? 'bg-[#0D9488] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                type="button"
                aria-pressed={agendaView === 'calendario'}
                onClick={() => setAgendaView('calendario')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  agendaView === 'calendario' ? 'bg-[#0D9488] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Calendario
              </button>
            </div>
          )}
          {SyncService.isRemoteMode() && (
            <Button disabled={batchCalendarBusy} tone="secondary" onClick={() => void syncPendingMeetings()}>
              <CalendarDays className="h-4 w-4" />
              {batchCalendarBusy ? 'Sincronizando…' : 'Sincronizar pendientes'}
            </Button>
          )}
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Programar reunión
          </Button>
        </div>
      </div>

      {projectId && project && (
        <div>
          <Button tone="secondary" onClick={() => setStandaloneActa((value) => !value)}>
            {standaloneActa ? 'Ocultar carga' : 'Crear acta desde TXT sin reunión'}
          </Button>
          {standaloneActa && (
            <ActaUploader
              project={project}
              onDone={() => {
                setStandaloneActa(false);
                onChanged();
              }}
            />
          )}
        </div>
      )}

      {isMonitor && agendaView === 'calendario' ? (
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <iframe
            key={calendarEmbedVersion}
            title="Calendario de Projects Management"
            src={`${GOOGLE_CALENDAR_EMBED_URL}&refresh=${calendarEmbedVersion}`}
            style={{ borderWidth: 0 }}
            width="1000"
            height="500"
            frameBorder="0"
            scrolling="no"
            className="block h-[500px] w-full"
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {meetings.map((meeting) => {
              const meetingProject = projects.find((item) => item.id === meeting.projectId);
              return (
                <Card key={meeting.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold text-[#0E2C40]">{meeting.title}</h2>
                      <p className="mt-1 text-xs text-slate-400">
                        {projectCode(projects, meeting.projectId)} · {formatDate(meeting.startsAt)} · {meeting.durationMinutes} min
                      </p>
                      {meeting.agenda && <p className="mt-2 text-sm text-slate-600">{meeting.agenda}</p>}
                      {meeting.meetingUrl && (
                        <a
                          className="mt-2 inline-block text-xs font-bold text-teal-700 underline hover:text-teal-900"
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir enlace de reunión
                        </a>
                      )}
                      {meeting.meetingPassword && <p className="mt-1 text-xs text-slate-500">Contraseña: {meeting.meetingPassword}</p>}
                    </div>
                    <Badge tone={meeting.status === 'realizada' ? 'green' : meeting.status === 'programada' || meeting.status === 'reprogramada' ? 'indigo' : 'red'}>
                      {meeting.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {(meeting.status === 'programada' || meeting.status === 'reprogramada') && (
                      <>
                        <Button tone="secondary" onClick={() => setEditingMeeting(meeting)}>
                          Editar
                        </Button>
                        <Button tone="secondary" onClick={() => changeStatus(meeting, 'realizada')}>
                          <Check className="h-4 w-4" />
                          Realizada
                        </Button>
                        <Button tone="secondary" onClick={() => changeStatus(meeting, 'no_realizada')}>
                          No realizada
                        </Button>
                        <Button tone="secondary" onClick={() => changeStatus(meeting, 'cancelada')}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {(meeting.status === 'cancelada' || meeting.status === 'no_realizada') && (
                      <Button tone="secondary" onClick={() => changeStatus(meeting, 'reprogramada')}>
                        Reprogramar
                      </Button>
                    )}
                    {meeting.calendarEventUrl ? (
                      <a
                        href={meeting.calendarEventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Abrir Calendar
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 text-[11px] text-slate-400">
                        Calendar: {meeting.calendarSync}
                      </span>
                    )}
                    {SyncService.isRemoteMode() && meeting.status !== 'cancelada' && meeting.status !== 'no_realizada' && (
                      <Button disabled={calendarBusy === meeting.id} tone="secondary" onClick={() => void syncCalendar(meeting)}>
                        <CalendarDays className="h-4 w-4" />
                        {calendarBusy === meeting.id ? 'Sincronizando…' : 'Sincronizar Calendar'}
                      </Button>
                    )}
                    {!projectId && (
                      <Button tone="secondary" onClick={() => onOpenProject(meeting.projectId)}>
                        Abrir proyecto
                      </Button>
                    )}
                  </div>
                  {meetingNeedsMinute(meeting) && projectId && meetingProject && (
                    <ActaUploader project={meetingProject} meeting={meeting} onDone={onChanged} />
                  )}
                </Card>
              );
            })}
            {!meetings.length && <Empty text="No hay reuniones registradas." />}
          </div>

          {projectId && (
            <Card className="mt-6">
              <h2 className="font-extrabold text-[#0E2C40]">Actas guardadas</h2>
              <div className="mt-3 space-y-2">
                {minutes.map((minute) => (
                  <details key={minute.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition">
                    <summary className="cursor-pointer text-sm font-bold text-[#0E2C40]">
                      {minute.title} <span className="font-normal text-slate-400">· {formatDate(minute.meetingDate)}</span>
                    </summary>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">{minute.summary}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {minute.decisions.length} decisiones · {minute.commitments.length} compromisos · {minute.status || 'aprobada'}
                    </p>
                  </details>
                ))}
                {!minutes.length && <Empty text="Todavía no hay actas guardadas." />}
              </div>
            </Card>
          )}
        </>
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
  const [editing, setEditing] = useState(false);

  const choose = (template: DocumentTemplate) => {
    setSelected(template.id);
    setName(template.name);
    setDescription(template.description || '');
    setCategory(template.category);
    setHtml(template.htmlTemplate || '');
  };

  const save = () => {
    if (!current || !name.trim() || !html.trim()) return;
    OperationsService.saveTemplate({
      ...current,
      name: name.trim(),
      description: description.trim(),
      category,
      htmlTemplate: html,
      updatedAt: new Date().toISOString(),
      version: (current.version || 1) + 1,
    });
    setEditing(false);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-extrabold text-[#0E2C40]">Plantillas institucionales</h2>
        <p className="mt-1 text-xs text-slate-500">Administra las cuatro plantillas que recibe la IA.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            onClick={() => choose(template)}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
              selected === template.id ? 'border-[#0D9488] bg-teal-50 text-[#0D9488]' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <b>{template.name.replace('Crear ', '')}</b>
            <small className="ml-2 text-slate-400">v{template.version || 1}</small>
          </button>
        ))}
      </div>
      {current && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Categoría
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentTemplate['category'])}
              className={`${inputClass} mt-1`}
            >
              <option value="seguimiento">Seguimiento</option>
              <option value="requerimientos">Requerimientos</option>
              <option value="entrega">Entrega</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 md:col-span-2">
            Descripción
            <input value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!current} onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
          Editar HTML
        </Button>
        {current && (
          <Button
            tone="secondary"
            onClick={() => {
              OperationsService.saveTemplate({
                ...current,
                isActive: current.isActive === false,
                updatedAt: new Date().toISOString(),
              });
              onDone();
            }}
          >
            {current.isActive === false ? 'Activar' : 'Desactivar'}
          </Button>
        )}
      </div>
      {current?.htmlTemplate && (
        <iframe title="Vista previa de la plantilla" sandbox="" srcDoc={current.htmlTemplate} className="h-[560px] w-full rounded-xl border border-slate-200 bg-white" />
      )}
      <Modal open={editing} title={`Editar HTML · ${name}`} noScroll size="max-w-6xl" onClose={() => setEditing(false)}>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Guarda una nueva versión para conservar el historial de la plantilla.</p>
          <textarea
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            className="h-[calc(100vh-15rem)] min-h-[420px] w-full rounded-xl border border-slate-200 bg-[#0E2C40] p-4 font-mono text-xs text-white outline-none"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2">
            <Button tone="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>
              <Save className="h-4 w-4" />
              Guardar nueva versión
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const DocumentsView: React.FC<Common & { projectId?: string; isMonitor?: boolean }> = ({
  projects,
  projectId,
  isMonitor,
  onChanged,
  onOpenProject,
}) => {
  const [globalProject, setGlobalProject] = useState(projectId || projects[0]?.id || '');
  const [preview, setPreview] = useState<ProjectDocument | null>(null);
  const [documentType, setDocumentType] = useState<InstitutionalDocumentType>('acta_reunion');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [exporting, setExporting] = useState('');
  const [revision, setRevision] = useState('');
  const [revising, setRevising] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState('');
  const [versions, setVersions] = useState<ProjectDocumentVersion[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [panel, setPanel] = useState<'create' | 'generated' | 'templates' | null>('generated');
  const selectedId = projectId || globalProject;
  const allDocuments = OperationsService.getDocuments();
  const template = templateByType(documentType) || INSTITUTIONAL_TEMPLATES[0];

  const showDocument = async (document: ProjectDocument) => {
    setPreview(document);
    setRevision('');
    setError('');
    try {
      setVersions(await DocumentWorkflowService.getVersions(document.id));
    } catch (caught) {
      setVersions([]);
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar el historial.');
    }
  };

  const create = async () => {
    if (!selectedId) {
      setError('Selecciona un proyecto.');
      return;
    }
    if (documentType === 'acta_reunion' && !sourceFiles.length) {
      setError('El acta requiere una transcripción TXT/VTT, PDF o DOCX.');
      return;
    }
    setBusyTemplate(true);
    setError('');
    setWarnings([]);
    try {
      const prepared = await DocumentWorkflowService.prepareSources(selectedId, sourceFiles);
      const generated = await DocumentWorkflowService.generate({
        projectId: selectedId,
        documentType,
        sourceText: prepared.sourceText.slice(0, 120_000),
        sourceFiles: prepared.sourceFiles,
        instructions: instructions.trim(),
      });
      let completed = generated.document;
      try {
        const pdf = await DocumentExportService.createAndStorePdf(generated.document);
        await DocumentWorkflowService.attachPdf(generated.document, pdf.stored.path);
        completed = { ...generated.document, storagePath: pdf.stored.path, pdfStoragePath: pdf.stored.path, generationStatus: 'listo' };
      } catch (pdfError) {
        setWarnings([`El documento quedó guardado, pero el PDF debe regenerarse: ${pdfError instanceof Error ? pdfError.message : 'error desconocido'}`]);
      }
      await showDocument(completed);
      setSourceFiles([]);
      setInstructions('');
      setFileInputKey((value) => value + 1);
      setPanel(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible generar el documento.');
    } finally {
      setBusyTemplate(false);
    }
  };

  const exportDocument = async (document: ProjectDocument, format: 'pdf' | 'docx' | 'html') => {
    const key = `${document.id}-${format}`;
    setExporting(key);
    try {
      if (format === 'html') {
        downloadHtml(document);
        return;
      }
      if (format === 'pdf' && document.pdfStoragePath && SyncService.isRemoteMode()) {
        await DocumentExportService.downloadStoredPdf(document);
        return;
      }
      const result = await DocumentExportService.exportAndDownload(document, format);
      if (format === 'pdf') await DocumentWorkflowService.attachPdf(document, result.stored.path);
      else OperationsService.updateDocument(document.id, { storagePath: result.stored.path });
      onChanged();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : `No se pudo exportar ${format.toUpperCase()}.`);
    } finally {
      setExporting('');
    }
  };

  const requestRevision = async () => {
    if (!preview || revision.trim().length < 5) {
      setError('Describe con precisión el cambio que debe hacer la IA.');
      return;
    }
    setRevising(true);
    setError('');
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
      setRevision('');
      await showDocument(revised);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible revisar el documento.');
    } finally {
      setRevising(false);
    }
  };

  const deleteDocument = async (document: ProjectDocument) => {
    if (!window.confirm(`¿Eliminar “${document.title}”? Esta acción elimina el documento y sus versiones.`)) return;
    setDeletingDocumentId(document.id);
    setError('');
    try {
      await DocumentWorkflowService.delete(document);
      if (preview?.id === document.id) setPreview(null);
      setVersions([]);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el documento.');
    } finally {
      setDeletingDocumentId('');
    }
  };

  const openVersion = (version: ProjectDocumentVersion) => {
    if (!preview) return;
    setPreview({
      ...preview,
      title: version.title,
      version: version.version,
      htmlPreview: version.htmlContent,
      pdfStoragePath: version.pdfStoragePath,
      storagePath: version.pdfStoragePath,
      sourceFiles: version.sourceFiles,
      provider: version.provider,
      model: version.model,
      updatedAt: version.createdAt,
    });
  };

  const creationModal = (
    <Modal open={panel === 'create'} title="Crear documento institucional" noScroll size="max-w-3xl" onClose={() => { setPanel(null); setError(''); }}>
      <div className="space-y-4">
        {!projectId && (
          <label className="block text-xs font-bold text-slate-700">
            Proyecto
            <ProjectPicker projects={projects} value={globalProject} onChange={setGlobalProject} />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INSTITUTIONAL_TEMPLATES.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setDocumentType(item.documentType)}
              className={`rounded-xl border p-3 text-left text-xs transition ${
                documentType === item.documentType
                  ? 'border-[#0D9488] bg-teal-50 text-[#0D9488]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <b className="block leading-tight">{item.name.replace('Crear ', '')}</b>
              <small className="mt-1 block text-[10px] text-slate-400">
                {item.acceptedSources.split(',').filter((value) => value.startsWith('.')).join(', ')}
              </small>
            </button>
          ))}
        </div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <b>{template.name}:</b> {template.sourceHelp}
        </p>
        <FilePicker
          files={sourceFiles}
          inputKey={fileInputKey}
          onChange={setSourceFiles}
          accept=".txt,.vtt,.pdf,.docx,text/plain,text/vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          label="Elegir transcripciones o archivos"
        />
        <label className="block text-xs font-bold text-slate-700">
          Instrucciones para la IA
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={2}
            className={`${inputClass} mt-1`}
            placeholder="Ej. enfatiza riesgos y decisiones confirmadas."
          />
        </label>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">{error}</p>}
        {warnings.map((warning) => (
          <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            {warning}
          </p>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button tone="secondary" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
          <Button disabled={!selectedId || busyTemplate} onClick={() => void create()}>
            <Sparkles className="h-4 w-4" />
            {busyTemplate ? 'Generando…' : `Crear ${template.name.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Modal>
  );

  const generatedPanel = panel === 'generated' && (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-extrabold text-[#0E2C40]">Documentos generados</h2>
        <Button tone="ghost" onClick={() => setPanel(null)}>
          Cerrar
        </Button>
      </div>
      {projects.map((project) => {
        const items = allDocuments.filter((item) => item.projectId === project.id);
        if (!items.length) return null;
        return (
          <div key={project.id} className="mb-5 last:mb-0">
            <button
              type="button"
              className="text-sm font-bold text-[#0D9488] hover:underline"
              onClick={() => onOpenProject(project.id)}
            >
              {project.code} · {project.title}
            </button>
            <div className="mt-2 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b className="text-sm text-[#0E2C40]">{item.title}</b>
                      <p className="text-xs text-slate-400">
                        v{item.version} · {item.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button tone="secondary" onClick={() => void showDocument(item)}>
                        <Eye className="h-4 w-4" />
                        Vista previa
                      </Button>
                      <Button tone="secondary" onClick={() => void exportDocument(item, 'pdf')}>
                        PDF
                      </Button>
                      <Button tone="danger" disabled={deletingDocumentId === item.id} onClick={() => void deleteDocument(item)}>
                        <Trash2 className="h-4 w-4" />
                        {deletingDocumentId === item.id ? 'Eliminando…' : 'Eliminar'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!allDocuments.length && <Empty text="Aún no hay documentos generados." />}
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!projectId && (
          <div className="min-w-[240px] flex-1">
            <ProjectPicker projects={projects} value={globalProject} onChange={setGlobalProject} />
          </div>
        )}
        <Button onClick={() => setPanel('create')}>
          <Plus className="h-4 w-4" />
          Crear documento institucional
        </Button>
        <Button tone="secondary" onClick={() => setPanel('generated')}>
          Documentos generados
        </Button>
        {isMonitor && !projectId && (
          <Button tone="secondary" onClick={() => setPanel('templates')}>
            Plantillas institucionales
          </Button>
        )}
      </div>

      {panel === 'templates' && (
        <Card>
          <div className="mb-3 flex justify-end">
            <Button tone="ghost" onClick={() => setPanel(null)}>
              Cerrar
            </Button>
          </div>
          <TemplateEditor onDone={onChanged} />
        </Card>
      )}

      {generatedPanel}
      {creationModal}

      {preview && (
        <Card className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-extrabold text-[#0E2C40]">Vista previa · {preview.title}</h2>
              <p className="text-xs text-slate-400">
                Versión {preview.version} · {preview.sourceFiles?.length || 0} archivos fuente
              </p>
            </div>
            <Button tone="ghost" onClick={() => setPreview(null)}>
              <X className="h-4 w-4" />
              Cerrar
            </Button>
            <Button tone="danger" disabled={deletingDocumentId === preview.id} onClick={() => void deleteDocument(preview)}>
              <Trash2 className="h-4 w-4" />
              {deletingDocumentId === preview.id ? 'Eliminando…' : 'Eliminar documento'}
            </Button>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <iframe
              title={`Vista previa de ${preview.title}`}
              sandbox=""
              srcDoc={preview.htmlPreview}
              className="h-[680px] w-full rounded-2xl border border-slate-200 bg-white"
            />
            <aside className="space-y-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Solicitar cambios a la IA</h3>
                <textarea
                  value={revision}
                  onChange={(event) => setRevision(event.target.value)}
                  rows={5}
                  className={`${inputClass} mt-2`}
                  placeholder="Describe el cambio a realizar..."
                />
                <Button
                  disabled={revising || preview.status === 'aprobado'}
                  onClick={() => void requestRevision()}
                  className="mt-2 w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  {revising ? 'Creando versión…' : 'Aplicar y versionar'}
                </Button>
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Historial de versiones</h3>
                <div className="mt-2 space-y-2">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => openVersion(version)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-left text-xs transition hover:border-[#0D9488]"
                    >
                      <b className="text-[#0E2C40]">Versión {version.version}</b>
                      <span className="mt-1 block text-slate-400">
                        {formatDate(version.createdAt)} · {version.provider}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </Card>
      )}
    </div>
  );
};

const TeamManager: React.FC<{ project: Project; projects: Project[]; onDone: () => void }> = ({
  project,
  projects,
  onDone,
}) => {
  const [selected, setSelected] = useState<string[]>(project.assignedStudents.map((student) => student.email.toLowerCase()));
  const students = OperationsService.getStudents();
  const assignment = (email: string) =>
    projects.find((item) => item.assignedStudents.some((student) => student.email.toLowerCase() === email.toLowerCase()));

  const save = () => {
    try {
      OperationsService.assignStudentsExclusively(project.id, selected);
      onDone();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : 'No se pudo asignar el equipo.');
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-[#0E2C40]">Gestionar integrantes</h2>
          <p className="mt-1 text-xs text-slate-500">
            La selección guardada será el equipo exacto. Si alguien estaba en otro proyecto, se trasladará automáticamente.
          </p>
        </div>
        <Badge tone={selected.length > project.maxStudents ? 'red' : 'indigo'}>
          {selected.length}/{project.maxStudents}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {students.map((student) => {
          const currentProject = assignment(student.email);
          const checked = selected.includes(student.email.toLowerCase());
          return (
            <label
              key={student.email}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                checked ? 'border-teal-200 bg-teal-50/50' : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...new Set([...selected, student.email.toLowerCase()])]
                      : selected.filter((email) => email !== student.email.toLowerCase())
                  )
                }
              />
              <span className="min-w-0">
                <b className="block text-[#0E2C40]">{student.name}</b>
                <small className="block truncate text-slate-500">{student.email}</small>
                {currentProject && currentProject.id !== project.id && (
                  <small className="mt-1 block font-bold text-amber-700">Actualmente en {currentProject.code}; será trasladado</small>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3 pt-2">
        <Button disabled={selected.length > project.maxStudents} onClick={save}>
          <UserPlus className="h-4 w-4" />
          Guardar equipo exacto
        </Button>
        {selected.length > project.maxStudents && (
          <span className="text-xs font-bold text-rose-600">Supera la capacidad máxima ({project.maxStudents}).</span>
        )}
      </div>
    </Card>
  );
};

const ProjectSummary: React.FC<{
  project: Project;
  links: ProjectResourceLink[];
  activity: ReturnType<typeof OperationsService.getActivity>;
  onAddLink: () => void;
  onContacts: () => void;
}> = ({ project, links, activity, onAddLink, onContacts }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-[#0E2C40]">Enlaces del proyecto</h2>
        <div className="flex flex-wrap gap-2">
          <Button tone="secondary" onClick={onContacts}>
            Contactos de organización
          </Button>
          <Button tone="secondary" onClick={onAddLink}>
            Nuevo enlace
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-bold text-[#0E2C40] transition hover:border-[#0D9488] hover:bg-teal-50/40"
          >
            <LinkIcon className="h-4 w-4 text-[#0D9488]" />
            <span className="truncate">{link.label}</span>
          </a>
        ))}
        <button
          type="button"
          onClick={onContacts}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm font-bold text-[#0E2C40] transition hover:border-[#0D9488] hover:bg-teal-50/40"
        >
          <Users className="h-4 w-4 text-[#0D9488]" />
          <span>Contactos de organización</span>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {project.contacts.length}
          </span>
        </button>
        {!links.length && <p className="text-sm text-slate-400">Aún no hay enlaces registrados.</p>}
      </div>
    </Card>
    <Card className="lg:col-span-2">
      <h2 className="font-extrabold text-[#0E2C40]">Actividad reciente</h2>
      <div className="mt-3 divide-y divide-slate-100">
        {activity.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <span className="text-slate-700">{item.message}</span>
            <small className="whitespace-nowrap text-slate-400">{formatDate(item.createdAt)}</small>
          </div>
        ))}
        {!activity.length && <Empty text="La actividad aparecerá al crear tareas, incidencias, reuniones o documentos." />}
      </div>
    </Card>
  </div>
);

type ProjectLinkField = 'whatsappUrl' | 'teamsMeetingUrl' | 'githubUrl' | 'driveFolderUrl';
type EditableProjectLink = ProjectResourceLink & { kind: 'custom' | 'fixed'; field?: ProjectLinkField };

const fixedProjectLinks = (project: Project): EditableProjectLink[] =>
  [
    { id: 'whatsapp', label: 'WhatsApp', url: project.whatsappUrl || '', field: 'whatsappUrl' },
    { id: 'drive', label: 'Carpeta Drive', url: project.driveFolderUrl || '', field: 'driveFolderUrl' },
    { id: 'github', label: 'GitHub', url: project.githubUrl || '', field: 'githubUrl' },
    { id: 'teams', label: 'Teams', url: project.teamsMeetingUrl || '', field: 'teamsMeetingUrl' },
  ]
    .filter((link) => link.url)
    .map((link) => ({ ...link, kind: 'fixed' as const, field: link.field as ProjectLinkField }));

const isHttpLink = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const ProjectLinksManager: React.FC<{ project: Project; onChanged: () => void }> = ({ project, onChanged }) => {
  const [editing, setEditing] = useState<EditableProjectLink | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const customLinks = (project.resourceLinks || []).map((link) => ({ ...link, kind: 'custom' as const }));
  const links = [...fixedProjectLinks(project), ...customLinks];

  const openCreate = () => {
    setEditing('new');
    setLabel('');
    setUrl('');
    setError('');
  };

  const openEdit = (link: EditableProjectLink) => {
    setEditing(link);
    setLabel(link.label);
    setUrl(link.url);
    setError('');
  };

  const save = () => {
    const cleanLabel = label.trim();
    const cleanUrl = url.trim();
    if (!cleanLabel || !isHttpLink(cleanUrl)) {
      setError('Ingresa un nombre y una URL http(s) válida.');
      return;
    }
    const resourceLinks =
      editing === 'new'
        ? [...(project.resourceLinks || []), { id: crypto.randomUUID(), label: cleanLabel, url: cleanUrl }]
        : editing?.kind === 'custom'
          ? (project.resourceLinks || []).map((link) => (link.id === editing.id ? { ...link, label: cleanLabel, url: cleanUrl } : link))
          : project.resourceLinks || [];
    const patch: Pick<Project, 'resourceLinks' | 'whatsappUrl' | 'teamsMeetingUrl' | 'githubUrl' | 'driveFolderUrl'> = { resourceLinks };
    if (editing !== 'new' && editing?.kind === 'fixed' && editing.field) patch[editing.field] = cleanUrl;
    OperationsService.updateProjectLinks(project.id, patch);
    setEditing(null);
    onChanged();
  };

  const remove = (link: EditableProjectLink) => {
    if (!window.confirm(`¿Eliminar el enlace ${link.label}?`)) return;
    const patch: Pick<Project, 'resourceLinks' | 'whatsappUrl' | 'teamsMeetingUrl' | 'githubUrl' | 'driveFolderUrl'> = {
      resourceLinks: link.kind === 'custom' ? (project.resourceLinks || []).filter((item) => item.id !== link.id) : project.resourceLinks || [],
    };
    if (link.kind === 'fixed' && link.field) patch[link.field] = undefined;
    OperationsService.updateProjectLinks(project.id, patch);
    onChanged();
  };

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-[#0E2C40]">Gestionar enlaces compartidos</h2>
          <p className="mt-1 text-xs text-slate-500">Los cambios son visibles para todo el equipo.</p>
        </div>
        <Button tone="secondary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo enlace
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <div key={`${link.kind}-${link.id}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 p-3">
            <LinkIcon className="h-4 w-4 shrink-0 text-[#0D9488]" />
            <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-bold text-[#0E2C40] hover:underline">
              {link.label}
            </a>
            <button
              type="button"
              aria-label={`Editar enlace ${link.label}`}
              onClick={() => openEdit(link)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Eliminar enlace ${link.label}`}
              onClick={() => remove(link)}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!links.length && <Empty text="Aún no hay enlaces registrados." />}
      </div>
      <Modal open={editing !== null} title={editing === 'new' ? 'Agregar enlace' : 'Editar enlace'} onClose={() => setEditing(null)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <label className="block text-xs font-bold text-slate-700">
            Nombre
            <input
              required
              value={label}
              disabled={editing !== 'new' && editing?.kind === 'fixed'}
              onChange={(event) => setLabel(event.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Ej. Repositorio, Drive, WhatsApp"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            URL
            <input
              required
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="https://..."
            />
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" tone="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar enlace</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};

const TeamPendingActions: React.FC<{ projectId: string; onOpenMeetings: () => void }> = ({ projectId, onOpenMeetings }) => {
  const issues = OperationsService.getIssues(projectId).filter((issue) => issue.status !== 'resuelta');
  const overdue = OperationsService.getTasks(projectId).filter((task) => isTaskOverdue(task));
  const minutes = OperationsService.getMeetings(projectId).filter(meetingNeedsMinute);
  const actions = [
    ...issues.map((issue) => ({ id: issue.id, label: issue.title, detail: 'Incidencia abierta', tone: 'red' as const, onClick: undefined as (() => void) | undefined })),
    ...overdue.map((task) => ({ id: task.id, label: task.title, detail: 'Tarea vencida', tone: 'amber' as const, onClick: undefined as (() => void) | undefined })),
    ...minutes.map((meeting) => ({ id: meeting.id, label: meeting.title, detail: 'Reunión sin acta', tone: 'indigo' as const, onClick: onOpenMeetings })),
  ];

  return (
    <Card className="mt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-extrabold text-[#0E2C40]">Pendientes por resolver del equipo</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{actions.length}</span>
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            type="button"
            key={`${action.detail}-${action.id}`}
            onClick={action.onClick}
            className={`flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left ${action.onClick ? 'transition hover:border-teal-200 hover:bg-teal-50/30' : 'cursor-default'}`}
          >
            <Badge tone={action.tone}>{action.detail}</Badge>
            <b className="min-w-0 flex-1 truncate text-sm text-[#0E2C40]">{action.label}</b>
            {action.onClick && <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
        ))}
        {!actions.length && <Empty text="No hay pendientes para tu equipo." />}
      </div>
    </Card>
  );
};

export const ProjectDetail: React.FC<Common & { projectId: string; onBack?: () => void; isMonitor?: boolean; initialTab?: 'resumen' | 'reuniones' }> = ({
  projects,
  projectId,
  onChanged,
  onOpenProject,
  onBack,
  isMonitor,
  initialTab = 'resumen',
}) => {
  const project = projects.find((item) => item.id === projectId);
  const [tab, setTab] = useState<'resumen' | 'tareas' | 'reuniones' | 'incidencias' | 'documentos' | 'equipo'>('resumen');
  const [linkModal, setLinkModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });

  useEffect(() => setTab(initialTab), [projectId, isMonitor, initialTab]);

  if (!project) return <Empty text="El proyecto ya no existe o no está disponible." />;

  const tabs = ['resumen', 'tareas', 'reuniones', 'incidencias', 'documentos', 'equipo'] as const;
  const staticLinks: ProjectResourceLink[] = [
    { id: 'whatsapp', label: 'WhatsApp', url: project.whatsappUrl || '' },
    { id: 'drive', label: 'Carpeta Drive', url: project.driveFolderUrl || '' },
    { id: 'github', label: 'GitHub', url: project.githubUrl || '' },
    { id: 'teams', label: 'Teams', url: project.teamsMeetingUrl || '' },
  ].filter((item) => item.url);
  const links = [...staticLinks, ...(project.resourceLinks || [])];
  const activity = OperationsService.getActivity(project.id).slice(0, 8);

  const saveLink = () => {
    if (!linkLabel.trim() || !isHttpLink(linkUrl.trim())) return;
    OperationsService.updateProjectLinks(project.id, {
      resourceLinks: [...(project.resourceLinks || []), { id: crypto.randomUUID(), label: linkLabel.trim(), url: linkUrl.trim() }],
    });
    setLinkLabel('');
    setLinkUrl('');
    setLinkModal(false);
    onChanged();
  };

  const saveContact = () => {
    if (!contact.name.trim() || !contact.email.trim()) return;
    OperationsService.updateProject({
      ...project,
      contacts: [...project.contacts, { name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim() || undefined }],
    });
    setContact({ name: '', email: '', phone: '' });
    onChanged();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {tab === 'resumen' && <ProjectLinksManager project={project} onChanged={onChanged} />}
      {onBack && (
        <button onClick={onBack} className="back-button inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] hover:underline">
          ← Volver a proyectos
        </button>
      )}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone={project.riskLevel === 'rojo' ? 'red' : project.riskLevel === 'amarillo' ? 'amber' : 'green'}>
              {project.code}
            </Badge>
            <h1 className="mt-2 text-2xl font-medium text-slate-700">{project.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {project.companyName} · equipo de {project.assignedStudents.length} personas · avance {project.progressPct}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" onClick={() => setLinkModal(true)}>
              <Plus className="h-4 w-4" />
              Agregar enlace
            </Button>
            {isMonitor && (
              <Button onClick={() => setEditModal(true)}>
                <Pencil className="h-4 w-4" />
                Editar proyecto
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span>
            <b className="text-slate-900">{OperationsService.getTasks(project.id).filter((task) => task.status !== 'completada').length}</b> tareas abiertas
          </span>
          <span>
            <b className="text-slate-900">{OperationsService.getIssues(project.id).filter((issue) => issue.status !== 'resuelta').length}</b> incidencias abiertas
          </span>
          <span>
            <b className="text-slate-900">{OperationsService.getMeetings(project.id).filter(meetingNeedsMinute).length}</b> actas pendientes
          </span>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold capitalize transition ${
                tab === item ? 'bg-teal-50 text-[#0D9488]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      <div>
        {tab === 'resumen' && (
          <>
            <ProjectSummary
              project={project}
              links={links}
              activity={activity}
              onAddLink={() => setLinkModal(true)}
              onContacts={() => setContactModal(true)}
            />
            {!isMonitor && <TeamPendingActions projectId={project.id} onOpenMeetings={() => setTab('reuniones')} />}
          </>
        )}
        {tab === 'tareas' && <TasksView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'reuniones' && <MeetingsView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'incidencias' && <IssuesView projects={projects} projectId={project.id} isStudent={!isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'documentos' && <DocumentsView projects={projects} projectId={project.id} isMonitor={isMonitor} onChanged={onChanged} onOpenProject={onOpenProject} />}
        {tab === 'equipo' &&
          (isMonitor ? (
            <TeamManager project={project} projects={projects} onDone={onChanged} />
          ) : (
            <Card>
              <h2 className="font-extrabold text-[#0E2C40]">Mi equipo</h2>
              <div className="mt-3 space-y-2">
                {project.assignedStudents.map((student) => (
                  <div key={student.email} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
                    <b className="text-[#0E2C40]">{student.name}</b>
                    <small className="ml-2 text-slate-400">{student.email}</small>
                  </div>
                ))}
              </div>
            </Card>
          ))}
      </div>

      <Modal open={editModal} title="Editar proyecto" maxHeight="max-h-[calc(100vh-8rem)]" onClose={() => setEditModal(false)}>
        <ProjectEditForm
          project={project}
          onCancel={() => setEditModal(false)}
          onDone={(updated) => {
            OperationsService.updateProject(updated);
            setEditModal(false);
            onChanged();
          }}
        />
      </Modal>

      <Modal open={linkModal} title="Agregar enlace" onClose={() => setLinkModal(false)}>
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Nombre del botón
            <input
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Ej. Repositorio, Drive, WhatsApp"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            URL
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="https://..."
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button tone="secondary" onClick={() => setLinkModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveLink}>Guardar enlace</Button>
          </div>
        </div>
      </Modal>

      <Modal open={contactModal} title="Contactos de organización" onClose={() => setContactModal(false)}>
        <div className="space-y-4">
          {project.contacts.map((item) => (
            <div key={item.email} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
              <span>
                <b className="text-[#0E2C40]">{item.name}</b>
                <small className="ml-2 text-slate-400">
                  {item.email} · {item.phone || 'sin celular'}
                </small>
              </span>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-extrabold text-[#0E2C40]">Nuevo contacto</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <input value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} className={inputClass} placeholder="Nombre" />
              <input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} className={inputClass} placeholder="Correo" />
              <input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} className={inputClass} placeholder="Celular" />
            </div>
            <Button onClick={saveContact} className="mt-3">
              Guardar contacto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const PeopleView: React.FC<Common> = ({ projects, onChanged }) => {
  const students = OperationsService.getStudents();
  const applications = OperationsService.getApplications().filter((application) => application.status === 'pendiente');
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<'todos' | 'con_proyecto' | 'sin_proyecto'>('todos');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [targetProject, setTargetProject] = useState(projects[0]?.id || '');
  const [deactivated, setDeactivated] = useState<string[]>([]);

  const currentProject = (student: Student) =>
    projects.find((project) => project.assignedStudents.some((member) => member.email.toLowerCase() === student.email.toLowerCase()));

  const visibleStudents = students.filter((student) => {
    const hasProject = Boolean(currentProject(student));
    const matchesSearch = `${student.name} ${student.email} ${student.code || ''}`.toLowerCase().includes(query.toLowerCase());
    const matchesProjectFilter = projectFilter === 'todos' || (projectFilter === 'con_proyecto' ? hasProject : !hasProject);
    return student.isActive !== false && !deactivated.includes(student.email.toLowerCase()) && matchesSearch && matchesProjectFilter;
  });

  const openAssign = (student: Student) => {
    setSelectedStudent(student);
    setTargetProject(projects[0]?.id || '');
    setAssignOpen(true);
  };

  const assign = () => {
    if (!selectedStudent || !targetProject) return;
    try {
      OperationsService.assignStudentsExclusively(targetProject, [selectedStudent.email]);
      setAssignOpen(false);
      onChanged();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : 'No se pudo asignar el proyecto.');
    }
  };

  const clearProjectAssignment = () => {
    if (!selectedStudent) return;
    const assigned = currentProject(selectedStudent);
    if (!assigned) {
      setManageOpen(false);
      return;
    }
    try {
      OperationsService.removeStudent(assigned.id, selectedStudent.email);
      setTargetProject('');
      setManageOpen(false);
      onChanged();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : 'No se pudo retirar al estudiante del proyecto.');
    }
  };

  const deactivate = () => {
    if (!selectedStudent) return;
    const assigned = currentProject(selectedStudent);
    if (assigned) OperationsService.removeStudent(assigned.id, selectedStudent.email);
    SyncService.enqueueProfileActive(selectedStudent.id, false);
    setDeactivated((items) => [...items, selectedStudent.email.toLowerCase()]);
    setManageOpen(false);
    onChanged();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, código o correo…"
              className={`${inputClass} pl-10`}
            />
          </div>
          <ChoiceMenu
            value={projectFilter}
            onChange={(value) => setProjectFilter(value as 'todos' | 'con_proyecto' | 'sin_proyecto')}
            ariaLabel="Filtrar personas por proyecto"
            className="w-full min-w-[190px] sm:w-[210px]"
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'con_proyecto', label: 'Con proyecto' },
              { value: 'sin_proyecto', label: 'Sin proyecto' },
            ]}
          />
        </div>
        <span className="dynamic-copy text-xs font-semibold">{visibleStudents.length} personas listadas</span>
      </div>

      {applications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <h2 className="font-extrabold text-[#0E2C40]">Postulaciones pendientes</h2>
          <div className="mt-3 space-y-2">
            {applications.map((application) => (
              <div key={application.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <b className="block text-sm text-[#0E2C40]">{application.studentName}</b>
                  <small className="text-slate-500">
                    Solicita {projectCode(projects, application.projectId)} · {formatDate(application.createdAt)}
                  </small>
                </div>
                <Button
                  onClick={() => {
                    try {
                      OperationsService.acceptApplication(application.id);
                      onChanged();
                    } catch (caught) {
                      window.alert(caught instanceof Error ? caught.message : 'No se pudo aceptar.');
                    }
                  }}
                >
                  Aceptar y reasignar
                </Button>
                <Button
                  tone="secondary"
                  onClick={() => {
                    OperationsService.rejectApplication(application.id);
                    onChanged();
                  }}
                >
                  Rechazar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {visibleStudents.map((student) => {
            const project = currentProject(student);
            return (
              <div key={student.email} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-slate-50/50">
                <div className="min-w-0 flex-1">
                  <b className="block text-sm text-[#0E2C40]">{student.name}</b>
                  <small className="block text-slate-400">
                    {student.code || 'Sin código'} · {student.email}
                  </small>
                </div>
                {project ? <Badge tone="indigo">{project.code}</Badge> : <Badge tone="amber">Sin proyecto</Badge>}
                {!project && (
                  <Button onClick={() => openAssign(student)}>
                    <UserPlus className="h-4 w-4" />
                    Asignar proyecto
                  </Button>
                )}
                <Button
                  tone="secondary"
                  onClick={() => {
                    setSelectedStudent(student);
                    setTargetProject(project?.id || projects[0]?.id || '');
                    setManageOpen(true);
                  }}
                >
                  Gestionar
                </Button>
              </div>
            );
          })}
          {!visibleStudents.length && <Empty text="No hay personas que coincidan con la búsqueda." />}
        </div>
      </Card>

      <Modal open={assignOpen} title="Asignar proyecto" size="max-w-2xl" onClose={() => setAssignOpen(false)}>
        {selectedStudent && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <b className="text-[#0E2C40]">{selectedStudent.name}</b>
              <p className="mt-0.5 text-xs text-slate-500">{selectedStudent.email}</p>
            </div>
            <label className="block text-xs font-bold text-slate-700">
              Proyecto
              <ProjectPicker projects={projects} value={targetProject} onChange={setTargetProject} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button tone="secondary" onClick={() => setAssignOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={assign}>Guardar asignación</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={manageOpen} title="Gestionar usuario" size="max-w-2xl" onClose={() => setManageOpen(false)}>
        {selectedStudent && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <b className="text-[#0E2C40]">{selectedStudent.name}</b>
              <p className="mt-1 text-xs text-slate-600">Código: {selectedStudent.code || 'N/A'} · {selectedStudent.email}</p>
              <p className="mt-1 text-xs text-slate-600">Proyecto actual: {currentProject(selectedStudent)?.code || 'Sin proyecto'}</p>
            </div>
            <label className="block text-xs font-bold text-slate-700">
              Cambiar proyecto
              <ProjectPicker projects={projects} value={targetProject} onChange={setTargetProject} />
            </label>
            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
              <div>{currentProject(selectedStudent) && <Button tone="secondary" onClick={clearProjectAssignment}>Sin proyecto</Button>}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  tone="secondary"
                  onClick={() => {
                    assign();
                    setManageOpen(false);
                  }}
                >
                  Guardar cambio
                </Button>
                <Button tone="danger" onClick={deactivate}>
                  Desactivar usuario
                </Button>
                <Button tone="ghost" onClick={() => setManageOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const printProjectReport = (project: Project) => {
  const tasks = OperationsService.getTasks(project.id);
  const issues = OperationsService.getIssues(project.id);
  const meetings = OperationsService.getMeetings(project.id);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;
  printWindow.document.write(
    `<html><head><title>Reporte ${project.code}</title><style>body{font-family:Arial,sans-serif;color:#0e2c40;padding:32px}h1{margin-bottom:4px}h2{margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:6px}li{margin:6px 0}</style></head><body><h1>${project.code} · ${project.title}</h1><p>${project.companyName} · avance ${project.progressPct}%</p><h2>Estudiantes</h2><ul>${project.assignedStudents.map((student) => `<li>${student.name} · ${student.email}</li>`).join('') || '<li>Sin estudiantes</li>'}</ul><h2>Contactos</h2><ul>${project.contacts.map((contact) => `<li>${contact.name} · ${contact.email} · ${contact.phone || ''}</li>`).join('') || '<li>Sin contactos</li>'}</ul><h2>Indicadores</h2><p>Tareas realizadas: ${tasks.filter((task) => task.status === 'completada').length}</p><p>Incidencias presentadas: ${issues.length}</p><p>Reuniones realizadas: ${meetings.filter((meeting) => meeting.status === 'realizada').length}</p></body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const ReportsView: React.FC<Common> = ({ projects }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Project | null>(null);
  const filtered = projects.filter((project) =>
    `${project.code} ${project.companyName} ${project.title}`.toLowerCase().includes(query.toLowerCase())
  );
  const totals = {
    tasks: OperationsService.getTasks().filter((task) => task.status !== 'completada').length,
    overdue: OperationsService.getTasks().filter((task) => isTaskOverdue(task)).length,
    issues: OperationsService.getIssues().filter((issue) => issue.status !== 'resuelta').length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proyecto por nombre, código o empresa…"
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold text-slate-500">Tareas abiertas</p>
          <p className="mt-2 text-3xl font-black text-[#0E2C40]">{totals.tasks}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-slate-500">Tareas vencidas</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{totals.overdue}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-slate-500">Incidencias abiertas</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{totals.issues}</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {filtered.map((project) => {
            const tasks = OperationsService.getTasks(project.id);
            const issues = OperationsService.getIssues(project.id);
            const meetings = OperationsService.getMeetings(project.id);
            return (
              <button
                key={project.id}
                onClick={() => setSelected(project)}
                className="grid w-full gap-2 p-4 text-left transition hover:bg-slate-50/70 md:grid-cols-[1fr_repeat(3,120px)_auto]"
              >
                <span>
                  <b className="block text-[#0E2C40]">{project.code}</b>
                  <small className="text-slate-400">{project.companyName}</small>
                </span>
                <span className="text-sm">
                  <b className="text-slate-800">{tasks.filter((task) => task.status === 'completada').length}</b>
                  <small className="block text-slate-400">realizadas</small>
                </span>
                <span className="text-sm">
                  <b className="text-slate-800">{issues.length}</b>
                  <small className="block text-slate-400">incidencias</small>
                </span>
                <span className="text-sm">
                  <b className="text-slate-800">{meetings.filter((meeting) => meeting.status === 'realizada').length}</b>
                  <small className="block text-slate-400">reuniones</small>
                </span>
                <ChevronRight className="h-4 w-4 self-center text-slate-400" />
              </button>
            );
          })}
          {!filtered.length && <Empty text="No hay proyectos que coincidan con la búsqueda." />}
        </div>
      </Card>

      <Modal open={Boolean(selected)} title={selected ? `Reporte · ${selected.code}` : 'Reporte'} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <b className="text-xs text-slate-500">Estudiantes</b>
                <p className="mt-1 text-2xl font-black text-[#0E2C40]">{selected.assignedStudents.length}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <b className="text-xs text-slate-500">Tareas realizadas</b>
                <p className="mt-1 text-2xl font-black text-emerald-600">
                  {OperationsService.getTasks(selected.id).filter((task) => task.status === 'completada').length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <b className="text-xs text-slate-500">Reuniones realizadas</b>
                <p className="mt-1 text-2xl font-black text-[#0D9488]">
                  {OperationsService.getMeetings(selected.id).filter((meeting) => meeting.status === 'realizada').length}
                </p>
              </div>
            </div>
            <h3 className="font-extrabold text-[#0E2C40]">Estudiantes</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {selected.assignedStudents.map((student) => (
                <li key={student.email}>
                  {student.name} · {student.email}
                </li>
              ))}
            </ul>
            <h3 className="font-extrabold text-[#0E2C40]">Contactos de organización</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {selected.contacts.map((contact) => (
                <li key={contact.email}>
                  {contact.name} · {contact.email} · {contact.phone || 'sin celular'}
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600">
              Incidencias presentadas: <b>{OperationsService.getIssues(selected.id).length}</b>
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button tone="secondary" onClick={() => printProjectReport(selected)}>
                <Download className="h-4 w-4" />
                Imprimir
              </Button>
              <Button tone="ghost" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
