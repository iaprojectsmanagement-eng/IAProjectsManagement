import React, { useState } from 'react';
import { Project, MeetingMinute } from '../types';
import { AIService, TranscriptAnalysisResult } from '../services/aiService';
import { X, Upload, Sparkles, FileText, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface TranscriptUploaderModalProps {
  project: Project;
  onClose: () => void;
  onSaveMinute: (minute: MeetingMinute) => void;
}

export const TranscriptUploaderModal: React.FC<TranscriptUploaderModalProps> = ({
  project,
  onClose,
  onSaveMinute
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TranscriptAnalysisResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'vtt' && extension !== 'txt') {
      window.alert('Por ahora solo se pueden analizar transcripciones .vtt o .txt. Los archivos .docx y .pdf requieren un extractor que aún no está configurado.');
      e.target.value = '';
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setFileContent(text || '');
    };
    reader.readAsText(file);
  };

  const handleRunAiAnalysis = async () => {
    if (!fileContent.trim()) {
      alert('Por favor sube o pega primero el texto de la transcripción descargada de MS Teams.');
      return;
    }

    setIsAnalyzing(true);
    const result = await AIService.analyzeTranscript(fileContent, project.title);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleConfirmSave = () => {
    if (!analysisResult) return;

    const newMinute: MeetingMinute = {
      id: 'min-' + Date.now(),
      projectId: project.id,
      projectTitle: project.title,
      meetingDate: new Date().toISOString().split('T')[0],
      title: analysisResult.title,
      summary: analysisResult.summary,
      decisions: analysisResult.decisions,
      commitments: analysisResult.commitments,
      risksDetected: analysisResult.risksDetected,
      sentiment: analysisResult.sentiment,
      uploadedBy: 'Estudiante / Monitor',
      createdAt: new Date().toISOString()
    };

    onSaveMinute(newMinute);
    alert('Acta de reunión procesada e incorporada exitosamente al proyecto.');
    onClose();
  };

  const handleExportPDF = () => {
    if (!analysisResult) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`ACTA DE REUNIÓN - ${project.code}`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Proyecto: ${project.title}`, 14, 30);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 38);
    
    doc.setFontSize(12);
    doc.text('RESUMEN EJECUTIVO:', 14, 50);
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(analysisResult.summary, 180);
    doc.text(splitSummary, 14, 58);

    doc.save(`Acta_${project.code}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportWord = async () => {
    if (!analysisResult) return;

    const wordDocument = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: `ACTA DE REUNIÓN - ${project.code}`, bold: true, size: 32 })] }),
          new Paragraph(`Proyecto: ${project.title}`),
          new Paragraph(`Fecha: ${new Date().toLocaleDateString()}`),
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: 'RESUMEN EJECUTIVO', bold: true })] }),
          new Paragraph(analysisResult.summary),
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: 'DECISIONES', bold: true })] }),
          ...analysisResult.decisions.map((decision) => new Paragraph({ text: decision.decision, bullet: { level: 0 } })),
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: 'COMPROMISOS', bold: true })] }),
          ...analysisResult.commitments.map((commitment) => new Paragraph({ text: `${commitment.task} — Responsable: ${commitment.responsible}`, bullet: { level: 0 } })),
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: 'RIESGOS', bold: true })] }),
          new Paragraph(analysisResult.risksDetected)
        ]
      }]
    });
    const blob = await Packer.toBlob(wordDocument);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Acta_${project.code}_${new Date().toISOString().split('T')[0]}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              PROCESADOR IA DE TRANSCRIPCIONES
            </span>
            <h3 className="text-lg font-extrabold text-white font-outfit mt-1">Cargar Transcripción MS Teams</h3>
            <p className="text-xs text-slate-400">{project.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!analysisResult ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-950 transition cursor-pointer relative">
              <input
                type="file"
                accept=".vtt,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="h-10 w-10 text-indigo-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-200">
                {fileName ? `Archivo Cargado: ${fileName}` : 'Arrastra aquí tu transcripción (.vtt, .txt, .docx)'}
              </p>
              <p className="text-xs text-slate-400 mt-1">O haz clic para seleccionar el archivo descargado de MS Teams</p>
            </div>

            {/* Direct Paste Fallback */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                O pega el texto de la transcripción directamente:
              </label>
              <textarea
                rows={5}
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="[00:01:23] Juan: Hola a todos, iniciemos la reunión de revisión..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 font-mono"
              ></textarea>
            </div>

            <button
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzing || !fileContent.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Analizando Transcripción con IA Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Procesar Transcripción y Generar Acta</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Preview Result */
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center space-x-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Acta Generada por IA</span>
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                  Sentimiento: {analysisResult.sentiment}
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-100">{analysisResult.title}</h4>

              <div className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <strong>Resumen: </strong>
                {analysisResult.summary}
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <strong>Decisiones Clave:</strong>
                <ul className="list-disc list-inside text-slate-400">
                  {analysisResult.decisions.map((d, i) => (
                    <li key={i}>{d.decision}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleExportPDF}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-slate-700 transition"
              >
                <Download className="h-4 w-4 text-indigo-400" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={handleExportWord}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-slate-700 transition"
              >
                <Download className="h-4 w-4 text-indigo-400" />
                <span>Descargar Word</span>
              </button>

              <button
                onClick={handleConfirmSave}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Guardar Acta en el Proyecto</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
