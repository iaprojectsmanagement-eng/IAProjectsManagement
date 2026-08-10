import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, EyeOff, XCircle } from 'lucide-react';
import { AppPage, AppShell } from './components/AppShell';
import { DocumentsView, IssuesView, MeetingsView, MonitorHome, PeopleView, ProjectDetail, ProjectsView, ReportsView, TasksView } from './components/FunctionalViews';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OperationsService } from './services/operationsService';
import { SyncService, SyncState } from './services/syncService';

const LoginScreen: React.FC<{ onSignIn: (email: string, password: string) => Promise<void> }> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="grid min-h-screen place-items-center bg-[#f6f7fb] p-4"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(''); void onSignIn(email.trim(), password).catch((caught) => setError(caught instanceof Error ? caught.message : 'No fue posible iniciar sesión.')).finally(() => setBusy(false)); }} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#514ff0] font-black text-white">I</div><h1 className="mt-5 text-2xl font-black">Ingresar a Project Hub</h1><p className="mt-2 text-sm text-slate-500">Usa la cuenta institucional creada en Supabase.</p>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<label className="mt-5 block text-xs font-bold text-slate-600">Correo<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="mt-3 block text-xs font-bold text-slate-600">Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><button disabled={busy} className="mt-5 w-full rounded-xl bg-[#514ff0] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Ingresando…' : 'Ingresar'}</button><p className="mt-4 text-center text-[11px] text-slate-400">El registro de usuarios y la asignación del primer monitor se realizan en Supabase.</p></form></main>;
};

const LoginScreenWithVisibility: React.FC<{ onSignIn: (email: string, password: string) => Promise<void> }> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="grid min-h-screen place-items-center bg-[#f6f7fb] p-4"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(''); void onSignIn(email.trim(), password).catch((caught) => { const message = caught instanceof Error ? caught.message : ''; setError(/invalid login credentials|invalid credentials/i.test(message) ? 'Credenciales incorrectas. Verifica tu correo y código.' : message || 'No fue posible iniciar sesión.'); }).finally(() => setBusy(false)); }} className="w-full max-w-md border border-slate-200 bg-white p-8 shadow-xl"><div className="grid h-12 w-12 place-items-center bg-[#514ff0] font-black text-white">I</div><h1 className="mt-5 text-2xl font-black">Ingresar a Project Hub</h1><p className="mt-2 text-sm text-slate-500">Usa la cuenta institucional creada en Supabase.</p><label className="mt-5 block text-xs font-bold text-slate-600">Correo<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="mt-3 block text-xs font-bold text-slate-600">Contraseña<div className="relative"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full border border-slate-200 px-3 py-2.5 pr-10 text-sm" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-slate-500 hover:text-[#148D8D]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>{error && <p role="alert" className="mt-4 text-xs font-bold text-[#a45151]">{error}</p>}<button disabled={busy} className="mt-5 w-full bg-[#514ff0] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Ingresando…' : 'Ingresar'}</button></form></main>;
};

const Workspace: React.FC = () => {
  const { role, userId, userName, userEmail, assignedProjectId, switchRoleToggle, isAuthenticated, isLoading, isLocalDemo, signIn, logout } = useAuth();
  const isMonitor = role === 'superuser';
  const [page, setPage] = useState<AppPage>('inicio');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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
  const openProject = (id: string) => { setSelectedProjectId(id); setPage('proyectos'); };
  const shared = { projects, onChanged: refresh, onOpenProject: openProject };

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb] text-sm font-bold text-slate-500">Cargando sesión…</div>;
  if (!isAuthenticated) return <LoginScreenWithVisibility onSignIn={signIn} />;
  if (SyncService.isRemoteMode() && !dataReady) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb] p-4"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-black">{syncState.status === 'error' ? 'No se pudieron cargar los datos' : 'Cargando espacio de trabajo…'}</h1><p className="mt-2 text-sm text-slate-500">{syncState.error || 'Estamos aplicando tus permisos y preparando la información autorizada.'}</p>{syncState.status === 'error' && <button onClick={() => { setDataReady(false); void SyncService.bootstrap().then(() => { OperationsService.initialise(); setDataReady(true); refresh(); }); }} className="mt-4 rounded-xl bg-[#514ff0] px-4 py-2 text-xs font-bold text-white">Reintentar</button>}</div></div>;

  let content: React.ReactNode;
  if (!isMonitor && !studentProject) {
    const applications = OperationsService.getApplications().filter((application) => application.studentEmail.toLowerCase() === userEmail.toLowerCase());
    content = <div className="mx-auto max-w-4xl"><div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-amber-700">Sin asignación</p><h1 className="mt-3 text-2xl font-black">Todavía no tienes un proyecto asignado</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Puedes postularte a un proyecto. Hasta que el monitor acepte o te asigne directamente, no tendrás acceso a información privada de ningún equipo.</p><p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Cuenta: {userEmail}{assignedProjectId ? ` · referencia anterior ignorada: ${assignedProjectId}` : ''}</p></div><h2 className="mb-3 mt-6 text-lg font-black">Proyectos disponibles</h2><div className="grid gap-3 md:grid-cols-2">{projects.map((project) => { const application = applications.find((item) => item.projectId === project.id); const assignedCount = project.assignedStudentsCount ?? project.assignedStudents.length; const full = assignedCount >= project.maxStudents; return <section key={project.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold text-indigo-600">{project.code} · {project.companyName}</p><h3 className="mt-2 font-bold">{project.title}</h3><p className="mt-2 text-xs text-slate-500">Cupos: {assignedCount}/{project.maxStudents}</p>{application ? <span className={`mt-3 inline-block rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${application.status === 'rechazada' ? 'bg-rose-100 text-rose-700' : application.status === 'aceptada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{application.status}</span> : <button disabled={full} onClick={() => { try { OperationsService.applyToProject(project.id, { id: userId, name: userName, email: userEmail }); refresh(); } catch (caught) { window.alert(caught instanceof Error ? caught.message : 'No se pudo enviar la postulación.'); } }} className="mt-3 rounded-xl bg-[#514ff0] px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300">{full ? 'Sin cupos' : 'Postularme'}</button>}</section>; })}</div></div>;
  } else if (!isMonitor && studentProject) {
    if (page === 'inicio') content = <ProjectDetail {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'tareas') content = <TasksView {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'agenda') content = <MeetingsView {...shared} projectId={studentProject.id} isMonitor={false} />;
    else if (page === 'incidencias') content = <IssuesView {...shared} projectId={studentProject.id} isStudent />;
    else content = <DocumentsView {...shared} projectId={studentProject.id} isMonitor={false} />;
  } else if (selectedProjectId) {
    content = <ProjectDetail {...shared} projectId={selectedProjectId} isMonitor onBack={() => setSelectedProjectId(null)} />;
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
  return <AppShell page={page} role={role} userName={userName} alertCount={alertCount} syncState={SyncService.isRemoteMode() ? (syncState.status === 'error' ? 'error' : syncState.pending ? 'pending' : 'synced') : 'local'} canSwitchDemoRole={canSwitchDemoRole} onLogout={isLocalDemo ? undefined : () => { void logout(); }} onNavigate={(nextPage) => { setSelectedProjectId(null); setPage(nextPage); }} onSwitchDemoRole={() => { switchRoleToggle(); setSelectedProjectId(null); setPage('inicio'); }}>{content}</AppShell>;
};

export const App: React.FC = () => <AuthProvider><Workspace /></AuthProvider>;

export default App;
