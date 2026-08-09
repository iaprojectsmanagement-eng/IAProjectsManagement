import React, { useState } from 'react';
import { Project, FilterOptions, RiskLevel, Application, AlertItem } from '../types';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Users,
  MessageCircle,
  ExternalLink,
  Video,
  Github,
  Folder,
  FileText,
  DollarSign,
  Cpu,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  UserPlus,
  Plus,
  FileSpreadsheet,
  Edit,
  Trash2
} from 'lucide-react';

interface MonitorDashboardProps {
  projects: Project[];
  applications: Application[];
  alerts: AlertItem[];
  onSelectProject: (project: Project) => void;
  onOpenApplicationsModal: (project: Project) => void;
  onOpenReassignModal: (project: Project) => void;
  onOpenChat: (project: Project) => void;
  onOpenCreateProjectModal: () => void;
  onOpenImportProjectsCSVModal: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const MonitorDashboard: React.FC<MonitorDashboardProps> = ({
  projects,
  applications,
  alerts,
  onSelectProject,
  onOpenApplicationsModal,
  onOpenReassignModal,
  onOpenChat,
  onOpenCreateProjectModal,
  onOpenImportProjectsCSVModal,
  onEditProject,
  onDeleteProject
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    company: 'TODAS',
    risk: 'TODOS',
    aiType: 'TODOS',
    minComplexity: 1,
    maxComplexity: 10,
    searchTerm: ''
  });

  const totalProjects = projects.length;
  const greenCount = projects.filter((p) => p.riskLevel === 'verde').length;
  const yellowCount = projects.filter((p) => p.riskLevel === 'amarillo').length;
  const redCount = projects.filter((p) => p.riskLevel === 'rojo').length;
  const emptyWarningsCount = projects.filter((p) => p.emptyFieldsWarning).length;
  const pendingAppsCount = applications.filter((a) => a.status === 'pendiente').length;

  const uniqueCompanies = Array.from(new Set(projects.map((p) => p.companyName)));
  const allAiTypes = Array.from(new Set(projects.flatMap((p) => p.aiType)));

