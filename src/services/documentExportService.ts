import { ProjectDocument } from '../types';
import { StorageService, StoredFile } from './storageService';

type ExportFormat = 'pdf' | 'docx';
type Block = { kind: 'title' | 'heading' | 'paragraph' | 'list'; text: string };
const fileBase = (title: string) => title.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'documento';
const blocksFromHtml = (html: string): Block[] => {
  if (typeof DOMParser === 'undefined') {
    return [...html.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match): Block => ({
      kind: match[1].toLowerCase() === 'h1' ? 'title' : /^h[23]$/i.test(match[1]) ? 'heading' : match[1].toLowerCase() === 'li' ? 'list' : 'paragraph',
      text: match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(),
    })).filter((block) => block.text);
  }
  const root = new DOMParser().parseFromString(html, 'text/html').body;
  const elements = [...root.querySelectorAll('h1,h2,h3,p,li')];
  return elements.map((element): Block => ({ kind: element.tagName === 'H1' ? 'title' : /^H[23]$/.test(element.tagName) ? 'heading' : element.tagName === 'LI' ? 'list' : 'paragraph', text: (element.textContent || '').replace(/\s+/g, ' ').trim() })).filter((block) => block.text);
};
const download = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000); };

const makePdf = async (projectDocument: ProjectDocument) => {
  if (typeof window === 'undefined' || typeof window.document === 'undefined') throw new Error('La exportación visual requiere un navegador.');
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const iframe = window.document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed'; iframe.style.left = '-10000px'; iframe.style.top = '0'; iframe.style.width = '900px'; iframe.style.height = '1200px'; iframe.style.border = '0';
  window.document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('La plantilla tardó demasiado en renderizar.')), 8_000);
      iframe.onload = () => { window.clearTimeout(timeout); resolve(); };
      iframe.srcdoc = projectDocument.htmlPreview;
    });
    const frameDocument = iframe.contentDocument;
    if (!frameDocument) throw new Error('No fue posible abrir la plantilla para exportarla.');
    await frameDocument.fonts?.ready;
    await Promise.all([...frameDocument.images].map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); });
      if ('decode' in image) await image.decode().catch(() => undefined);
    }));
    const target = frameDocument.querySelector<HTMLElement>('.document-container') || frameDocument.body;
    target.style.boxShadow = 'none'; target.style.borderRadius = '0';
    const canvas = await html2canvas(target, { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false, imageTimeout: 8_000 });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageWidth = 210; const pageHeight = 297;
    const pageCanvasHeight = Math.round(canvas.width * pageHeight / pageWidth);
    const scaleY = canvas.height / Math.max(1, target.scrollHeight);
    const targetTop = target.getBoundingClientRect().top;
    const semanticBreaks = [...target.querySelectorAll<HTMLElement>('h1,h2,table,.header-title-block')]
      .map((element) => Math.max(0, Math.round((element.getBoundingClientRect().top - targetTop) * scaleY)))
      .filter((value, index, values) => value > 0 && values.indexOf(value) === index)
      .sort((a, b) => a - b);
    const topMargin = Math.round(canvas.width * 10 / pageWidth);
    const bottomMargin = Math.round(canvas.width * 8 / pageWidth);
    const contentScale = 0.94;
    const horizontalOffset = Math.round(canvas.width * (1 - contentScale) / 2);
    let sourceTop = 0;
    let pageIndex = 0;
    while (sourceTop < canvas.height) {
      const pageTop = pageIndex === 0 ? 0 : topMargin;
      const availableHeight = Math.floor((pageCanvasHeight - pageTop - bottomMargin) / contentScale);
      const idealEnd = Math.min(canvas.height, sourceTop + availableHeight);
      const minimumUsefulEnd = sourceTop + Math.round(availableHeight * 0.68);
      const candidateBreaks = semanticBreaks.filter((value) => value >= minimumUsefulEnd && value <= idealEnd);
      const safeBreak = candidateBreaks[candidateBreaks.length - 1];
      const sourceEnd = idealEnd < canvas.height && safeBreak ? safeBreak : idealEnd;
      const segmentHeight = Math.max(1, sourceEnd - sourceTop);
      const pageCanvas = window.document.createElement('canvas');
      pageCanvas.width = canvas.width; pageCanvas.height = pageCanvasHeight;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) throw new Error('No fue posible paginar el documento.');
      pageContext.fillStyle = '#ffffff'; pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(canvas, 0, sourceTop, canvas.width, segmentHeight, horizontalOffset, pageTop, Math.round(canvas.width * contentScale), Math.round(segmentHeight * contentScale));
      if (pageIndex > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      sourceTop = sourceEnd; pageIndex += 1;
    }
    return pdf.output('blob');
  } finally {
    iframe.remove();
  }
};

const makeDocx = async (document: ProjectDocument) => {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const children = blocksFromHtml(document.htmlPreview).map((block) => new Paragraph({
    heading: block.kind === 'title' ? HeadingLevel.TITLE : block.kind === 'heading' ? HeadingLevel.HEADING_2 : undefined,
    bullet: block.kind === 'list' ? { level: 0 } : undefined,
    spacing: { after: block.kind === 'title' ? 260 : 140 },
    children: [new TextRun({ text: block.text, bold: block.kind === 'title' || block.kind === 'heading' })],
  }));
  const output = new Document({ creator: 'Project Hub', title: document.title, description: `Documento v${document.version}`, sections: [{ properties: {}, children }] });
  return Packer.toBlob(output);
};

export const DocumentExportService = {
  createPdfBlob: makePdf,
  createAndStorePdf: async (document: ProjectDocument): Promise<{ blob: Blob; stored: StoredFile }> => {
    const blob = await makePdf(document);
    const stored = await StorageService.uploadGeneratedDocument(document.projectId, document.id, blob, 'pdf');
    return { blob, stored };
  },
  downloadStoredPdf: async (document: ProjectDocument) => {
    const path = document.pdfStoragePath || document.storagePath;
    if (!path) throw new Error('Este documento todavía no tiene un PDF almacenado.');
    const signedUrl = await StorageService.createSignedUrl('project-documents', path, 900);
    if (!signedUrl) throw new Error('En modo local el PDF debe regenerarse para descargarlo.');
    const link = window.document.createElement('a'); link.href = signedUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
    return signedUrl;
  },
  exportAndDownload: async (document: ProjectDocument, format: ExportFormat): Promise<{ blob: Blob; fileName: string; stored: StoredFile }> => {
    const blob = format === 'pdf' ? await makePdf(document) : await makeDocx(document);
    const fileName = `${fileBase(document.title)}-v${document.version}.${format}`;
    const stored = await StorageService.uploadGeneratedDocument(document.projectId, document.id, blob, format);
    download(blob, fileName);
    return { blob, fileName, stored };
  },
  blocksFromHtml,
};
