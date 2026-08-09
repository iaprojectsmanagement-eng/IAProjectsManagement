import React from 'react';
import { Bell, CalendarDays, ClipboardList, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, Users, Wrench, TriangleAlert } from 'lucide-react';
import { UserRole } from '../types';

export type AppPage = 'inicio' | 'proyectos' | 'agenda' | 'tareas' | 'incidencias' | 'documentos' | 'personas' | 'reportes';

interface AppShellProps {
  children: React.ReactNode;
  page: AppPage;
  role: UserRole;
  userName: string;
  alertCount: number;
  onNavigate: (page: AppPage) => void;
  onSwitchDemoRole: () => void;
  onLogout?: () => void;
  canSwitchDemoRole?: boolean;
  syncState?: 'local' | 'synced' | 'pending' | 'error';
}

const monitorItems: { id: AppPage; label: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'tareas', label: 'Tareas', icon: ClipboardList },
  { id: 'incidencias', label: 'Incidencias', icon: TriangleAlert },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'personas', label: 'Personas', icon: Users },
  { id: 'reportes', label: 'Reportes', icon: Wrench }
];

export const AppShell: React.FC<AppShellProps> = ({ children, page, role, userName, alertCount, onNavigate, onSwitchDemoRole, onLogout, canSwitchDemoRole = false, syncState = 'local' }) => {
  const isMonitor = role === 'superuser';
  const items = isMonitor ? monitorItems : monitorItems.filter((item) => ['inicio', 'tareas', 'agenda', 'incidencias', 'documentos'].includes(item.id));
  const studentLabels: Partial<Record<AppPage, string>> = { inicio: 'Mi proyecto', agenda: 'Reuniones' };

  return (
    <div className="icesi-workspace min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#514ff0] text-sm font-black text-white">I</div><div><p className="text-sm font-extrabold tracking-tight">Project Hub</p><p className="text-[11px] text-slate-500">{isMonitor ? 'Coordinación académica' : 'Espacio del equipo'}</p></div></div>
          <div className="flex items-center gap-3"><span className={`hidden rounded-full px-2 py-1 text-[9px] font-extrabold uppercase sm:inline ${syncState === 'error' ? 'bg-rose-100 text-rose-700' : syncState === 'pending' ? 'bg-amber-100 text-amber-700' : syncState === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{syncState === 'local' ? 'Datos locales' : syncState === 'synced' ? 'Sincronizado' : syncState === 'pending' ? 'Sincronizando' : 'Error de sincronización'}</span><button onClick={() => onNavigate('incidencias')} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Ver incidencias"><Bell className="h-5 w-5" />{alertCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{alertCount}</span>}</button><div className="hidden text-right sm:block"><p className="text-xs font-bold">{userName}</p><p className="text-[10px] text-slate-500">{isMonitor ? 'Monitor' : 'Estudiante'}</p></div>{canSwitchDemoRole && <button onClick={onSwitchDemoRole} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-[#514ff0] hover:bg-indigo-50" title="Solo disponible en el entorno local de desarrollo">{isMonitor ? 'Vista estudiante demo' : 'Vista monitor demo'}</button>}{onLogout && <button onClick={onLogout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar sesión"><LogOut className="h-4 w-4" /></button>}</div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{isMonitor ? 'Navegación' : 'Mi trabajo'}</p>
          <nav className="space-y-1">{items.map((item) => { const Icon = item.icon; const label = isMonitor ? item.label : studentLabels[item.id] || item.label; return <button key={item.id} onClick={() => onNavigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${page === item.id ? 'bg-[#514ff0] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}{item.id === 'incidencias' && alertCount > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] ${page === item.id ? 'bg-white/20' : 'bg-rose-100 text-rose-700'}`}>{alertCount}</span>}</button>; })}</nav>
          <div className="mt-8 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900"><p className="font-bold">Vista operativa</p><p className="mt-1 leading-relaxed text-indigo-700">Solo muestra trabajo pendiente, no información decorativa.</p></div>
        </aside>
        <main className="icesi-main-surface min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-start gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 py-2 lg:hidden">{items.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => onNavigate(item.id)} className={`grid min-w-[70px] place-items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${page === item.id ? 'text-[#514ff0]' : 'text-slate-500'}`}><Icon className="h-4 w-4" /><span>{isMonitor ? item.label : studentLabels[item.id] || item.label}</span></button>; })}</nav>
      <footer className="hidden border-t border-slate-200 bg-white py-5 text-center text-[11px] text-slate-500 lg:block">Project Hub · entorno de demostración con integraciones simuladas</footer>
    </div>
  );
};
