import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { AppPage, AppShell } from './components/AppShell';
import { DocumentsView, IssuesView, MeetingsView, MonitorHome, PeopleView, ProjectDetail, ProjectsView, ReportsView, TasksView } from './components/FunctionalViews';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OperationsService } from './services/operationsService';
import { SyncService, SyncState } from './services/syncService';

const LoginScreenWithVisibility: React.FC<{ onSignIn: (email: string, password: string) => Promise<void> }> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            void onSignIn(email.trim(), password)
              .catch((caught) => {
                const message = caught instanceof Error ? caught.message : '';
                setError(
                  /invalid login credentials|invalid credentials/i.test(message)
                    ? 'Credenciales incorrectas. Verifica tu correo institucional y contraseña.'
                    : message || 'No fue posible iniciar sesión.'
                );
              })
              .finally(() => setBusy(false));
          }}
          className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#0D9488] to-[#0E2C40] text-base font-black text-white shadow-md shadow-teal-700/20">
              I
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Universidad Icesi</p>
              <h1 className="text-xl font-extrabold tracking-tight text-[#0E2C40]">Projects Management</h1>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h2 className="text-base font-bold text-slate-800">Iniciar sesión</h2>
            <p className="mt-1 text-xs text-slate-500">Accede con tu cuenta autorizada para coordinar o trabajar en proyectos de IA.</p>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-4">
            <label className="block text-xs font-bold text-slate-700">
              Correo institucional
              <div className="relative mt-1">
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ejemplo@correo.icesi.edu.co"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Contraseña
              <div className="relative mt-1">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          <button
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F766E] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="mt-5 text-center text-[11px] text-slate-400">
            Coordinación Académica de Proyectos IA · Universidad Icesi
          </p>
        </form>
      </div>
    </main>
  );
};

