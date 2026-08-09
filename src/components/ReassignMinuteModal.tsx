import React, { useState } from 'react';
import { Project, MeetingMinute } from '../types';
import { X, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

interface ReassignMinuteModalProps {
  minuteId: string;
  projects: Project[];
  onClose: () => void;
  onReassign: (minuteId: string, targetProjectId: string) => void;
  onDelete: (minuteId: string) => void;
}

export const ReassignMinuteModal: React.FC<ReassignMinuteModalProps> = ({
  minuteId,
  projects,
  onClose,
  onReassign,
  onDelete
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  const handleConfirmMove = () => {
    if (!selectedProjectId) return;
    onReassign(minuteId, selectedProjectId);
    alert('Acta reasignada con éxito al proyecto de destino.');
    onClose();
  };

  const handleConfirmDelete = () => {
    if (confirm('¿Estás seguro de que deseas eliminar permanentemente esta acta?')) {
      onDelete(minuteId);
      alert('Acta eliminada.');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              PERMISO EXCLUSIVO SUPERUSER
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Reasignar o Eliminar Acta</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
            <p className="text-slate-400">Si un estudiante subió un archivo o acta en el proyecto equivocado, puedes trasladarla a otro grupo o eliminarla.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Seleccionar Proyecto de Destino:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] - {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleConfirmMove}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Mover Acta al Proyecto Seleccionado</span>
            </button>

            <button
              onClick={handleConfirmDelete}
              className="w-full py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <Trash2 className="h-4 w-4" />
              <span>Eliminar Acta Definativamente</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
