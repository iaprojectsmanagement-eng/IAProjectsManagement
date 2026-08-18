import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileSpreadsheet, Sparkles } from 'lucide-react';

interface MassProjectImportModalProps {
  onClose: () => void;
  onImportProjects: (csvText: string) => void;
}

export const MassProjectImportModal: React.FC<MassProjectImportModalProps> = ({
  onClose,
  onImportProjects,
}) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text || '');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!csvText.trim()) {
      alert('Por favor sube o pega primero el texto de la tabla o archivo CSV de proyectos.');
      return;
    }

    onImportProjects(csvText);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              Importador Automático
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Cargar Proyectos desde CSV</h3>
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
            Puedes subir el archivo CSV exportado desde tu hoja de cálculo o pegar directamente el texto. El sistema extraerá automáticamente el nombre de la organización, retos, contactos, enlaces de WhatsApp y métricas.
          </p>

          <div className="relative cursor-pointer border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center transition hover:border-[#0D9488]">
            <input
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-[#0D9488]" />
            <p className="text-xs font-bold text-slate-800">
              {fileName ? `Archivo Seleccionado: ${fileName}` : 'Arrastra tu archivo .CSV aquí'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">O haz clic para explorar en tu computador</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              O pega el contenido del CSV directamente:
            </label>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Organización,Carpeta compartida,Descripción del reto,Wapp..."
              className="w-full border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
            ></textarea>
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={!csvText.trim()}
            className="flex w-full items-center justify-center space-x-2 bg-[#0D9488] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Extraer e Importar Proyectos Automáticamente</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