  const filteredProjects = projects.filter((p) => {
    const term = filters.searchTerm.toLowerCase();
    const matchesSearch =
      p.code.toLowerCase().includes(term) ||
      p.title.toLowerCase().includes(term) ||
      p.companyName.toLowerCase().includes(term) ||
      (p.challengeDescription && p.challengeDescription.toLowerCase().includes(term));

    const matchesCompany = filters.company === 'TODAS' || p.companyName === filters.company;
    const matchesRisk = filters.risk === 'TODOS' || p.riskLevel === filters.risk;
    const matchesAi = filters.aiType === 'TODOS' || p.aiType.includes(filters.aiType);
    const matchesComplexity = p.complexityRating >= filters.minComplexity && p.complexityRating <= filters.maxComplexity;

    return matchesSearch && matchesCompany && matchesRisk && matchesAi && matchesComplexity;
  });

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'verde':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>AL DÍA (VERDE)</span>
          </span>
        );
      case 'amarillo':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>ADVERTENCIA</span>
          </span>
        );
      case 'rojo':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60 animate-pulse">
            <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            <span>CRÍTICO (ROJO)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      <section className="icesi-hero grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="relative z-10 max-w-2xl">
          <p className="icesi-hero-kicker">Facultad de Ingenieria, Diseno y Ciencias Aplicadas</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Seguimiento de proyectos con impacto real.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">Visualiza el progreso de los retos Coomeva, acompana a los equipos y transforma cada avance en evidencia academica.</p>
        </div>
        <div className="relative z-10 border-l-2 border-[#e9f534] pl-4 text-sm text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Periodo academico</p>
          <p className="mt-1 font-black">2026-2 · IA aplicada</p>
        </div>
      </section>
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Proyectos Totales</span>
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2 font-outfit">{totalProjects}</p>
          <p className="text-[10px] text-slate-500 mt-1">Gestión Centralizada</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-emerald-900/40 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>En Orden (Verde)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2 font-outfit">{greenCount}</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-amber-900/40 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
            <span>Pendientes (Amarillo)</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2 font-outfit">{yellowCount}</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-rose-900/40 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
            <span>Críticos (Rojo)</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 mt-2 font-outfit">{redCount}</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-purple-900/40 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-purple-400 text-xs font-medium">
            <span>Vacíos (&gt;7d)</span>
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-300 mt-2 font-outfit">{emptyWarningsCount}</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-sky-900/40 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-sky-400 text-xs font-medium">
            <span>Postulaciones</span>
            <UserPlus className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-sky-300 mt-2 font-outfit">{pendingAppsCount}</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, empresa, título o palabra clave..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenCreateProjectModal}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Proyecto</span>
            </button>

            <button
              onClick={onOpenImportProjectsCSVModal}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
              title="Importar proyectos automáticamente desde CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Importar CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Empresa / Organización</label>
            <select
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500"
            >
              <option value="TODAS">Todas las Empresas ({uniqueCompanies.length})</option>
              {uniqueCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Semáforo de Riesgo</label>
            <select
              value={filters.risk}
              onChange={(e) => setFilters({ ...filters, risk: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="verde">🟢 Al Día (Verde)</option>
              <option value="amarillo">🟡 Advertencia (Amarillo)</option>
              <option value="rojo">🔴 Crítico (Rojo)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo de IA</label>
            <select
              value={filters.aiType}
              onChange={(e) => setFilters({ ...filters, aiType: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500"
            >
              <option value="TODOS">Todos los Tipos</option>
              {allAiTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Complejidad Máxima: <span className="text-indigo-400 font-bold">{filters.maxComplexity}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={filters.maxComplexity}
              onChange={(e) => setFilters({ ...filters, maxComplexity: parseInt(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer mt-1"
            />
          </div>
        </div>
      </div>

      {/* Projects Matrix List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-outfit flex items-center space-x-2">
            <span>Matriz de Proyectos</span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {filteredProjects.length} de {projects.length}
            </span>
          </h2>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-medium">No se encontraron proyectos con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition-all group relative ${
                  project.riskLevel === 'rojo'
                    ? 'border-rose-900/60 shadow-lg shadow-rose-950/20'
                    : project.riskLevel === 'amarillo'
                    ? 'border-amber-900/60 shadow-lg shadow-amber-950/20'
                    : 'border-slate-800'
                }`}
              >
                {/* Warning Banner if Empty Fields >7 days */}
                {project.emptyFieldsWarning && (
                  <div className="bg-rose-950/90 border-b border-rose-800/80 text-rose-200 text-[11px] px-3 py-1.5 rounded-t-xl -mx-5 -mt-5 mb-2 flex items-center justify-between">
                    <span className="flex items-center space-x-1 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-rose-400" />
                      <span>🚨 Enlaces o Avances vacíos (&gt;7 días)</span>
                    </span>
                  </div>
                )}

                <div>
                  {/* Card Header: Code & Risk */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 uppercase">
                        {project.code}
                      </span>
                      <p className="text-xs font-semibold text-slate-400 mt-1">{project.companyName}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      {getRiskBadge(project.riskLevel)}
                      <button
                        onClick={() => onEditProject(project)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                        title="Editar Proyecto"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar permanentemente el proyecto ${project.code}?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                        title="Eliminar Proyecto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Project Title */}
                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-300 transition">
                    {project.title}
                  </h3>

                  {/* Challenge description */}
                  {project.challengeDescription && (
                    <p className="text-xs text-slate-400 line-clamp-3 mt-2 leading-relaxed">
                      {project.challengeDescription}
                    </p>
                  )}

                  {/* Badges: AI Type & COP Impact */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-4">
                    {project.aiType.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        <Cpu className="inline h-3 w-3 mr-1 text-indigo-400" />
                        {t}
                      </span>
                    ))}

                    {project.copImpactAnnual && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                        <DollarSign className="inline h-3 w-3 text-emerald-400" />
                        Impacto: ${(project.copImpactAnnual / 1000000).toFixed(0)}M COP/año
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                      <span>Progreso del Proyecto</span>
                      <span className="text-indigo-300 font-bold">{project.progressStatus} ({project.progressPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          project.progressPct >= 80
                            ? 'bg-emerald-500'
                            : project.progressPct >= 40
                            ? 'bg-indigo-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${project.progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Quick Interest Links Status */}
                  <div className="flex items-center gap-2 mt-4 text-[11px] pt-3 border-t border-slate-800/80">
                    {project.whatsappUrl ? (
                      <a
                        href={project.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/50"
                        title="Abrir grupo de WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    ) : (
                      <span className="text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">Sin Wapp</span>
                    )}

                    {project.teamsMeetingUrl ? (
                      <a
                        href={project.teamsMeetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded border border-indigo-800/50"
                        title="Reunión de MS Teams"
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>Teams</span>
                      </a>
                    ) : (
                      <span className="text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">Sin Teams</span>
                    )}

                    {project.githubUrl ? (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-purple-400 hover:text-purple-300 bg-purple-950/40 px-2 py-1 rounded border border-purple-800/50"
                        title="Repositorio GitHub"
                      >
                        <Github className="h-3.5 w-3.5" />
                        <span>GitHub</span>
                      </a>
                    ) : (
                      <span className="text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">Sin GitHub</span>
                    )}
                  </div>

                  {/* Assigned Students */}
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                      <span>Estudiantes ICESI ({project.assignedStudents.length})</span>
                      <span className="text-[10px] text-slate-500">Mín: {project.minStudents} | Máx: {project.maxStudents}</span>
                    </p>
                    {project.assignedStudents.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {project.assignedStudents.map((s) => (
                          <span key={s.id} className="text-[10px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-400/90 italic mt-1">Sin estudiantes asignados aún.</p>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onOpenApplicationsModal(project)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 border border-slate-700 transition"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Postulaciones</span>
                    </button>

                    <button
                      onClick={() => onOpenChat(project)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-semibold flex items-center justify-center space-x-1 border border-indigo-800/80 transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Chat Híbrido</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectProject(project)}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
                  >
                    <span>Gestionar Proyecto / Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
