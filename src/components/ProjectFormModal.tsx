import React, { useState } from 'react';
import { Project, RiskLevel } from '../types';
import { X, Save, Plus, Cpu, DollarSign, Building } from 'lucide-react';

interface ProjectFormModalProps {
  projectToEdit?: Project | null;
  onClose: () => void;
  onSave: (project: Project) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  projectToEdit,
  onClose,
  onSave
}) => {
  const isEditing = !!projectToEdit;

  const [code, setCode] = useState(projectToEdit?.code || '');
  const [companyName, setCompanyName] = useState(projectToEdit?.companyName || '');
  const [title, setTitle] = useState(projectToEdit?.title || '');
  const [challengeDescription, setChallengeDescription] = useState(projectToEdit?.challengeDescription || '');
  const [progressStatus, setProgressStatus] = useState(projectToEdit?.progressStatus || 'En Progreso');
  const [progressPct, setProgressPct] = useState<number>(projectToEdit?.progressPct ?? 0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(projectToEdit?.riskLevel || 'verde');
  const [complexityRating, setComplexityRating] = useState<number>(projectToEdit?.complexityRating ?? 5);
  const [impactRating, setImpactRating] = useState<number>(projectToEdit?.impactRating ?? 8);
  const [aiTypeInput, setAiTypeInput] = useState<string>(projectToEdit?.aiType.join(', ') || 'IA Generativa');
  const [copImpactAnnual, setCopImpactAnnual] = useState<string>(projectToEdit?.copImpactAnnual ? String(projectToEdit.copImpactAnnual) : '');
  const [whatsappUrl, setWhatsappUrl] = useState(projectToEdit?.whatsappUrl || '');
  const [teamsMeetingUrl, setTeamsMeetingUrl] = useState(projectToEdit?.teamsMeetingUrl || '');
  const [githubUrl, setGithubUrl] = useState(projectToEdit?.githubUrl || '');
  const [driveFolderUrl, setDriveFolderUrl] = useState(projectToEdit?.driveFolderUrl || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !companyName.trim()) {
      alert('El Título del Proyecto y la Empresa u Organización son obligatorios.');
      return;
    }

    const aiTypeArray = aiTypeInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const projectData: Project = {
      id: projectToEdit?.id || 'proj-' + Date.now(),
      code: code.trim() || `PROJ_${Date.now().toString().slice(-4)}`,
      companyName: companyName.trim(),
      title: title.trim(),
      challengeDescription: challengeDescription.trim() || undefined,
      progressStatus: progressStatus.trim() || 'En Progreso',
      progressPct: Number(progressPct) || 0,
      riskLevel,
      minStudents: projectToEdit?.minStudents ?? 2,
      maxStudents: projectToEdit?.maxStudents ?? 5,
      contacts: projectToEdit?.contacts || [],
      assignedStudents: projectToEdit?.assignedStudents || [],
      aiType: aiTypeArray.length > 0 ? aiTypeArray : ['IA'],
      copImpactAnnual: copImpactAnnual ? Number(copImpactAnnual) : undefined,
      impactRating: Number(impactRating) || 8,
      complexityRating: Number(complexityRating) || 5,
      whatsappUrl: whatsappUrl.trim() || undefined,
      teamsMeetingUrl: teamsMeetingUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      driveFolderUrl: driveFolderUrl.trim() || undefined,
      lastActivityAt: new Date().toISOString()
    };

    onSave(projectData);
    alert(isEditing ? '¡Proyecto actualizado!' : '¡Nuevo proyecto creado con éxito!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              {isEditing ? 'EDITAR PROYECTO' : 'CREAR NUEVO PROYECTO'}
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">
              {isEditing ? `Editar ${projectToEdit?.code}` : 'Agregar Proyecto al Curso'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Empresa / Organización <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Coomeva CEM, INSIGHT PMO, Bancoomeva..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Código / Identificador de Grupo (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. 3_CEM, 6_PMO, 16_WinBack..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Título del Proyecto / Reto <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Clasificación de solicitudes de servicio sobre línea de emergencias"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Descripción del Reto (Opcional)</label>
            <textarea
              rows={3}
              placeholder="Detalla el problema a resolver, metodología o requerimientos clave..."
              value={challengeDescription}
              onChange={(e) => setChallengeDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:border-indigo-500"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Estado de Progreso</label>
              <input
                type="text"
                placeholder="Ej. Terminado, 80%, En desarrollo..."
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">% de Avance (0 - 100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progressPct}
                onChange={(e) => setProgressPct(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nivel de Riesgo (Semáforo)</label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              >
                <option value="verde">🟢 Al Día (Verde)</option>
                <option value="amarillo">🟡 Advertencia (Amarillo)</option>
                <option value="rojo">🔴 Crítico (Rojo)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Tipo de IA (Separados por coma)</label>
              <input
                type="text"
                placeholder="Ej. IA Generativa, Clasificación, Agentes"
                value={aiTypeInput}
                onChange={(e) => setAiTypeInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Complejidad (1 a 10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={complexityRating}
                onChange={(e) => setComplexityRating(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Impacto Estimado COP/Año (Opcional)</label>
              <input
                type="number"
                placeholder="Ej. 280000000"
                value={copImpactAnnual}
                onChange={(e) => setCopImpactAnnual(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Enlace WhatsApp (Opcional)</label>
              <input
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Enlace Reunión MS Teams (Opcional)</label>
              <input
                type="url"
                placeholder="https://teams.microsoft.com/..."
                value={teamsMeetingUrl}
                onChange={(e) => setTeamsMeetingUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/20 mt-4"
          >
            <Save className="h-4 w-4" />
            <span>{isEditing ? 'Guardar Cambios del Proyecto' : 'Crear Proyecto'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
