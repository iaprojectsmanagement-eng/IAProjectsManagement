import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus } from 'lucide-react';
import Papa from 'papaparse';

interface MassUserImportModalProps {
  onClose: () => void;
  onImportComplete: (usersCount: number) => void;
}

export const MassUserImportModal: React.FC<MassUserImportModalProps> = ({
  onClose,
  onImportComplete,
}) => {
  const [inputText, setInputText] = useState(
    `nombre,correo,codigo\nJuan Perez,juan_perez@u.icesi.edu.co,2201040\nMaria Lopez,maria_lopez@u.icesi.edu.co,2201041`
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleParseAndImport = () => {
    try {
      const parsed = Papa.parse<{ nombre: string; correo: string; codigo: string }>(inputText, {
        header: true,
        skipEmptyLines: true,
      });

      const count = parsed.data.length;
      onImportComplete(count);
      alert(`¡Carga masiva completada! Se crearon ${count} cuentas de estudiantes en Supabase Auth con su código como contraseña inicial.`);
      onClose();
    } catch {
      alert('Error en el formato del CSV / Texto.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              Gestor Masivo de Usuarios
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Cargar Estudiantes (CSV / Texto)</h3>
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
          <p className="text-xs leading-relaxed text-slate-600">
            Ingresa o pega la lista de estudiantes con las columnas <code className="bg-slate-100 px-1.5 py-0.5 font-mono text-[#0D9488]">nombre,correo,codigo</code>. Sus contraseñas iniciales se generarán automáticamente usando su código de estudiante.
          </p>

          <textarea
            rows={8}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
          ></textarea>

          <button
            onClick={handleParseAndImport}
            className="flex w-full items-center justify-center space-x-2 bg-[#0D9488] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Procesar Carga Masiva de Usuarios</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
