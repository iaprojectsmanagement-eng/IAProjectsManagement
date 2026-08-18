import React from 'react';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Sparkles,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
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
  { id: 'reportes', label: 'Reportes', icon: Wrench },
];

export const AppShell: React.FC<AppShellProps> = ({
  children,
  page,
  role,
  userName,
  alertCount,
  onNavigate,
  onSwitchDemoRole,
  onLogout,
  canSwitchDemoRole = false,
  syncState = 'local',
}) => {
  const isMonitor = role === 'superuser';
  const items = isMonitor
    ? monitorItems
    : monitorItems.filter((item) => ['inicio', 'tareas', 'agenda', 'incidencias', 'documentos'].includes(item.id));
  const studentLabels: Partial<Record<AppPage, string>> = { inicio: 'Mi proyecto', agenda: 'Reuniones' };
  const syncLabel =
    syncState === 'local'
      ? 'Datos locales'
      : syncState === 'synced'
        ? 'Sincronizado'
        : syncState === 'pending'
          ? 'Sincronizando…'
          : 'Error de sincronización';

  return (
    <div className="app-shell min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="app-shell__header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="app-shell__topbar mx-auto flex max-w-[1600px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="app-shell__brand-mark grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0D9488] to-[#0E2C40] text-sm font-black text-white shadow-md shadow-teal-700/20"
              aria-hidden="true"
            >
              I
            </div>
            <div>
              <p className="app-shell__product-name text-sm font-extrabold tracking-tight text-[#0E2C40]">Projects Management</p>
              <p className="app-shell__context text-[11px] font-medium text-slate-400">
                {isMonitor ? 'Coordinación académica' : 'Espacio del equipo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`app-shell__sync hidden sm:inline-flex ${
                syncState === 'error'
                  ? 'app-shell__sync--error'
                  : syncState === 'pending'
                    ? 'app-shell__sync--pending'
                    : syncState === 'synced'
                      ? 'app-shell__sync--synced'
                      : ''
              }`}
              role="status"
            >
              {syncLabel}
            </span>

            <button
              onClick={() => onNavigate('incidencias')}
              className="app-shell__icon-button relative rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Ver incidencias"
            >
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="app-shell__notification-count absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-extrabold text-white shadow-sm">
                  {alertCount}
                </span>
              )}
            </button>

            <div className="app-shell__profile hidden border-l border-slate-200 pl-3 text-right sm:block">
              <p className="text-xs font-bold text-slate-800">{userName}</p>
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500">
                {isMonitor ? 'Monitor' : 'Estudiante'}
              </span>
            </div>

            {canSwitchDemoRole && (
              <button
                onClick={onSwitchDemoRole}
                className="app-shell__demo-switch hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0D9488] shadow-sm transition hover:border-[#0D9488] hover:bg-teal-50/50 md:inline-flex"
                title="Solo disponible en el entorno local de desarrollo"
              >
                {isMonitor ? 'Vista estudiante demo' : 'Vista monitor demo'}
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="app-shell__icon-button rounded-xl border border-slate-200/80 bg-white text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="app-shell__frame flex">
        <aside className="app-shell__sidebar sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200/80 bg-white p-4 lg:block">
          <p className="app-shell__nav-label mb-3 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {isMonitor ? 'Navegación' : 'Mi trabajo'}
          </p>
          <nav className="space-y-1" aria-label="Navegación principal">
            {items.map((item) => {
              const Icon = item.icon;
              const label = isMonitor ? item.label : studentLabels[item.id] || item.label;
              const selected = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`app-shell__nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 ${
                    selected
                      ? 'app-shell__nav-item--active bg-[#0D9488] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  {item.id === 'incidencias' && alertCount > 0 && (
                    <span
                      className={`app-shell__nav-count ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        selected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="app-shell__aside-note mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs">
            <p className="font-bold text-[#0E2C40]">Espacio de gestión</p>
            <p className="mt-1 leading-relaxed text-slate-500">
              Coordinación estructurada con IA para actas, compromisos y documentos institucionales.
            </p>
          </div>
        </aside>

        <main className="app-shell__main min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8" id="main-content">
          {children}
        </main>
      </div>

      <nav
        className="app-shell__mobile-nav fixed inset-x-0 bottom-0 z-30 flex justify-start gap-1 overflow-x-auto border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-md lg:hidden"
        aria-label="Navegación principal"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const selected = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={selected ? 'page' : undefined}
              className={`app-shell__mobile-item grid min-w-[70px] place-items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-all ${
                selected ? 'bg-teal-50 text-[#0D9488]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{isMonitor ? item.label : studentLabels[item.id] || item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
