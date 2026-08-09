import JSZip from 'jszip';

export interface ExtractedSource {
  file: File;
  text: string;
  warning?: string;
}

const MAX_FILE_BYTES = 15_000_000;
const MAX_EXTRACTED_CHARS = 60_000;
const clean = (value: string) => value.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const truncate = (value: string) => value.length <= MAX_EXTRACTED_CHARS ? value : `${value.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Contenido truncado por seguridad]`;

const extractDocx = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
  const parts: string[] = [];
  for (const name of names) {
    const xml = await zip.file(name)?.async('string');
    if (!xml) continue;
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    const paragraphs = [...parsed.getElementsByTagName('w:p')];
    for (const paragraph of paragraphs) {
      const text = [...paragraph.getElementsByTagName('w:t')].map((node) => node.textContent || '').join('');
      if (text.trim()) parts.push(text.trim());
    }
  }
  return clean(parts.join('\n'));
};

const extractPdf = async (file: File) => {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ');
    pages.push(`[Página ${pageNumber}]\n${text}`);
    if (pages.join('\n').length >= MAX_EXTRACTED_CHARS) break;
  }
  await loadingTask.destroy();
  return clean(pages.join('\n\n'));
};

const extractText = async (file: File) => clean((await file.text())
  .replace(/\d\d:\d\d:\d\d[.,]\d{3}\s+-->\s+\d\d:\d\d:\d\d[.,]\d{3}/g, '')
  .replace(/^WEBVTT.*$/gim, ''));

export const SourceExtractionService = {
  validateFile: (file: File) => {
    if (!file.size || file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: el archivo debe pesar entre 1 byte y 15 MB.`);
    if (!/\.(pdf|docx|txt|vtt)$/i.test(file.name)) throw new Error(`${file.name}: usa PDF, DOCX, TXT o VTT. Los .doc antiguos deben convertirse a .docx.`);
  },
  extractFile: async (file: File): Promise<ExtractedSource> => {
    SourceExtractionService.validateFile(file);
    let text = '';
    if (/\.pdf$/i.test(file.name)) text = await extractPdf(file);
    else if (/\.docx$/i.test(file.name)) text = await extractDocx(file);
    else text = await extractText(file);
    text = truncate(text);
    if (!text) throw new Error(`${file.name}: no se encontró texto legible. Si es un PDF escaneado, aplica OCR antes de subirlo.`);
    return { file, text, warning: text.includes('[Contenido truncado') ? 'Se usaron los primeros 60.000 caracteres.' : undefined };
  },
  maxCombinedChars: 120_000,
};
