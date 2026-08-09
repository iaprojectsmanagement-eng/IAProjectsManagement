import React, { useState } from 'react';
import { Project } from '../types';
import { X, Save, Link2, MessageCircle, Video, Github, Folder } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: Project = {
      ...project,
      whatsappUrl,
      teamsMeetingUrl,
      githubUrl,
      driveFolderUrl,
      emptyFieldsWarning: !(whatsappUrl && teamsMeetingUrl && githubUrl && driveFolderUrl),
      lastActivityAt: new Date().toISOString()
    };

    onSaveLinks(updated);
    alert('Enlaces de interés del proyecto actualizados.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              {project.code}
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Editar Enlaces de Interés</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              <span>Enlace de Grupo de WhatsApp:</span>
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappUrl}
              onChange={(e) => setWhatsappUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
              <Video className="h-4 w-4 text-indigo-400" />
              <span>Enlace a Reunión Recurrente de MS Teams:</span>
            </label>
            <input
              type="url"
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              value={teamsMeetingUrl}
              onChange={(e) => setTeamsMeetingUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
              <Github className="h-4 w-4 text-purple-400" />
              <span>Enlace a Repositorio de GitHub:</span>
            </label>
            <input
              type="url"
              placeholder="https://github.com/usuario/proyecto-ia"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
              <Folder className="h-4 w-4 text-sky-400" />
              <span>Enlace a Carpeta Consolidada Google Drive / OneDrive:</span>
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/20"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Enlaces de Proyecto</span>
          </button>
        </form>
      </div>
    </div>
  );
};
