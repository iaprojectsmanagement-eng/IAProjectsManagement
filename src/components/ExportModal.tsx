import React from 'react';
import { Project } from '../types';
import { X, FileSpreadsheet, FileText, Download } from 'lucide-react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

interface ExportModalProps {
  projects: Project[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ projects, onClose }) => {
  const handleExportCSV = () => {
    const dataToExport = projects.map((p) => ({
      Codigo: p.code,
      Empresa: p.companyName,
      Titulo: p.title,
      Estado: p.progressStatus,
      ProgresoPct: `${p.progressPct}%`,
      Riesgo: p.riskLevel,
      ImpactoCOP: p.copImpactAnnual ? `$${p.copImpactAnnual}` : 'N/A',
      Complejidad: p.complexityRating,
      TipoIA: p.aiType.join(', '),
      WhatsApp: p.whatsappUrl || 'Sin Wapp',
      TeamsMeeting: p.teamsMeetingUrl || 'Sin Teams',
      GitHub: p.githubUrl || 'Sin GitHub',
      Drive: p.driveFolderUrl || 'Sin Drive',
      Estudiantes: p.assignedStudents.map((s) => s.name).join('; ')
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Matriz_Proyectos_IA_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('INFORME EJECUTIVO DE PROYECTOS IA', 14, 20);
    doc.setFontSize(10);
    doc.text(`Total Proyectos: ${projects.length}`, 14, 28);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 34);

    let y = 46;
    projects.forEach((p, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.text(`${idx + 1}. [${p.code}] ${p.companyName} - ${p.title.slice(0, 55)}...`, 14, y);
      doc.setFontSize(8);
      doc.text(`Estado: ${p.progressStatus} | Riesgo: ${p.riskLevel.toUpperCase()} | Complejidad: ${p.complexityRating}/10`, 18, y + 5);
      y += 12;
    });

    doc.save(`Informe_Ejecutivo_IA_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              CENTRO DE INFORMES
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Exportar Matriz de Proyectos</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExportCSV}
            className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-100 flex items-center justify-between transition group"
          >
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
              <div className="text-left">
                <p className="text-xs font-bold">Exportar a Excel / CSV</p>
                <p className="text-[10px] text-slate-400">Matriz con los 18 proyectos, enlaces y métricas</p>
              </div>
            </div>
            <Download className="h-4 w-4 text-slate-400 group-hover:text-emerald-400 transition" />
          </button>

          <button
            onClick={handleExportPDF}
            className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-100 flex items-center justify-between transition group"
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-indigo-400" />
              <div className="text-left">
                <p className="text-xs font-bold">Generar Reporte Ejecutivo en PDF</p>
                <p className="text-[10px] text-slate-400">Informe consolidado para el profesor titular del curso</p>
              </div>
            </div>
            <Download className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 transition" />
          </button>
        </div>
      </div>
    </div>
  );
};
