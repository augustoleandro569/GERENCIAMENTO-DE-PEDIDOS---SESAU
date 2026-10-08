import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface GeneratePdfOptions {
  filename?: string;
  onProgress?: (message: string, percent: number) => void;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Generates an official, consolidated A4 PDF file in landscape orientation (297x210 mm)
 * using jsPDF & html2canvas.
 * Captures each page container tagged with [data-pdf-page] in 2x resolution to guarantee
 * crisp, print-quality vectors, tables, and Linus Soluções branding without page splits.
 */
export async function generateConsolidatedPdf(
  containerElement: HTMLElement,
  options?: GeneratePdfOptions
): Promise<void> {
  const pages = containerElement.querySelectorAll<HTMLElement>('[data-pdf-page]');
  const pageElements = pages.length > 0 ? Array.from(pages) : [containerElement];
  const totalPages = pageElements.length;

  options?.onProgress?.('Iniciando geração do documento consolidado em paisagem...', 5);

  const targetOrientation: 'portrait' | 'landscape' = options?.orientation ?? 'landscape';
  const isLandscape = targetOrientation === 'landscape';
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;

  const pdf = new jsPDF({
    orientation: targetOrientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < totalPages; i++) {
    const pageEl = pageElements[i];
    const pageNum = i + 1;
    const progress = Math.round(10 + (i / totalPages) * 80);

    options?.onProgress?.(`Processando página ${pageNum} de ${totalPages}...`, progress);

    const canvas = await html2canvas(pageEl, {
      scale: 2, // 2x high-DPI scaling for sharp typography and logos
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1400,
    });

    if (i > 0) {
      pdf.addPage('a4', targetOrientation);
    }

    const imgRatio = canvas.width / canvas.height;
    const margin = 4; // 4mm margin for clean printable framing
    const availWidth = pageWidth - (margin * 2);
    const availHeight = pageHeight - (margin * 2);

    let renderWidth = availWidth;
    let renderHeight = renderWidth / imgRatio;

    if (renderHeight > availHeight) {
      renderHeight = availHeight;
      renderWidth = renderHeight * imgRatio;
    }

    const offsetX = margin + Math.max(0, (availWidth - renderWidth) / 2);
    const offsetY = margin + Math.max(0, (availHeight - renderHeight) / 2);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
  }

  options?.onProgress?.('Gerando arquivo final em paisagem para download...', 95);

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const defaultFilename = `relatorio_consolidado_paisagem_sesau_linus_${dateStr}.pdf`;
  const finalFilename = options?.filename || defaultFilename;

  pdf.save(finalFilename);

  options?.onProgress?.('Concluído!', 100);
}

/**
 * Triggers native browser print dialog with dedicated print layout styles.
 */
export function printConsolidatedReport(): void {
  window.print();
}
