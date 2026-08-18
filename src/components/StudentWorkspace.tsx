import React, { useState } from 'react';
import { Project, MeetingMinute, AlertItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  MessageCircle,
  Video,
  Github,
  Folder,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Plus,
  ExternalLink,
  Edit3,
  ShieldAlert,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { HybridChat } from './HybridChat';

interface StudentWorkspaceProps {
  project: Project;
  minutes: MeetingMinute[];
  onOpenTranscriptModal: () => void;
  onOpenEditLinksModal: () => void;
  onOpenReassignMinuteModal: (minuteId: string) => void;
  onCreateAlert: (alert: Omit<AlertItem, 'id' | 'createdAt'>) => AlertItem;
  onBackToDashboard?: () => void;
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  project,
  minutes,
  onOpenTranscriptModal,
  onOpenEditLinksModal,
  onOpenReassignMinuteModal,
  onCreateAlert,
  onBackToDashboard,
}) => {
  const { role } = useAuth();
  const isSuperuser = role === 'superuser';

  const [activeTab, setActiveTab] = useState<'actas' | 'entregables' | 'chat' | 'alertas'>('actas');
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertDesc, setNewAlertDesc] = useState('');
  const [newAlertResources, setNewAlertResources] = useState('');
  const [localAlerts, setLocalAlerts] = useState<AlertItem[]>([]);

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTitle || !newAlertDesc) return;

    const createdAlert = onCreateAlert({
      projectId: project.id,
      projectCode: project.code,
      reportedBy: 'Estudiante ICESI',
      title: newAlertTitle,
      description: newAlertDesc,
      requestedResources: newAlertResources,
      severity: 'media',
      status: 'abierta',
    });
    setLocalAlerts([createdAlert, ...localAlerts]);
    setNewAlertTitle('');
    setNewAlertDesc('');
    setNewAlertResources('');
    alert('Alerta enviada al Monitor con éxito.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Back Navigation for Monitor */}
      {isSuperuser && onBackToDashboard && (
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center space-x-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Dashboard de Proyectos</span>
        </button>
      )}

      {/* Main Project Header Banner */}
      <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center space-x-2">
              <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-[#0D9488]">
                {project.code}
              </span>
              <span className="text-xs font-semibold text-slate-400">{project.companyName}</span>
              <span
                className={`status-marker status-marker--${
                  project.riskLevel === 'verde' ? 'green' : project.riskLevel === 'amarillo' ? 'amber' : 'red'
                }`}
              >
                {project.riskLevel === 'verde' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : project.riskLevel === 'amarillo' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                ESTADO: {project.riskLevel.toUpperCase()}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold text-[#0E2C40]">{project.title}</h2>
            {project.challengeDescription && (
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">{project.challengeDescription}</p>
            )}
          </div>

          {/* Action Buttons: Edit links & Upload Transcript */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenEditLinksModal}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Edit3 className="h-4 w-4 text-[#0D9488]" />
              <span>Editar Enlaces</span>
            </button>

            <button
              onClick={onOpenTranscriptModal}
              className="flex items-center space-x-2 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <Upload className="h-4 w-4" />
              <span>Subir Transcripción MS Teams</span>
            </button>
          </div>
        </div>

        {/* Empty Fields Warning (>7 days) Banner */}
        {project.emptyFieldsWarning && (
          <div className="flex items-start space-x-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-bold">⚠️ Alerta de Campos Incompletos (&gt;7 días sin actualizar):</p>
              <p className="mt-0.5 text-rose-700">
                Tu proyecto tiene enlaces clave (reunión de Teams, GitHub o acta semanal) vacíos o sin actividad reciente. Por favor actualízalos usando el botón "Editar Enlaces" para evitar llamadas de atención.
              </p>
            </div>
          </div>
        )}

        {/* Interest Links Desk */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 md:grid-cols-4">
          {/* WhatsApp */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center space-x-2.5">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Grupo WhatsApp</p>
                {project.whatsappUrl ? (
                  <a
                    href={project.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    <span>Abrir Chat Wapp</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs italic text-slate-400">No registrado</p>
                )}
              </div>
            </div>
          </div>

          {/* Teams Meeting Link */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center space-x-2.5">
              <Video className="h-5 w-5 text-teal-600" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Reunión MS Teams</p>
                {project.teamsMeetingUrl ? (
                  <a
                    href={project.teamsMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-xs font-bold text-teal-700 hover:underline"
                  >
                    <span>Unirse a Llamada</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs italic text-amber-600">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>

          {/* GitHub Repo */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center space-x-2.5">
              <Github className="h-5 w-5 text-slate-700" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Repositorio GitHub</p>
                {project.githubUrl ? (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-xs font-bold text-slate-800 hover:underline"
                  >
                    <span>Ver Código</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs italic text-amber-600">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>

          {/* Google Drive Folder */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center space-x-2.5">
              <Folder className="h-5 w-5 text-sky-600" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Carpeta Google Drive</p>
                {project.driveFolderUrl ? (
                  <a
                    href={project.driveFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-xs font-bold text-sky-700 hover:underline"
                  >
                    <span>Ver Carpeta</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs italic text-amber-600">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Team & Organization Contacts */}
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-3 text-xs md:grid-cols-2">
          <div>
            <span className="font-semibold text-slate-400">Equipo de Estudiantes ICESI:</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {project.assignedStudents.map((s) => (
                <span key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  {s.name} ({s.email})
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-400">Tutores de la Empresa ({project.companyName}):</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {project.contacts.map((c, i) => (
                <span key={i} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-800">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-4 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('actas')}
          className={`flex items-center space-x-2 border-b-2 pb-3 transition ${
            activeTab === 'actas'
              ? 'border-[#0D9488] text-[#0D9488]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Actas de Reunión ({minutes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 border-b-2 pb-3 transition ${
            activeTab === 'chat'
              ? 'border-[#0D9488] text-[#0D9488]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Chat Híbrido (IA + Monitor)</span>
        </button>

        <button
          onClick={() => setActiveTab('alertas')}
          className={`flex items-center space-x-2 border-b-2 pb-3 transition ${
            activeTab === 'alertas'
              ? 'border-[#0D9488] text-[#0D9488]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Reportar Alerta / Inconveniente</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'actas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0E2C40]">Historial de Actas y Reuniones Procesadas</h3>
            <button
              onClick={onOpenTranscriptModal}
              className="flex items-center space-x-1.5 rounded-xl bg-[#0D9488] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Acta desde Teams</span>
            </button>
          </div>

          {minutes.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-400" />
              <p className="font-medium text-slate-500">Aún no se han cargado actas para este proyecto.</p>
              <button
                onClick={onOpenTranscriptModal}
                className="text-xs font-semibold text-[#0D9488] underline hover:text-[#0F766E]"
              >
                Subir primera transcripción de Teams
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {minutes.map((m) => (
                <div key={m.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-[#0D9488]">
                        {m.meetingDate}
                      </span>
                      <h4 className="mt-1 text-base font-bold text-[#0E2C40]">{m.title}</h4>
                    </div>

                    {isSuperuser && (
                      <button
                        onClick={() => onOpenReassignMinuteModal(m.id)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                        title="Reasignar o eliminar esta acta de reunión"
                      >
                        Reasignar Acta
                      </button>
                    )}
                  </div>

                  <p className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">Resumen Ejecutivo: </span>
                    {m.summary}
                  </p>

                  {/* Decisions & Commitments */}
                  <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="mb-1 font-bold text-slate-700">Decisiones Tomadas:</p>
                      <ul className="list-inside list-disc space-y-1 text-slate-500">
                        {m.decisions.map((d, idx) => (
                          <li key={idx}>{d.decision}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="mb-1 font-bold text-slate-700">Compromisos y Responsables:</p>
                      <ul className="list-inside list-disc space-y-1 text-slate-500">
                        {m.commitments.map((c, idx) => (
                          <li key={idx}>
                            <span className="font-medium text-slate-700">{c.task}</span> - {c.responsible}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'chat' && <HybridChat project={project} />}

      {activeTab === 'alertas' && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-[#0E2C40]">Reportar Inconveniente o Solicitar Recursos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Si tu grupo no ha logrado contactar a la empresa, requiere licencias/GPU o tiene un bloqueo técnico, envía un reporte directo al Monitor.
            </p>
          </div>

          <form onSubmit={handleCreateAlert} className="max-w-2xl space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Título de la Alerta / Inconveniente</label>
              <input
                type="text"
                placeholder="Ej. Sin respuesta de la empresa tras 3 solicitudes de reunión"
                value={newAlertTitle}
                onChange={(e) => setNewAlertTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Descripción del Problema</label>
              <textarea
                rows={3}
                placeholder="Explica qué ha sucedido y qué solución intentaron..."
                value={newAlertDesc}
                onChange={(e) => setNewAlertDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                required
              ></textarea>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Recursos Necesarios (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. Credenciales de la BD, API Key de OpenAI, Mediación con el profesor"
                value={newAlertResources}
                onChange={(e) => setNewAlertResources(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <button
              type="submit"
              className="flex items-center space-x-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              <Send className="h-4 w-4" />
              <span>Enviar Alerta al Monitor</span>
            </button>
          </form>

          {localAlerts.length > 0 && (
            <div className="space-y-3 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-700">Alertas Reportadas por tu Equipo:</h4>
              {localAlerts.map((a) => (
                <div key={a.id} className="space-y-1 rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-800">{a.title}</span>
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-slate-600">{a.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
