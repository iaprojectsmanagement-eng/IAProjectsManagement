import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { X, Save, MessageCircle, Video, Github, Folder } from 'lucide-react';

interface EditLinksModalProps {
  project: Project;
  onClose: () => void;
  onSaveLinks: (updatedProject: Project) => void;
}

export const EditLinksModal: React.FC<EditLinksModalProps> = ({ project, onClose, onSaveLinks }) => {
  const [whatsappUrl, setWhatsappUrl] = useState(project.whatsappUrl || '');
  const [teamsMeetingUrl, setTeamsMeetingUrl] = useState(project.teamsMeetingUrl || '');
  const [githubUrl, setGithubUrl] = useState(project.githubUrl || '');
  const [driveFolderUrl, setDriveFolderUrl] = useState(project.driveFolderUrl || '');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: Project = {
      ...project,
      whatsappUrl,
      teamsMeetingUrl,
      githubUrl,
      driveFolderUrl,
      emptyFieldsWarning: !(whatsappUrl && teamsMeetingUrl && githubUrl && driveFolderUrl),
      lastActivityAt: new Date().toISOString(),
    };

    onSaveLinks(updated);
    alert('Enlaces de interés del proyecto actualizados.');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              {project.code}
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Editar Enlaces de Interés</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span>Enlace de Grupo de WhatsApp:</span>
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappUrl}
              onChange={(e) => setWhatsappUrl(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
              <Video className="h-4 w-4 text-teal-600" />
              <span>Enlace a Reunión Recurrente de MS Teams:</span>
            </label>
            <input
              type="url"
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              value={teamsMeetingUrl}
              onChange={(e) => setTeamsMeetingUrl(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
              <Github className="h-4 w-4 text-slate-700" />
              <span>Repositorio en GitHub:</span>
            </label>
            <input
              type="url"
              placeholder="https://github.com/empresa/repo-ia"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
              <Folder className="h-4 w-4 text-sky-600" />
              <span>Carpeta de Archivos en Google Drive:</span>
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 bg-[#0D9488] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <Save className="h-4 w-4" />
              <span>Guardar Enlaces</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
