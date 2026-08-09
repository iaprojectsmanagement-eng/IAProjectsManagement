import React, { useState } from 'react';
import { Project, Application } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, Cpu, DollarSign, UserPlus, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface ProjectCatalogProps {
  projects: Project[];
  applications: Application[];
  onApply: (projectId: string) => void;
}

export const ProjectCatalog: React.FC<ProjectCatalogProps> = ({
  projects,
  applications,
  onApply
}) => {
  const { userName, userEmail, studentCode } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('TODAS');
  const [selectedAiType, setSelectedAiType] = useState('TODOS');
  const [maxComplexity, setMaxComplexity] = useState(10);

  const uniqueCompanies = Array.from(new Set(projects.map((p) => p.companyName)));
  const allAiTypes = Array.from(new Set(projects.flatMap((p) => p.aiType)));

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.code.toLowerCase().includes(term) ||
      p.title.toLowerCase().includes(term) ||
      p.companyName.toLowerCase().includes(term) ||
      (p.challengeDescription ?? '').toLowerCase().includes(term);

    const matchesCompany = selectedCompany === 'TODAS' || p.companyName === selectedCompany;
    const matchesAi = selectedAiType === 'TODOS' || p.aiType.includes(selectedAiType);
    const matchesComplexity = p.complexityRating <= maxComplexity;

    return matchesSearch && matchesCompany && matchesAi && matchesComplexity;
  });

  const getStudentAppForProject = (projectId: string) => {
    return applications.find((a) => a.projectId === projectId && a.studentEmail === userEmail);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Banner Pre-Asignación */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-800/60 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>CATÁLOGO DE PROYECTOS IA DEL CURSO</span>
            </span>
            <h2 className="text-2xl font-extrabold text-white font-outfit">
              ¡Bienvenido, {userName}! Selecciona tu Proyecto
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Explora los 18 retos reales de las 3 empresas de Coomeva. Puedes filtrar por complejidad, impacto financiero y tipo de IA. Al postularte, el Monitor revisará tu solicitud para confirmarla.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-xs space-y-1">
            <p className="text-slate-400 font-medium">Estudiante:</p>
            <p className="font-bold text-slate-100">{userName}</p>
            <p className="text-indigo-400 font-mono">Código: {studentCode || '2201001'}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar reto por título, tecnología o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <Filter className="h-4 w-4 text-indigo-400" />
            <span>Filtros de Búsqueda</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Empresa / Organización</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500"
            >
              <option value="TODAS">Todas las Empresas</option>
              {uniqueCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo de IA</label>
            <select
              value={selectedAiType}
              onChange={(e) => setSelectedAiType(e.target.value)}
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
              Complejidad Máxima: <span className="text-indigo-400 font-bold">{maxComplexity}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={maxComplexity}
              onChange={(e) => setMaxComplexity(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer mt-1"
            />
          </div>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const app = getStudentAppForProject(project.id);
          const isFull = project.assignedStudents.length >= project.maxStudents;

          return (
            <div
              key={project.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-indigo-500/60 transition shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                    {project.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{project.companyName}</span>
                </div>

                <h3 className="text-base font-bold text-slate-100 line-clamp-2 leading-snug">{project.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-3 mt-2">{project.challengeDescription}</p>

                {/* Badges & Metrics */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {project.aiType.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      <Cpu className="inline h-3 w-3 mr-1 text-indigo-400" />
                      {t}
                    </span>
                  ))}

                  {project.copImpactAnnual && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      <DollarSign className="inline h-3 w-3 text-emerald-400" />
                      Impacto: ${(project.copImpactAnnual / 1000000).toFixed(0)}M COP/año
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Complejidad:</span>
                    <span className="text-indigo-400 font-bold">{project.complexityRating}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cupos Ocupados:</span>
                    <span className="text-slate-200 font-medium">
                      {project.assignedStudents.length} / {project.maxStudents} integrantes
                    </span>
                  </div>
                </div>
              </div>

              {/* Application Action Button */}
              <div>
                {app ? (
                  app.status === 'aceptada' ? (
                    <button disabled className="w-full py-2 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center justify-center space-x-1.5 cursor-not-allowed">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>¡Asignado a este Proyecto!</span>
                    </button>
                  ) : app.status === 'rechazada' ? (
                    <button disabled className="w-full py-2 rounded-xl bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold flex items-center justify-center space-x-1.5 cursor-not-allowed">
                      <span>Postulación Rechazada</span>
                    </button>
                  ) : (
                    <button disabled className="w-full py-2 rounded-xl bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold flex items-center justify-center space-x-1.5 cursor-not-allowed">
                      <Clock className="h-4 w-4 text-amber-400 animate-spin" />
                      <span>Postulación Pendiente de Aprobación</span>
                    </button>
                  )
                ) : isFull ? (
                  <button disabled className="w-full py-2 rounded-xl bg-slate-800 text-slate-500 border border-slate-700 text-xs font-bold cursor-not-allowed">
                    Cupos Llenos
                  </button>
                ) : (
                  <button
                    onClick={() => onApply(project.id)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Postularme a este Proyecto</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
