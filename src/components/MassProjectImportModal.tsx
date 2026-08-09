import React, { useState } from 'react';
import { Project } from '../types';
import { X, Upload, FileSpreadsheet, CheckCircle2, Sparkles } from 'lucide-react';

interface MassProjectImportModalProps {
  onClose: () => void;
  onImportProjects: (csvText: string) => void;
}

export const MassProjectImportModal: React.FC<MassProjectImportModalProps> = ({
  onClose,
  onImportProjects
}) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');

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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              IMPORTADOR AUTOMÁTICO DE PROYECTOS
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Cargar Proyectos desde CSV</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Puedes subir el archivo CSV exportado desde tu hoja de cálculo o pegar directamente el texto. El sistema extraerá automáticamente el nombre de la organización, retos, contactos, enlaces de WhatsApp y métricas.
          </p>

          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center bg-slate-950 transition cursor-pointer relative">
            <input
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileSpreadsheet className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-200">
              {fileName ? `Archivo Seleccionado: ${fileName}` : 'Arrastra tu archivo .CSV aquí'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">O haz clic para explorar en tu computador</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              O pega el contenido del CSV directamente:
            </label>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Organización,Carpeta compartida,Descripción del reto,Wapp..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-indigo-500"
            ></textarea>
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={!csvText.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Extraer e Importar Proyectos Automáticamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
