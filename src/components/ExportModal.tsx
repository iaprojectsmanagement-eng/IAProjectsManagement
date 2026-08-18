import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { X, FileSpreadsheet, FileText, Download } from 'lucide-react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

interface ExportModalProps {
  projects: Project[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ projects, onClose }) => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
      Estudiantes: p.assignedStudents.map((s) => s.name).join('; '),
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-md space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              Centro de informes
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">Exportar Matriz de Proyectos</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExportCSV}
            className="group flex w-full items-center justify-between border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#0D9488] hover:bg-teal-50/30"
          >
            <div className="flex items-center space-x-3">
              <div className="grid h-10 w-10 place-items-center bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0E2C40]">Exportar a Excel / CSV</p>
                <p className="text-[11px] text-slate-400">Matriz con todos los proyectos, enlaces y métricas</p>
              </div>
            </div>
            <Download className="h-4 w-4 text-slate-400 transition group-hover:text-[#0D9488]" />
          </button>

          <button
            onClick={handleExportPDF}
            className="group flex w-full items-center justify-between border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#0D9488] hover:bg-teal-50/30"
          >
            <div className="flex items-center space-x-3">
              <div className="grid h-10 w-10 place-items-center bg-teal-50 text-[#0D9488]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0E2C40]">Generar Reporte Ejecutivo en PDF</p>
                <p className="text-[11px] text-slate-400">Informe consolidado para el profesor titular del curso</p>
              </div>
            </div>
            <Download className="h-4 w-4 text-slate-400 transition group-hover:text-[#0D9488]" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
