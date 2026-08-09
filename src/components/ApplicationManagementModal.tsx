import React from 'react';
import { Project, Application } from '../types';
import { X, CheckCircle2, XCircle, UserPlus, ShieldAlert } from 'lucide-react';

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
  onReject
}) => {
  const projectApps = applications.filter((a) => a.projectId === project.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              {project.code}
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Gestión de Postulaciones</h3>
            <p className="text-xs text-slate-400">{project.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Team Status */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between font-semibold text-slate-300">
            <span>Estudiantes Actualmente Asignados ({project.assignedStudents.length}):</span>
            <span className="text-indigo-400">
              Mín: {project.minStudents} | Máx: {project.maxStudents}
            </span>
          </div>

          {project.assignedStudents.length > 0 ? (
            <ul className="list-disc list-inside text-slate-400">
              {project.assignedStudents.map((s) => (
                <li key={s.id}>
                  {s.name} ({s.email})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-amber-400 italic">No hay estudiantes asignados en este momento.</p>
          )}
        </div>

        {/* Pending Applications List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-200">Solicitudes de Postulación Recibidas ({projectApps.length}):</h4>

          {projectApps.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">No hay postulaciones registradas para este proyecto.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {projectApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-100">{app.studentName}</p>
                    <p className="text-slate-400 text-[11px]">{app.studentEmail}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                        app.status === 'aceptada'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : app.status === 'rechazada'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {app.status.toUpperCase()}
                    </span>
                  </div>

                  {app.status === 'pendiente' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onAccept(app.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-1 shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aceptar</span>
                      </button>

                      <button
                        onClick={() => onReject(app.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold flex items-center space-x-1"
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

        <div className="bg-indigo-950/60 border border-indigo-800/60 p-3 rounded-xl text-[11px] text-indigo-300 flex items-start space-x-2">
          <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            <strong>Regla de Unicidad:</strong> Al aceptar a un estudiante, sus postulaciones a otros proyectos se eliminan automáticamente para asegurar que pertenezca a 1 solo equipo.
          </p>
        </div>
      </div>
    </div>
  );
};
