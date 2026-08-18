import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, RiskLevel } from '../types';
import { X, Save } from 'lucide-react';

interface ProjectFormModalProps {
  projectToEdit?: Project | null;
  onClose: () => void;
  onSave: (project: Project) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  projectToEdit,
  onClose,
  onSave,
}) => {
  const isEditing = !!projectToEdit;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
  const [copImpactAnnual, setCopImpactAnnual] = useState<string>(
    projectToEdit?.copImpactAnnual ? String(projectToEdit.copImpactAnnual) : ''
  );
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
      lastActivityAt: new Date().toISOString(),
    };

    onSave(projectData);
    alert(isEditing ? '¡Proyecto actualizado!' : '¡Nuevo proyecto creado con éxito!');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              {isEditing ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'}
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">
              {isEditing ? `Editar ${projectToEdit?.code}` : 'Agregar Proyecto al Curso'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Empresa / Organización <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Coomeva CEM, INSIGHT PMO, Bancoomeva..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Código / Identificador de Grupo (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. 3_CEM, 6_PMO, 16_WinBack..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 font-mono text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Título del Proyecto / Reto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Clasificación de solicitudes de servicio sobre línea de emergencias"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Descripción del Reto (Opcional)</label>
            <textarea
              rows={3}
              placeholder="Detalla el problema a resolver, metodología o requerimientos clave..."
              value={challengeDescription}
              onChange={(e) => setChallengeDescription(e.target.value)}
              className="w-full border border-slate-200 bg-white p-3 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Estado de Progreso</label>
              <input
                type="text"
                placeholder="Ej. Terminado, 80%, En desarrollo..."
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">% de Avance (0 - 100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progressPct}
                onChange={(e) => setProgressPct(Number(e.target.value))}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Nivel de Riesgo (Semáforo)</label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              >
                <option value="verde">🟢 Al Día (Verde)</option>
                <option value="amarillo">🟡 Advertencia (Amarillo)</option>
                <option value="rojo">🔴 Crítico (Rojo)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Tipo de IA (Separados por coma)</label>
              <input
                type="text"
                placeholder="Ej. IA Generativa, Clasificación, Agentes"
                value={aiTypeInput}
                onChange={(e) => setAiTypeInput(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Complejidad (1 a 10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={complexityRating}
                onChange={(e) => setComplexityRating(Number(e.target.value))}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Impacto COP/Año (Opcional)</label>
              <input
                type="number"
                placeholder="Ej. 280000000"
                value={copImpactAnnual}
                onChange={(e) => setCopImpactAnnual(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 font-mono text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Enlace WhatsApp (Opcional)</label>
              <input
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Enlace Reunión MS Teams (Opcional)</label>
              <input
                type="url"
                placeholder="https://teams.microsoft.com/..."
                value={teamsMeetingUrl}
                onChange={(e) => setTeamsMeetingUrl(e.target.value)}
                className="w-full border border-slate-200 bg-white px-3.5 py-2 text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 bg-[#0D9488] px-5 py-2 font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <Save className="h-4 w-4" />
              <span>{isEditing ? 'Guardar Cambios' : 'Crear Proyecto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
