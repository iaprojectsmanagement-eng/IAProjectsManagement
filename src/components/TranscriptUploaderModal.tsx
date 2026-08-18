import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, MeetingMinute } from '../types';
import { AIService, TranscriptAnalysisResult } from '../services/aiService';
import { X, Upload, Sparkles, CheckCircle2, Download, RefreshCw } from 'lucide-react';
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
  onSaveMinute,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TranscriptAnalysisResult | null>(null);

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
      createdAt: new Date().toISOString(),
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
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `ACTA DE REUNIÓN - ${project.code}`,
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Proyecto: ${project.title}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Fecha: ${new Date().toLocaleDateString()}`,
                  size: 20,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Resumen Ejecutivo:',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: analysisResult.summary,
                  size: 20,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(wordDocument);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Acta_${project.code}_${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl space-y-6 border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D9488]">
              Procesamiento de Transcripciones
            </span>
            <h3 className="mt-1 text-lg font-extrabold text-[#0E2C40]">
              Subir Transcripción · {project.code}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!analysisResult ? (
          <div className="space-y-4">
            {/* File drop area */}
            <div className="relative border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center transition hover:border-[#0D9488]">
              <input
                type="file"
                accept=".vtt,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <Upload className="mx-auto mb-2 h-10 w-10 text-[#0D9488]" />
              <p className="text-sm font-bold text-slate-800">
                {fileName ? `Archivo Cargado: ${fileName}` : 'Arrastra aquí tu transcripción (.vtt o .txt)'}
              </p>
              <p className="mt-1 text-xs text-slate-400">O haz clic para seleccionar el archivo descargado de MS Teams</p>
            </div>

            {/* Direct Paste Fallback */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                O pega el texto de la transcripción directamente:
              </label>
              <textarea
                rows={5}
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="[00:01:23] Juan: Hola a todos, iniciemos la reunión de revisión..."
                className="w-full border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              ></textarea>
            </div>

            <button
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzing || !fileContent.trim()}
              className="flex w-full items-center justify-center space-x-2 bg-[#0D9488] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E] disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Analizando Transcripción con IA…</span>
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
            <div className="space-y-3 border border-teal-200 bg-teal-50/30 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1 text-xs font-bold text-[#0D9488]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Acta Generada por IA</span>
                </span>
                <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Sentimiento: {analysisResult.sentiment}
                </span>
              </div>

              <h4 className="text-sm font-bold text-[#0E2C40]">{analysisResult.title}</h4>

              <div className="border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
                <strong className="text-slate-800">Resumen: </strong>
                {analysisResult.summary}
              </div>

              <div className="space-y-1 text-xs text-slate-600">
                <strong className="text-slate-800">Decisiones Clave:</strong>
                <ul className="list-inside list-disc space-y-0.5 text-slate-500">
                  {analysisResult.decisions.map((d, i) => (
                    <li key={i}>{d.decision}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={handleExportPDF}
                className="flex flex-1 items-center justify-center space-x-1.5 border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4 text-[#0D9488]" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={handleExportWord}
                className="flex flex-1 items-center justify-center space-x-1.5 border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4 text-[#0D9488]" />
                <span>Descargar Word</span>
              </button>

              <button
                onClick={handleConfirmSave}
                className="flex flex-1 items-center justify-center space-x-1.5 bg-[#0D9488] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Guardar Acta</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
