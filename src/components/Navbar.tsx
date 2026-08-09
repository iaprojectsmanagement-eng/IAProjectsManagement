import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, FileSpreadsheet, Menu, Send, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';

interface NavbarProps {
  onOpenMassImport: () => void;
  onOpenExport: () => void;
  onSendMassEmails: () => void;
  unreadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMassImport, onOpenExport, onSendMassEmails, unreadCount }) => {
  const { role, userName, userEmail } = useAuth();
  const isSuperuser = role === 'superuser';

  return (
    <header className="sticky top-0 z-40 shadow-[0_2px_0_rgba(0,0,0,0.06)]">
      <div className="icesi-topbar px-5 lg:px-10">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="icesi-mark" aria-hidden="true" />
            <div className="leading-none">
              <p className="text-[11px] font-semibold tracking-wide text-white/80">Universidad</p>
              <h1 className="text-[26px] font-black tracking-tight text-white">icesi</h1>
            </div>
            <span className="hidden border-l border-white/30 pl-4 text-[11px] font-semibold tracking-[0.14em] text-white/80 sm:block">IA PROJECT HUB</span>
          </div>
          <div className="flex items-center gap-4 text-white">
            <button className="hidden items-center gap-2 text-xs font-bold md:flex" type="button" aria-label="Abrir menu"><Menu className="h-6 w-6" strokeWidth={1.8} /><span>Menu</span></button>
            <div className="hidden border-l border-white/30 pl-4 text-right sm:block"><p className="text-xs font-bold leading-none">{userName}</p><p className="mt-1 text-[10px] text-white/75">{userEmail}</p></div>
          </div>
        </div>
      </div>
      <div className="bg-white px-5 lg:px-10">
        <div className="mx-auto flex min-h-[62px] max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-x-auto py-2"><span className="icesi-section-label">{isSuperuser ? 'Coordinacion academica' : 'Espacio estudiantil'}</span><span className="hidden text-xs text-slate-500 md:inline">Proyectos de Inteligencia Artificial · Universidad Icesi</span></div>
          <div className="flex shrink-0 items-center gap-2"><div className="hidden items-center gap-1.5 border-l border-slate-200 pl-3 text-xs font-semibold text-slate-600 sm:flex">{isSuperuser ? <ShieldCheck className="h-4 w-4 text-[#514ff0]" /> : <UserCheck className="h-4 w-4 text-[#514ff0]" />}{isSuperuser ? 'Monitor' : 'Estudiante'}</div><div className="relative rounded-full border border-slate-200 p-2 text-[#514ff0]" title="Alertas abiertas"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#e9f534] px-1 text-[9px] font-black text-black">{unreadCount}</span>}</div></div>
        </div>
      </div>
      {isSuperuser && <div className="border-y border-slate-200 bg-[#f6f7ff] px-5 lg:px-10"><div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto py-2"><button onClick={onOpenMassImport} className="icesi-utility-button" type="button"><UserPlus className="h-3.5 w-3.5" /> Cargar estudiantes</button><button onClick={onSendMassEmails} className="icesi-utility-button" type="button"><Send className="h-3.5 w-3.5" /> Recordatorios</button><button onClick={onOpenExport} className="icesi-utility-button" type="button"><FileSpreadsheet className="h-3.5 w-3.5" /> Reportes</button></div></div>}
    </header>
  );
};
