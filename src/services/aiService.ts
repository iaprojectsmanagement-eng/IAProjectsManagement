import { MeetingMinute } from '../types';
import { getAuthorizationHeaders } from './supabaseClient';

export interface TranscriptAnalysisResult {
  title: string;
  summary: string;
  decisions: { decision: string; date?: string }[];
  commitments: { task: string; responsible: string; dueDate?: string }[];
  risksDetected: string;
  sentiment: MeetingMinute['sentiment'];
  formattedActaText: string;
  provider: 'openai' | 'gemini' | 'local';
}

const stripTranscript = (text: string) => text.replace(/\d\d:\d\d:\d\d\.\d\d\d\s+-->\s+\d\d:\d\d:\d\d\.\d\d\d/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const localAnalysis = (rawText: string, projectTitle: string): TranscriptAnalysisResult => {
  const text = stripTranscript(rawText);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const contains = (words: string[]) => sentences.filter((sentence) => words.some((word) => sentence.toLowerCase().includes(word)));
  const decisionLines = contains(['decid', 'acord', 'aproba', 'defini']);
  const taskLines = contains(['tarea', 'comprom', 'entregar', 'responsable', 'debe ', 'pendiente']);
  const riskLines = contains(['riesgo', 'bloque', 'problema', 'sin acceso', 'demora']);
  const today = new Date().toISOString().slice(0, 10);
  const decisions = (decisionLines.length ? decisionLines : sentences.slice(0, 2)).slice(0, 5).map((decision) => ({ decision }));
  const commitments = (taskLines.length ? taskLines : ['Revisar el acta y confirmar los siguientes pasos.']).slice(0, 6).map((task) => ({ task, responsible: 'Equipo del proyecto', dueDate: today }));
  const summary = sentences.slice(0, 4).join(' ') || 'No fue posible extraer contenido suficiente de la transcripción.';
  const risksDetected = riskLines.length ? riskLines.slice(0, 3).join(' ') : 'Sin riesgos explícitos detectados; validar el borrador antes de publicarlo.';
  return { title: `Acta de reunión — ${projectTitle} — ${today}`, summary, decisions, commitments, risksDetected, sentiment: riskLines.length ? 'Preocupado/Crítico' : 'Neutro', formattedActaText: `ACTA DE REUNIÓN\nProyecto: ${projectTitle}\n\nResumen\n${summary}\n\nDecisiones\n${decisions.map((item) => `- ${item.decision}`).join('\n')}\n\nCompromisos\n${commitments.map((item) => `- ${item.task} (${item.responsible})`).join('\n')}\n\nRiesgos\n${risksDetected}`, provider: 'local' };
};

const callTranscriptFunction = async (rawText: string, projectTitle: string, projectId?: string): Promise<TranscriptAnalysisResult | null> => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const authorization = await getAuthorizationHeaders();
  if (!url || !authorization) return null;
  const response = await fetch(`${url}/functions/v1/analyze-transcript`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authorization }, body: JSON.stringify({ rawText, projectTitle, projectId }) });
  if (!response.ok) throw new Error('La función de análisis no respondió correctamente.');
  const data = await response.json();
  if (!data.summary || !Array.isArray(data.decisions) || !Array.isArray(data.commitments)) throw new Error('La IA devolvió un formato inválido.');
  return { title: data.title || `Acta de reunión — ${projectTitle}`, summary: data.summary, decisions: data.decisions, commitments: data.commitments, risksDetected: data.risksDetected || 'Sin riesgos reportados.', sentiment: data.sentiment || 'Neutro', formattedActaText: data.formattedActaText || data.summary, provider: data.provider === 'openai' ? 'openai' : 'gemini' };
};

export const AIService = {
  isConfigured: () => Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)),
  analyzeTranscript: async (rawText: string, projectTitle: string, projectId?: string): Promise<TranscriptAnalysisResult> => {
    if (!rawText.trim()) throw new Error('La transcripción está vacía.');
    try { const result = await callTranscriptFunction(rawText, projectTitle, projectId); if (result) return result; } catch (error) { console.warn('Fallo de IA remota; se usa análisis local.', error); }
    return localAnalysis(rawText, projectTitle);
  },
  generateDocumentDraft: async (projectId: string, templateId: string, documentId: string): Promise<{ title?: string; html: string } | null> => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const authorization = await getAuthorizationHeaders();
    if (!url || !authorization) return null;
    const response = await fetch(`${url}/functions/v1/generate-document`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authorization }, body: JSON.stringify({ projectId, templateId, documentId }) });
    if (!response.ok) throw new Error('No se pudo generar el documento mediante la función de IA.');
    const data = await response.json();
    return { title: data.document?.title, html: data.html };
  },
  generateChatbotResponse: async (question: string, projectTitle: string) => `Consulta registrada para ${projectTitle}: ${question}. Usa Incidencias para que el monitor pueda asignarla y darle seguimiento.`
};
