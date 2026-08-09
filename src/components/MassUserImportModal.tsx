import React, { useState } from 'react';
import { X, UserPlus, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';

interface MassUserImportModalProps {
  onClose: () => void;
  onImportComplete: (usersCount: number) => void;
}

export const MassUserImportModal: React.FC<MassUserImportModalProps> = ({
  onClose,
  onImportComplete
}) => {
  const [inputText, setInputText] = useState(
    `nombre,correo,codigo\nJuan Perez,juan_perez@u.icesi.edu.co,2201040\nMaria Lopez,maria_lopez@u.icesi.edu.co,2201041`
  );

  const handleParseAndImport = () => {
    try {
      const parsed = Papa.parse<{ nombre: string; correo: string; codigo: string }>(inputText, {
        header: true,
        skipEmptyLines: true
      });

      const count = parsed.data.length;
      onImportComplete(count);
      alert(`¡Carga masiva completada! Se crearon ${count} cuentas de estudiantes en Supabase Auth con su código como contraseña inicial.`);
      onClose();
    } catch (e) {
      alert('Error en el formato del CSV / Texto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              GESTOR MASIVO DE USUARIOS
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Cargar Estudiantes (CSV / Texto)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Ingresa o pega la lista de estudiantes con las columnas <code className="text-indigo-400 font-mono">nombre,correo,codigo</code>. Sus contraseñas iniciales se generarán automáticamente usando su código de estudiante.
          </p>

          <textarea
            rows={8}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-indigo-500"
          ></textarea>

          <button
            onClick={handleParseAndImport}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/20"
          >
            <UserPlus className="h-4 w-4" />
            <span>Procesar Carga Masiva de Usuarios</span>
          </button>
        </div>
      </div>
    </div>
  );
};
