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
  Cpu,
  DollarSign,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Send
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
  onBackToDashboard
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
      status: 'abierta'
    });
    setLocalAlerts([createdAlert, ...localAlerts]);
    setNewAlertTitle('');
    setNewAlertDesc('');
    setNewAlertResources('');
    alert('Alerta enviada al Monitor con éxito.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Back Navigation for Monitor */}
      {isSuperuser && onBackToDashboard && (
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Dashboard de Proyectos</span>
        </button>
      )}

      {/* Main Project Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {project.code}
              </span>
              <span className="text-xs font-semibold text-slate-400">{project.companyName}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  project.riskLevel === 'verde'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : project.riskLevel === 'amarillo'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                }`}
              >
                ESTADO: {project.riskLevel.toUpperCase()}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold text-white font-outfit">{project.title}</h2>
            <p className="text-xs text-slate-300 mt-2 max-w-3xl leading-relaxed">{project.challengeDescription}</p>
          </div>

          {/* Action Buttons: Edit links & Upload Transcript */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenEditLinksModal}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
            >
              <Edit3 className="h-4 w-4 text-indigo-400" />
              <span>Editar Enlaces</span>
            </button>

            <button
              onClick={onOpenTranscriptModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 transition shadow-lg shadow-indigo-600/20"
            >
              <Upload className="h-4 w-4" />
              <span>Subir Transcripción MS Teams</span>
            </button>
          </div>
        </div>

        {/* Empty Fields Warning (>7 days) Banner */}
        {project.emptyFieldsWarning && (
          <div className="bg-rose-950/80 border border-rose-800 p-4 rounded-xl flex items-start space-x-3 text-rose-200 text-xs">
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ Alerta de Campos Incompletos (&gt;7 días sin actualizar):</p>
              <p className="mt-0.5 text-rose-300/90">
                Tu proyecto tiene enlaces clave (reunión de Teams, GitHub o acta semanal) vacíos o sin actividad reciente. Por favor actualízalos usando el botón "Editar Enlaces" para evitar llamadas de atención.
              </p>
            </div>
          </div>
        )}

        {/* Interest Links Desk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
          {/* WhatsApp */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Grupo WhatsApp</p>
                {project.whatsappUrl ? (
                  <a href={project.whatsappUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 hover:underline font-bold flex items-center space-x-1">
                    <span>Abrir Chat Wapp</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-rose-400 italic">No registrado</p>
                )}
              </div>
            </div>
          </div>

          {/* Teams Meeting Link */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Video className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Reunión MS Teams</p>
                {project.teamsMeetingUrl ? (
                  <a href={project.teamsMeetingUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:underline font-bold flex items-center space-x-1">
                    <span>Unirse a Llamada</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-amber-400 italic">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>

          {/* GitHub Repo */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Github className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Repositorio GitHub</p>
                {project.githubUrl ? (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:underline font-bold flex items-center space-x-1">
                    <span>Ver Código</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-amber-400 italic">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>

          {/* Google Drive Folder */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Folder className="h-5 w-5 text-sky-400" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Carpeta Google Drive</p>
                {project.driveFolderUrl ? (
                  <a href={project.driveFolderUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-300 hover:underline font-bold flex items-center space-x-1">
                    <span>Ver Carpeta</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-amber-400 italic">Pendiente por cargar</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Team & Organization Contacts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-800">
          <div>
            <span className="font-semibold text-slate-400">Equipo de Estudiantes ICESI:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {project.assignedStudents.map((s) => (
                <span key={s.id} className="bg-slate-950 text-slate-200 px-2.5 py-1 rounded border border-slate-800">
                  {s.name} ({s.email})
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-400">Tutores de la Empresa ({project.companyName}):</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {project.contacts.map((c, i) => (
                <span key={i} className="bg-slate-950 text-indigo-300 px-2.5 py-1 rounded border border-indigo-900/60">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('actas')}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'actas'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Actas de Reunión ({minutes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'chat'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Chat Híbrido (IA + Monitor)</span>
        </button>

        <button
          onClick={() => setActiveTab('alertas')}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'alertas'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
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
            <h3 className="text-base font-bold text-white font-outfit">Historial de Actas y Reuniones Procesadas</h3>
            <button
              onClick={onOpenTranscriptModal}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Acta desde Teams</span>
            </button>
          </div>

          {minutes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <FileText className="h-10 w-10 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-medium">Aún no se han cargado actas para este proyecto.</p>
              <button
                onClick={onOpenTranscriptModal}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold"
              >
                Subir primera transcripción de Teams
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {minutes.map((m) => (
                <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                        {m.meetingDate}
                      </span>
                      <h4 className="text-base font-bold text-slate-100 mt-1">{m.title}</h4>
                    </div>

                    {isSuperuser && (
                      <button
                        onClick={() => onOpenReassignMinuteModal(m.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800 font-medium"
                        title="Reasignar o eliminar esta acta de reunión"
                      >
                        Reasignar Acta
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="font-semibold text-indigo-300">Resumen Ejecutivo: </span>
                    {m.summary}
                  </p>

                  {/* Decisions & Commitments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <p className="font-bold text-slate-200 mb-1">Decisiones Tomadas:</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        {m.decisions.map((d, idx) => (
                          <li key={idx}>{d.decision}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <p className="font-bold text-slate-200 mb-1">Compromisos y Responsables:</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        {m.commitments.map((c, idx) => (
                          <li key={idx}>
                            <span className="text-slate-200 font-medium">{c.task}</span> - {c.responsible}
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white font-outfit">Reportar Inconveniente o Solicitar Recursos</h3>
            <p className="text-xs text-slate-400 mt-1">
              Si tu grupo no ha logrado contactar a la empresa, requiere licencias/GPU o tiene un bloqueo técnico, envía un reporte directo al Monitor.
            </p>
          </div>

          <form onSubmit={handleCreateAlert} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Alerta / Inconveniente</label>
              <input
                type="text"
                placeholder="Ej. Sin respuesta de la empresa tras 3 solicitudes de reunión"
                value={newAlertTitle}
                onChange={(e) => setNewAlertTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción del Problema</label>
              <textarea
                rows={3}
                placeholder="Explica qué ha sucedido y qué solución intentaron..."
                value={newAlertDesc}
                onChange={(e) => setNewAlertDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-indigo-500"
                required
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Recursos Necesarios (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. Credenciales de la BD, API Key de OpenAI, Mediación con el profesor"
                value={newAlertResources}
                onChange={(e) => setNewAlertResources(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-2 transition shadow-lg shadow-rose-600/20"
            >
              <Send className="h-4 w-4" />
              <span>Enviar Alerta al Monitor</span>
            </button>
          </form>

          {localAlerts.length > 0 && (
            <div className="pt-6 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300">Alertas Reportadas por tu Equipo:</h4>
              {localAlerts.map((a) => (
                <div key={a.id} className="bg-slate-950 border border-rose-900/60 p-4 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-300">{a.title}</span>
                    <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-slate-400">{a.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