const Workspace: React.FC = () => {
  const { role, userId, userName, userEmail, assignedProjectId, switchRoleToggle, isAuthenticated, isLoading, isLocalDemo, signIn, logout } = useAuth();
  const isMonitor = role === 'superuser';
  const [page, setPage] = useState<AppPage>('inicio');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTab, setSelectedProjectTab] = useState<'resumen' | 'reuniones'>('resumen');
  const [revision, setRevision] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getState());
  const [dataReady, setDataReady] = useState(!SyncService.isRemoteMode());
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => SyncService.subscribe(setSyncState), []);
  useEffect(() => {
    if (!isAuthenticated) { setDataReady(false); return; }
    let active = true;
    const load = async () => {
      if (SyncService.isRemoteMode()) await SyncService.bootstrap();
      OperationsService.initialise();
      if (active) { setDataReady(true); refresh(); }
    };
    void load().catch(() => { if (active) setDataReady(false); });
    return () => { active = false; };
  }, [isAuthenticated, userEmail]);
  useEffect(() => {
    if (!isAuthenticated || !dataReady || !SyncService.isRemoteMode()) return;
    return SyncService.startRealtime(refresh);
  }, [isAuthenticated, dataReady, userEmail]);

  const projects = useMemo(() => OperationsService.getProjects(), [revision]);
  const studentProject = projects.find((project) => project.assignedStudents.some((student) => student.email.toLowerCase() === userEmail.toLowerCase()));
  const alertCount = OperationsService.getIssues(isMonitor ? undefined : studentProject?.id).filter((issue) => issue.status !== 'resuelta').length;
  const openProject = (id: string, target: 'resumen' | 'reuniones' = 'resumen') => { setSelectedProjectId(id); setSelectedProjectTab(target); setPage('proyectos'); };
  const shared = { projects, onChanged: refresh, onOpenProject: openProject };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC] text-sm font-semibold text-slate-500">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0D9488] border-t-transparent" />
          <span>Cargando sesión…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreenWithVisibility onSignIn={signIn} />;

  if (SyncService.isRemoteMode() && !dataReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC] p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <h1 className="text-lg font-bold text-[#0E2C40]">
            {syncState.status === 'error' ? 'No se pudieron cargar los datos' : 'Cargando espacio de trabajo…'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {syncState.error || 'Estamos aplicando tus permisos y preparando la información autorizada.'}
          </p>
          {syncState.status === 'error' && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setDataReady(false);
                  void SyncService.bootstrap().then(() => {
                    OperationsService.initialise();
                    setDataReady(true);
                    refresh();
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F766E]"
              >
                Reintentar
              </button>
              <button
                onClick={() => {
                  if (!window.confirm('Se descartarán solo los cambios que este navegador no logró sincronizar. Los datos ya guardados en la plataforma no se eliminarán. ¿Continuar?')) return;
                  SyncService.discardPendingChanges();
                  setDataReady(false);
                  void SyncService.bootstrap().then(() => {
                    OperationsService.initialise();
                    setDataReady(true);
                    refresh();
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Recuperar cambios pendientes
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  let content: React.ReactNode;
  if (!isMonitor && !studentProject) {
    const applications = OperationsService.getApplications().filter((application) => application.studentEmail.toLowerCase() === userEmail.toLowerCase());
    content = (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/40 p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
            Sin asignación activa
          </span>
          <h1 className="mt-3 text-2xl font-black text-[#0E2C40]">Todavía no tienes un proyecto asignado</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Puedes postularte a cualquiera de los proyectos con cupo disponible. Cuando el monitor o docente apruebe tu postulación, tendrás acceso a los entregables, tareas, reuniones y documentos de tu equipo.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Cuenta:</span> {userEmail}
            {assignedProjectId ? ` · ref: ${assignedProjectId}` : ''}
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#0E2C40]">Proyectos disponibles para postulación</h2>
            <p className="text-xs text-slate-500">Selecciona el reto en el que deseas participar durante este semestre.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const application = applications.find((item) => item.projectId === project.id);
              const assignedCount = project.assignedStudentsCount ?? project.assignedStudents.length;
              const full = assignedCount >= project.maxStudents;
              return (
                <section key={project.id} className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-extrabold text-teal-800">
                        {project.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{project.companyName}</span>
                    </div>
                    <h3 className="mt-2.5 text-base font-bold text-[#0E2C40]">{project.title}</h3>
                    {project.challengeDescription && (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">{project.challengeDescription}</p>
                    )}
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Cupos: <b className="text-slate-800">{assignedCount}/{project.maxStudents}</b>
                      </span>
                      {application ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          application.status === 'rechazada'
                            ? 'bg-rose-100 text-rose-700'
                            : application.status === 'aceptada'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {application.status}
                        </span>
                      ) : (
                        <button
                          disabled={full}
                          onClick={() => {
                            void (async () => {
                              try {
                                OperationsService.applyToProject(project.id, { id: userId, name: userName, email: userEmail });
                                await SyncService.flush();
                                refresh();
                              } catch (caught) {
                                window.alert(caught instanceof Error ? caught.message : 'No se pudo enviar la postulación.');
                              }
                            })();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          {full ? 'Sin cupos' : 'Postularme'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (!isMonitor && studentProject) {
    if (page === 'inicio') content = <ProjectDetail {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'tareas') content = <TasksView {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'agenda') content = <MeetingsView {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'incidencias') content = <IssuesView {...shared} projectId={studentProject.id} isStudent />;
    else content = <DocumentsView {...shared} projectId={studentProject.id} isMonitor={false} />;
  } else if (selectedProjectId) {
    content = <ProjectDetail {...shared} projectId={selectedProjectId} initialTab={selectedProjectTab} isMonitor onBack={() => setSelectedProjectId(null)} />;
  } else {
    switch (page) {
      case 'inicio': content = <MonitorHome {...shared} />; break;
      case 'proyectos': content = <ProjectsView {...shared} />; break;
      case 'agenda': content = <MeetingsView {...shared} />; break;
      case 'tareas': content = <TasksView {...shared} />; break;
      case 'incidencias': content = <IssuesView {...shared} />; break;
      case 'documentos': content = <DocumentsView {...shared} isMonitor />; break;
      case 'personas': content = <PeopleView {...shared} />; break;
      case 'reportes': content = <ReportsView {...shared} />; break;
      default: content = <MonitorHome {...shared} />;
    }
  }

  const canSwitchDemoRole = isLocalDemo && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ROLE_SWITCH === 'true');
  return (
    <AppShell
      page={page}
      role={role}
      userName={userName}
      alertCount={alertCount}
      syncState={SyncService.isRemoteMode() ? (syncState.status === 'error' ? 'error' : syncState.pending ? 'pending' : 'synced') : 'local'}
      canSwitchDemoRole={canSwitchDemoRole}
      onLogout={isLocalDemo ? undefined : () => {
        void logout().catch((caught) => {
          window.alert(caught instanceof Error ? caught.message : 'No se pudo cerrar sesión porque hay cambios pendientes de sincronizar.');
        });
      }}
      onNavigate={(nextPage) => { setSelectedProjectId(null); setPage(nextPage); }}
      onSwitchDemoRole={() => { switchRoleToggle(); setSelectedProjectId(null); setPage('inicio'); }}
    >
      {content}
    </AppShell>
  );
};

export const App: React.FC = () => <AuthProvider><Workspace /></AuthProvider>;

export default App;
