import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, Application } from '../types';
import { X, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';

interface ApplicationManagementModalProps {
  project: Project;
  applications: Application[];
  onClose: () => void;
  onAccept: (applicationId: string) => void;
  onReject: (applicationId: string) => void;
}

export const ApplicationManagementModal: React.FC<ApplicationManagementModalProps> = ({
  project,
  applications,
  onClose,
  onAccept,
  onReject,
}) => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const projectApps = applications.filter((a) => a.projectId === project.id);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              {project.code}
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Gestión de Postulaciones</h3>
            <p className="text-xs text-slate-500">{project.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current Team Status */}
        <div className="space-y-2 border border-slate-200 bg-slate-50/70 p-4 text-xs">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Estudiantes Actualmente Asignados ({project.assignedStudents.length}):</span>
            <span className="text-[#0D9488]">
              Mín: {project.minStudents} | Máx: {project.maxStudents}
            </span>
          </div>

          {project.assignedStudents.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5 text-slate-600">
              {project.assignedStudents.map((s) => (
                <li key={s.id}>
                  {s.name} ({s.email})
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-amber-700">No hay estudiantes asignados en este momento.</p>
          )}
        </div>

        {/* Pending Applications List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700">Solicitudes de Postulación Recibidas ({projectApps.length}):</h4>

          {projectApps.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-slate-400">No hay postulaciones registradas para este proyecto.</p>
          ) : (
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {projectApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between border border-slate-200 bg-white p-3.5 text-xs shadow-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">{app.studentName}</p>
                    <p className="text-[11px] text-slate-400">{app.studentEmail}</p>
                    <span
                      className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-bold ${
                        app.status === 'aceptada'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : app.status === 'rechazada'
                            ? 'border border-rose-200 bg-rose-50 text-rose-800'
                            : 'border border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {app.status.toUpperCase()}
                    </span>
                  </div>

                  {app.status === 'pendiente' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onAccept(app.id)}
                        className="flex items-center space-x-1 bg-emerald-600 px-3 py-1.5 font-bold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aceptar</span>
                      </button>

                      <button
                        onClick={() => onReject(app.id)}
                        className="flex items-center space-x-1 border border-rose-200 bg-rose-50 px-3 py-1.5 font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start space-x-2 border border-teal-200 bg-teal-50/70 p-3 text-[11px] text-[#0D9488]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
          <p>
            <strong>Regla de Unicidad:</strong> Al aceptar a un estudiante, sus postulaciones a otros proyectos se eliminan automáticamente para asegurar que pertenezca a 1 solo equipo.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};
