import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface GeneratePdfOptions {
  filename?: string;
  onProgress?: (message: string, percent: number) => void;
}

/**
 * Generates an official, consolidated multi-page A4 PDF file using jsPDF & html2canvas.
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

  options?.onProgress?.('Iniciando geração do documento consolidado...', 5);

  const pdf = new jsPDF({
    orientation: 'portrait',
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
      windowWidth: 1024,
    });

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    // Standard A4 dimensions in mm: 210 x 297
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  options?.onProgress?.('Gerando arquivo final para download...', 95);

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const defaultFilename = `relatorio_consolidado_abastecimento_sesau_linus_${dateStr}.pdf`;
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
