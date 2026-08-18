import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { X, RefreshCw, Trash2 } from 'lucide-react';

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
  onDelete,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-md space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Permiso de Coordinación
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Reasignar o Eliminar Acta</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <p className="text-slate-600">
              Si un estudiante subió un archivo o acta en el proyecto equivocado, puedes trasladarla a otro grupo o eliminarla.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Seleccionar Proyecto de Destino:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
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
              className="flex w-full items-center justify-center space-x-1.5 bg-[#0D9488] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Mover Acta al Proyecto Seleccionado</span>
            </button>

            <button
              onClick={handleConfirmDelete}
              className="flex w-full items-center justify-center space-x-1.5 border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
              <span>Eliminar Acta Definitivamente</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
