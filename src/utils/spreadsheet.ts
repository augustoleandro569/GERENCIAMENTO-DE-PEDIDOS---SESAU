import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { Order, OrderStatus, Schedule } from '../types';
import { cleanUnitName } from './unitNormalizer';
import { computeRealisticItemCount } from './itemQuantity';

// Configure pdfjs worker
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
} catch {
  // Ignore worker setup error if running in non-browser environment
}

export interface ParsedRow {
  codigo: string;
  tipo: string;
  solicitante: string;
  cpf: string;
  programa: string;
  unidade: string;
  status: string;
  itens: number;
  criada_em: string;
  data_solicitacao?: string;
  data_aprovacao?: string;
  data_inicio_separacao?: string;
  data_expedicao?: string;
  data_prevista_entrega?: string;
  validador?: string;
  validada_em?: string;
  separador?: string;
  separada_em?: string;
  entregador?: string;
  entregue_em?: string;
  historico?: string;
  detectedStatusHeader?: string;
  detectedConfidence?: 'ALTA' | 'MÉDIA' | 'BAIXA';
  raw: Record<string, unknown>;
  rowIndex: number;
}

export interface ImportDiffItem {
  row: ParsedRow;
  action: 'NOVO' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'ERRO';
  changes?: { field: string; oldVal: string; newVal: string }[];
  errorMessage?: string;
}

export interface ImportAnalysis {
  fileName: string;
  totalFound: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  errorCount: number;
  detectedStatusHeader?: string;
  detectedConfidence?: 'ALTA' | 'MÉDIA' | 'BAIXA';
  statusBreakdown?: Record<string, number>;
  items: ImportDiffItem[];
}

// Units of measure to reject from hospital unit detection
const MEASURE_UNITS_SET = new Set([
  'UND', 'UN', 'UNID', 'CX', 'CXS', 'CAIXA', 'CAIXAS', 'FR', 'FRASCO', 'FRASCOS',
  'AMP', 'AMPOLA', 'AMPOLAS', 'PCT', 'PCTS', 'PACOTE', 'PACOTES', 'COMP', 'COMPRIMIDO',
  'COMPRIMIDOS', 'BL', 'BLISTER', 'ENV', 'ENVELOPE', 'KG', 'G', 'MG', 'L', 'LT', 'ML',
  'ROLO', 'ROLOS', 'PAR', 'PARES', 'TUBO', 'TUBOS', 'GALAO', 'SERINGA', 'AGULHA'
]);

// Normalize column header strings for resilient matching
function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Robust Brazilian number parser for spreadsheet quantities.
 * Prevents truncating "1.000" (mil) to 1.
 */
function parseQuantitySafe(val: unknown): number {
  if (val === null || val === undefined || val === '') return 1;
  if (typeof val === 'number') {
    return Math.max(1, Math.round(val));
  }
  const s = String(val).trim();
  if (!s) return 1;

  // Pattern: Brazilian thousands with dots (e.g. 1.000, 15.000, 1.250,00)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    const clean = s.replace(/\./g, '').replace(',', '.');
    const num = Math.round(parseFloat(clean));
    return isNaN(num) || num <= 0 ? 1 : num;
  }

  // Pattern: Decimal with comma (e.g. 25,00 or 14,5)
  if (/^\d+,\d+$/.test(s)) {
    const num = Math.round(parseFloat(s.replace(',', '.')));
    return isNaN(num) || num <= 0 ? 1 : num;
  }

  // Standard digits
  const cleanDigits = s.replace(/[^0-9]/g, '');
  const num = parseInt(cleanDigits, 10);
  return isNaN(num) || num <= 0 ? 1 : num;
}

/**
 * Normalizes any free-form status string from Portuguese hospital spreadsheets
 * and ERPs (MV, AGHUse, Vivace, SIAS, SIGEP, Planilhas SESAU) into the official OrderStatus.
 * Preserves exact statuses: RASCUNHO, AGUARDANDO VALIDAÇÃO, APROVADO, AGUARDANDO SEPARAÇÃO,
 * EM SEPARAÇÃO, AGUARDANDO CONFERENCIA, EM CONFERENCIA, EXPEDIDA, EM TRANSPORTE,
 * ENTREGUE, ENTREGUE PARCIALMENTE, CANCELADO.
 */
export function normalizeOrderStatus(val: unknown): OrderStatus {
  if (val === null || val === undefined) return 'Aguardando Validação';
  const str = String(val).trim();
  if (!str) return 'Aguardando Validação';

  const clean = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const lower = clean.toLowerCase();

  // 1. Direct EXACT matches for all standard hospital workflow statuses
  if (clean === 'RASCUNHO') return 'Rascunho';
  if (clean === 'AGUARDANDO VALIDACAO' || clean === 'AGUARDANDO A VALIDACAO' || clean === 'EM VALIDACAO' || clean === 'VALIDACAO') return 'Aguardando Validação';
  if (clean === 'AGUARDANDO APROVACAO' || clean === 'AGUARDANDO A APROVACAO' || clean === 'EM APROVACAO') return 'Aguardando Aprovação';
  if (clean === 'APROVADO') return 'Aprovado';
  if (clean === 'APROVADA') return 'Aprovada';
  if (clean === 'AGUARDANDO SEPARACAO' || clean === 'AGUARDANDO A SEPARACAO') return 'Aguardando Separação';
  if (clean === 'EM SEPARACAO' || clean === 'SEPARANDO') return 'Em Separação';
  if (clean === 'AGUARDANDO CONFERENCIA' || clean === 'AGUARDANDO A CONFERENCIA') return 'Aguardando Conferência';
  if (clean === 'EM CONFERENCIA' || clean === 'CONFERINDO') return 'Em Conferência';
  if (clean === 'EXPEDIDA' || clean === 'EXPEDIDO') return 'Expedida';
  if (clean === 'EM TRANSPORTE' || clean === 'TRANSPORTE' || clean === 'EM TRANSITO' || clean === 'TRANSITO') return 'Em Transporte';
  if (clean === 'ENTREGUE PARCIALMENTE' || clean === 'ENTREGA PARCIAL' || clean === 'PARCIALMENTE ENTREGUE' || clean === 'PARCIAL') return 'Entregue Parcialmente';
  if (clean === 'ENTREGUE' || clean === 'ENTREGADO' || clean === 'ENTREGADA') return 'Entregue';
  if (clean === 'CANCELADO') return 'Cancelado';
  if (clean === 'CANCELADA') return 'Cancelada';
  if (clean === 'REJEITADA' || clean === 'REJEITADO') return 'Rejeitada';

  // 2. Cancellation / Rejection
  if (lower.includes('cancelad') || lower.includes('anulad')) return 'Cancelado';
  if (lower.includes('rejeitad') || lower.includes('reprovad') || lower.includes('glosad') || lower.includes('recusad')) return 'Rejeitada';

  // 3. Partial Delivery (Must be tested before full delivery)
  if (lower.includes('parcial')) return 'Entregue Parcialmente';

  // 4. Full Delivery / Attended
  if (lower.includes('entreg') || lower.includes('atendid') || lower.includes('concluid') || lower.includes('finalizad') || lower.includes('recebid') || lower.includes('baixad')) {
    return 'Entregue';
  }

  // 5. In Transit / Transport
  if (lower.includes('transporte') || lower.includes('transito') || lower.includes('em rota') || lower.includes('despachado') || lower.includes('saiu para entrega') || lower.includes('viagem')) {
    return 'Em Transporte';
  }

  // 6. Expedited / Dispatched
  if (lower.includes('expedid') || lower.includes('expedicao') || lower.includes('embalad') || lower.includes('pronto para envio')) {
    return 'Expedida';
  }

  // 7. Conference
  if (lower.includes('em conferencia') || lower.includes('conferindo')) {
    return 'Em Conferência';
  }
  if (lower.includes('aguardando conferencia') || lower.includes('fila de conferencia') || lower.includes('conferid')) {
    return 'Aguardando Conferência';
  }

  // 8. Separation / Picking
  if (lower.includes('em separacao') || lower.includes('separando') || lower.includes('em atendimento') || lower.includes('atendendo')) {
    return 'Em Separação';
  }
  if (lower.includes('aguardando separacao') || lower.includes('fila de separacao') || lower.includes('separad')) {
    return 'Aguardando Separação';
  }

  // 9. Awaiting Validation / Approval (MUST check "aguardando validacao" before general approval)
  if (lower.includes('aguardando validacao') || lower.includes('para validacao') || lower.includes('pendente validacao')) {
    return 'Aguardando Validação';
  }
  if (lower.includes('aguardando aprovacao') || lower.includes('para aprovacao') || lower.includes('pendente aprovacao') || lower.includes('solicitad') || lower.includes('pendente') || lower.includes('em analise')) {
    return 'Aguardando Aprovação';
  }

  // 10. Approved / Validated
  if (lower.includes('aprovado')) return 'Aprovado';
  if (lower.includes('aprovad') || lower.includes('validada') || lower.includes('validado') || lower.includes('autorizad') || lower.includes('confirmad') || lower.includes('liberad')) {
    return 'Aprovada';
  }

  // 11. Draft
  if (lower.includes('rascunho') || lower.includes('digitacao') || lower.includes('elaboracao')) {
    return 'Rascunho';
  }

  // Standard case-sensitive exact match fallback:
  const standardStatuses: OrderStatus[] = [
    'Rascunho', 'Aguardando Validação', 'Aguardando Aprovação', 'Aprovado', 'Aprovada', 
    'Aguardando Separação', 'Em Separação', 'Aguardando Conferência', 'Em Conferência', 
    'Expedida', 'Em Transporte', 'Entregue', 'Entregue Parcialmente', 'Cancelado', 'Cancelada', 'Rejeitada'
  ];
  const exact = standardStatuses.find(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === lower);
  if (exact) return exact;

  return 'Aguardando Validação';
}

// Checks if a row is a junk/noise line (e.g. repeated headers, subtotals, page footers, summary lines)
function isJunkOrSubtotalRow(firstFewValues: string[]): boolean {
  const combined = firstFewValues.join(' ').toLowerCase();
  if (
    combined.includes('total geral') ||
    combined.includes('subtotal') ||
    combined.includes('total de pedidos') ||
    combined.includes('total de itens') ||
    combined.includes('quantidade total') ||
    combined.includes('quantidade importada') ||
    combined.includes('itens importados') ||
    combined.includes('pagina') ||
    combined.includes('página') ||
    combined.includes('emitido em') ||
    combined.includes('extraido em') ||
    combined.includes('sistema integrado') ||
    combined.includes('relatorio operacional') ||
    combined.includes('secretaria de estado') ||
    combined.includes('governo de alagoas') ||
    combined.includes('competencia:')
  ) {
    return true;
  }
  return false;
}

/**
 * Universal Parser for Spreadsheets (.xlsx, .xls, .csv) and PDF reports (.pdf).
 * Solves:
 * 1. Wrong line reading by detecting mid-page repeats and skipping subtotal rows.
 * 2. Wrong quantity by isolating the true item quantity column and rejecting sequence/item number columns.
 * 3. Multi-line orders (aggregation of multiple items belonging to the same solicitation code).
 * 4. Automatic unit normalization mapping legacy truncated names to official SESAU units.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return parsePdfReport(file);
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  
  // Find the sheet that has the actual order data
  let targetSheet = workbook.Sheets[workbook.SheetNames[0]];
  let maxScore = -1;

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!data || data.length === 0) continue;

    // Score sheet based on order headers
    let sheetScore = 0;
    for (let r = 0; r < Math.min(data.length, 15); r++) {
      const row = data[r];
      if (Array.isArray(row)) {
        const norm = row.map(c => normalizeKey(String(c || '')));
        if (norm.some(k => k.includes('solicitacao') || k.includes('pedido'))) sheetScore += 50;
        if (norm.some(k => k.includes('unidade') || k.includes('hospital'))) sheetScore += 30;
        if (norm.some(k => k.includes('quantidade') || k.includes('qtd'))) sheetScore += 20;
      }
    }
    sheetScore += data.length; // tie-breaker: number of rows
    if (sheetScore > maxScore) {
      maxScore = sheetScore;
      targetSheet = ws;
    }
  }

  // Convert to 2D array of rows with default empty strings to preserve column indices
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, raw: false, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('A planilha está vazia.');
  }

  // Detect header row with high precision scoring
  let headerRowIndex = -1;
  let detectedHeaders: string[] = [];
  let bestHeaderScore = -1;

  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      const rowNormalized = row.map(cell => normalizeKey(String(cell || '')));
      let score = 0;

      // Order code presence
      if (rowNormalized.some(c => 
        (c.includes('solicitacao') || c.includes('pedido') || c === 'codigo' || c === 'cod') &&
        !c.includes('item') && !c.includes('produto') && !c.includes('material') && !c.includes('tci')
      )) {
        score += 50;
      }

      // Unit/hospital presence
      if (rowNormalized.some(c => 
        c.includes('unidade') || c.includes('hospital') || c.includes('destino') || c.includes('programa')
      )) {
        score += 30;
      }

      // Quantity presence
      if (rowNormalized.some(c => c.includes('quantidade') || c.includes('qtd') || c === 'itens')) {
        score += 20;
      }

      // Date or status presence
      if (rowNormalized.some(c => c.includes('data') || c.includes('status') || c.includes('situacao'))) {
        score += 15;
      }

      if (score > bestHeaderScore && score >= 45) {
        bestHeaderScore = score;
        headerRowIndex = i;
        detectedHeaders = row.map(cell => String(cell || '').trim());
      }
    }
  }

  // Fallback to first non-empty row if scoring didn't trigger
  if (headerRowIndex === -1) {
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i];
      if (Array.isArray(row) && row.filter(Boolean).length >= 4) {
        headerRowIndex = i;
        detectedHeaders = row.map(cell => String(cell || '').trim());
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    detectedHeaders = Array.isArray(rawRows[0]) ? rawRows[0].map(c => String(c || '').trim()) : [];
  }

  // Scored column index detection
  let colIndexCodigo = -1;
  let codeScore = -1;

  let colIndexUnidade = -1;
  let unitScore = -1;

  let colIndexQtdItens = -1;
  let qtdScore = -1;

  let colIndexTipo = -1;
  let colIndexSolicitante = -1;
  let colIndexCpf = -1;
  let colIndexPrograma = -1;
  let colIndexStatus = -1;
  let statusScore = -1;
  let colIndexDataSolicitacao = -1;
  let colIndexDataAprovacao = -1;
  let colIndexDataSeparacao = -1;
  let colIndexDataExpedicao = -1;
  let colIndexDataEntrega = -1;
  let colIndexValidador = -1;
  let colIndexSeparador = -1;
  let colIndexEntregador = -1;
  let colIndexHistorico = -1;

  detectedHeaders.forEach((rawCol, idx) => {
    const k = normalizeKey(rawCol);
    if (!k) return;

    // 1. ORDER CODE: strictly order/solicitation identifiers!
    // NEVER match product/material/item identifiers like "Código Material", "Código TCI", "Item", "Cód. Produto"
    const isMaterialOrProduct = k.includes('material') || k.includes('produto') || k.includes('medicamento') || 
                                k.includes('insumo') || k.includes('tci') || k.includes('catmat') || 
                                k.includes('barras') || k.includes('ean') || k.includes('lote') || k.includes('subitem');

    if (!isMaterialOrProduct) {
      if (k === 'numsolicitacao' || k === 'numerosolicitacao' || k === 'numpedido' || k === 'numeropedido' ||
          k === 'codigosolicitacao' || k === 'codigopedido' || k === 'solicitacao' || k === 'pedido') {
        if (100 > codeScore) {
          colIndexCodigo = idx;
          codeScore = 100;
        }
      } else if ((k.includes('solicitacao') || k.includes('pedido')) && !k.includes('item')) {
        if (80 > codeScore) {
          colIndexCodigo = idx;
          codeScore = 80;
        }
      } else if ((k === 'codigo' || k === 'cod') && !k.includes('item') && !k.includes('unidade') && !k.includes('cidade')) {
        if (50 > codeScore) {
          colIndexCodigo = idx;
          codeScore = 50;
        }
      }
    }

    // 2. HOSPITAL UNIT: strictly hospital/destination health unit!
    // NEVER match unit of measure like "Unidade Medida", "UND", "Unid. Medida", "Embalagem"
    const isUnitOfMeasure = k.includes('medida') || k.includes('embalagem') || k.includes('fracao') || 
                            k.includes('dispensacao') || k === 'und' || k === 'unid' || k === 'um';

    if (!isUnitOfMeasure) {
      if (k === 'unidadesolicitante' || k === 'unidaderequisitante' || k === 'unidadehospitalar' || 
          k === 'hospital' || k === 'hospitaldestino' || k === 'estabelecimentosaude' || k === 'postosolicitante' ||
          k === 'localdestino' || k === 'clientedestino') {
        if (100 > unitScore) {
          colIndexUnidade = idx;
          unitScore = 100;
        }
      } else if (k.includes('hospital') || k.includes('destino') || k.includes('requisita')) {
        if (80 > unitScore) {
          colIndexUnidade = idx;
          unitScore = 80;
        }
      } else if (k.includes('unidade') || k.includes('sigla')) {
        if (50 > unitScore) {
          colIndexUnidade = idx;
          unitScore = 50;
        }
      }
    }

    // 3. QUANTITY OF ITEMS: strictly item count / ordered quantity!
    // NEVER match row index / sequence columns like "Item", "Seq", "Nº", "Ordem", "Linha"
    // NEVER match prices/values like "Valor Total", "Preço", "Custo"
    const isPriceOrValue = k.includes('preco') || k.includes('valor') || k.includes('custo') || k.includes('totalrs');
    const isSequenceIndex = k === 'item' || k === 'seq' || k === 'sequencia' || k === 'ordem' || k === 'linha' || k === 'posicao';

    if (!isPriceOrValue && !isSequenceIndex) {
      if (k === 'totalitens' || k === 'totaldeitens' || k === 'quantidadedeitens' || k === 'qtditens' || 
          k === 'quantidadetotal' || k === 'totalprodutos' || k === 'qtdprodutos') {
        if (100 > qtdScore) {
          colIndexQtdItens = idx;
          qtdScore = 100;
        }
      } else if (k.includes('quantidadesolicitada') || k.includes('qtdsolicitada') || k.includes('quantidadepedida') || k.includes('qtdpedida')) {
        if (80 > qtdScore) {
          colIndexQtdItens = idx;
          qtdScore = 80;
        }
      } else if (k.includes('quantidadeatendida') || k.includes('qtdatendida') || k.includes('quantidadedispensada') || k.includes('qtddispensada') || k.includes('quantidadefornecida')) {
        if (70 > qtdScore) {
          colIndexQtdItens = idx;
          qtdScore = 70;
        }
      } else if (k.includes('quantidade') || k.includes('qtd') || k === 'quant') {
        if (50 > qtdScore) {
          colIndexQtdItens = idx;
          qtdScore = 50;
        }
      } else if (k === 'itens') {
        if (40 > qtdScore) {
          colIndexQtdItens = idx;
          qtdScore = 40;
        }
      }
    }

    // 4. Type: Mensal, Emergencial, Falta, Semanal
    if (k.includes('tipo') && !k.includes('item') && !k.includes('evento')) {
      if (colIndexTipo === -1) colIndexTipo = idx;
    }
    // 5. Solicitante
    else if (k.includes('solicitante') || k.includes('responsavel') || k.includes('usuario')) {
      if (colIndexSolicitante === -1) colIndexSolicitante = idx;
    }
    // 6. CPF
    else if (k.includes('cpf')) {
      if (colIndexCpf === -1) colIndexCpf = idx;
    }
    // 7. Programa
    else if (k.includes('programa')) {
      if (colIndexPrograma === -1) colIndexPrograma = idx;
    }
    // 8. ORDER STATUS (Prioritize overall order lifecycle over delivery/checkpoint status!)
    const isDeliveryStatus = k.includes('entrega') || k.includes('transporte') || k.includes('despacho') || k.includes('envio');
    const isItemStatus = k.includes('item') || k.includes('material') || k.includes('produto') || k.includes('tci') || k.includes('lote');
    const isPaymentStatus = k.includes('pagamento') || k.includes('financeiro') || k.includes('nota') || k.includes('faturamento') || k.includes('fiscal');

    if (!isPaymentStatus) {
      if (k === 'statusoperacional' || k === 'statuspedido' || k === 'situacaopedido' || 
          k === 'situacaosolicitacao' || k === 'statussolicitacao' || k === 'statusgeral' || 
          k === 'situacaogeral' || k === 'posicaopedido' || k === 'fasedopedido' || k === 'fasesolicitacao') {
        if (100 > statusScore) {
          colIndexStatus = idx;
          statusScore = 100;
        }
      } else if ((k.includes('status') || k.includes('situacao') || k.includes('fase') || k.includes('etapa') || k.includes('posicao') || k.includes('andamento')) && 
                 !isDeliveryStatus && !isItemStatus) {
        if (80 > statusScore) {
          colIndexStatus = idx;
          statusScore = 80;
        }
      } else if ((k === 'status' || k === 'situacao' || k === 'fase' || k === 'etapa') && !isDeliveryStatus) {
        if (70 > statusScore) {
          colIndexStatus = idx;
          statusScore = 70;
        }
      } else if (isDeliveryStatus && (k.includes('status') || k.includes('situacao') || k.includes('fase') || k.includes('etapa'))) {
        // Delivery status column (e.g. "Status da Entrega") - only fallback with score 30
        if (30 > statusScore) {
          colIndexStatus = idx;
          statusScore = 30;
        }
      } else if (isItemStatus && (k.includes('status') || k.includes('situacao'))) {
        if (20 > statusScore) {
          colIndexStatus = idx;
          statusScore = 20;
        }
      }
    }

    // 9. Dates
    if (k.includes('solicitacao') && (k.includes('data') || k.includes('dt') || k.includes('emissao') || k.includes('criacao'))) {
      if (colIndexDataSolicitacao === -1) colIndexDataSolicitacao = idx;
    }
    else if (k.includes('aprovacao') && (k.includes('data') || k.includes('dt') || k.includes('autorizacao'))) {
      if (colIndexDataAprovacao === -1) colIndexDataAprovacao = idx;
    }
    else if (k.includes('separacao') && (k.includes('data') || k.includes('dt') || k.includes('inicio'))) {
      if (colIndexDataSeparacao === -1) colIndexDataSeparacao = idx;
    }
    else if (k.includes('expedicao') && (k.includes('data') || k.includes('dt') || k.includes('saida') || k.includes('envio'))) {
      if (colIndexDataExpedicao === -1) colIndexDataExpedicao = idx;
    }
    else if ((k.includes('entrega') || k.includes('prevista') || k === 'entrega' || k === 'previsao') && 
             (k.includes('data') || k.includes('dt') || k.includes('previsao') || k.includes('prevista') || k === 'entrega')) {
      if (colIndexDataEntrega === -1) colIndexDataEntrega = idx;
    }
    // 10. Operators
    else if (k.includes('validador')) {
      if (colIndexValidador === -1) colIndexValidador = idx;
    }
    else if (k.includes('separador')) {
      if (colIndexSeparador === -1) colIndexSeparador = idx;
    }
    else if (k.includes('entregador') || k.includes('motorista')) {
      if (colIndexEntregador === -1) colIndexEntregador = idx;
    }
    // 11. History / Notes
    else if (k.includes('historico') || k.includes('observacao') || k.includes('obs')) {
      if (colIndexHistorico === -1) colIndexHistorico = idx;
    }
  });

  // Data Inspection & Disambiguation:
  // Check the first 15 data rows to verify column assignments
  const sampleDataRows = rawRows.slice(headerRowIndex + 1, headerRowIndex + 16);

  // If detected unit column actually contains units of measure (UND, UN, CX, FR), find another candidate!
  if (colIndexUnidade !== -1) {
    let unitOfMeasureMatches = 0;
    for (const r of sampleDataRows) {
      if (Array.isArray(r)) {
        const val = String(r[colIndexUnidade] || '').trim().toUpperCase();
        if (MEASURE_UNITS_SET.has(val)) {
          unitOfMeasureMatches++;
        }
      }
    }

    if (unitOfMeasureMatches >= 2) {
      // colIndexUnidade was falsely pointing to unit of measure! Discard it and find a true hospital unit column
      colIndexUnidade = -1;
      for (let c = 0; c < detectedHeaders.length; c++) {
        const k = normalizeKey(detectedHeaders[c]);
        if (k.includes('medida') || k === 'unidade' || k === 'und' || k === 'unid') continue;

        let hospitalMatches = 0;
        for (const r of sampleDataRows) {
          if (Array.isArray(r)) {
            const val = String(r[c] || '').trim();
            const norm = val.toUpperCase();
            if (norm.includes('HOSP') || norm.includes('UPA') || norm.includes('HGE') || 
                norm.includes('HMA') || norm.includes('HEMOAL') || norm.includes('SAMU') ||
                norm.includes('LACEN') || norm.includes('MATERNIDADE') || norm.includes('CLINICA')) {
              hospitalMatches++;
            }
          }
        }
        if (hospitalMatches >= 2) {
          colIndexUnidade = c;
          break;
        }
      }
    }
  }

  // If order code was not found or was pointing to product code (e.g. TCI), search for real order code
  if (colIndexCodigo === -1 || codeScore < 80) {
    for (let c = 0; c < detectedHeaders.length; c++) {
      let solCount = 0;
      for (const r of sampleDataRows) {
        if (Array.isArray(r)) {
          const val = String(r[c] || '').trim().toUpperCase();
          if (val.startsWith('SOL-') || /^\d{5,8}$/.test(val)) {
            solCount++;
          }
        }
      }
      if (solCount >= 2) {
        colIndexCodigo = c;
        break;
      }
    }
  }

  // If quantity column was pointing to sequence column (1, 2, 3, 4, 5...), find true quantity column
  if (colIndexQtdItens !== -1 && qtdScore < 80) {
    let isPureSequence = true;
    let seqVal = 1;
    for (const r of sampleDataRows) {
      if (Array.isArray(r)) {
        const val = parseInt(String(r[colIndexQtdItens] || ''), 10);
        if (val !== seqVal) {
          isPureSequence = false;
          break;
        }
        seqVal++;
      }
    }

    if (isPureSequence && sampleDataRows.length >= 3) {
      // It was just row numbers 1, 2, 3! Search for an actual quantity column
      for (let c = 0; c < detectedHeaders.length; c++) {
        if (c === colIndexQtdItens) continue;
        const k = normalizeKey(detectedHeaders[c]);
        if (k.includes('qtd') || k.includes('quant') || k.includes('atend') || k.includes('solic')) {
          colIndexQtdItens = c;
          break;
        }
      }
    }
  }

  // 4. STATUS DISAMBIGUATION:
  // If the detected status column has 100% "Entregue" or was a delivery checkpoint column (score < 80),
  // check whether another column in the spreadsheet contains true order lifecycle statuses!
  if (colIndexStatus !== -1 && sampleDataRows.length >= 2) {
    let allEntregueCount = 0;
    for (const r of sampleDataRows) {
      if (Array.isArray(r)) {
        const val = normalizeOrderStatus(String(r[colIndexStatus] || ''));
        if (val === 'Entregue') {
          allEntregueCount++;
        }
      }
    }

    // If every row in the sample is "Entregue" and statusScore is not top priority (score < 90),
    // search if there is another column with diverse order statuses
    if (allEntregueCount === sampleDataRows.length && statusScore < 90) {
      for (let c = 0; c < detectedHeaders.length; c++) {
        if (c === colIndexStatus) continue;
        const k = normalizeKey(detectedHeaders[c]);
        if (k.includes('entrega') || k.includes('data') || k.includes('dt') || k.includes('medida')) continue;

        let hasDiverseStatuses = false;
        for (const r of sampleDataRows) {
          if (Array.isArray(r)) {
            const val = normalizeOrderStatus(String(r[c] || ''));
            if (val !== 'Entregue' && val !== 'Aguardando Aprovação') {
              hasDiverseStatuses = true;
              break;
            }
          }
        }
        if (hasDiverseStatuses) {
          colIndexStatus = c;
          statusScore = 85;
          break;
        }
      }
    }
  }

  // Process rows
  const ordersMap = new Map<string, ParsedRow>();
  const rowsList: ParsedRow[] = [];
  let lastActiveOrderCode = '';
  let lastActiveUnit = '';

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if row is empty or a subtotal / page footer / header repeat
    const strValues = row.map(cell => String(cell || '').trim());
    if (strValues.every(v => !v)) continue;

    if (isJunkOrSubtotalRow(strValues)) {
      continue;
    }

    // Check if this row is a repeated header (e.g. at the start of a new page)
    const normValues = strValues.map(v => normalizeKey(v));
    const headerMatchCount = normValues.filter(v => 
      v.includes('codigo') || v.includes('solicitacao') || v.includes('pedido') || 
      v.includes('unidade') || v.includes('hospital') || v.includes('quantidade') || v === 'itens'
    ).length;

    if (headerMatchCount >= 2) {
      continue;
    }

    // Extract values using detected column indices
    let codigo = colIndexCodigo !== -1 ? strValues[colIndexCodigo] || '' : '';
    let tipo = colIndexTipo !== -1 ? strValues[colIndexTipo] || 'Mensal' : 'Mensal';
    let solicitante = colIndexSolicitante !== -1 ? strValues[colIndexSolicitante] || '' : '';
    let cpf = colIndexCpf !== -1 ? strValues[colIndexCpf] || '' : '';
    let programa = colIndexPrograma !== -1 ? strValues[colIndexPrograma] || 'Hospitalar' : 'Hospitalar';
    let rawUnidade = colIndexUnidade !== -1 ? strValues[colIndexUnidade] || '' : '';
    
    // Status Normalization: Convert Portuguese ERP terminology to standard OrderStatus
    let rawStatus = colIndexStatus !== -1 ? strValues[colIndexStatus] || 'Aguardando Aprovação' : 'Aguardando Aprovação';
    let status = normalizeOrderStatus(rawStatus);

    // Quantity parsing with Brazilian format support
    let itens = 1;
    if (colIndexQtdItens !== -1) {
      itens = parseQuantitySafe(strValues[colIndexQtdItens]);
    }

    // Additional fields
    const data_solicitacao = colIndexDataSolicitacao !== -1 ? strValues[colIndexDataSolicitacao] : undefined;
    const data_aprovacao = colIndexDataAprovacao !== -1 ? strValues[colIndexDataAprovacao] : undefined;
    const data_inicio_separacao = colIndexDataSeparacao !== -1 ? strValues[colIndexDataSeparacao] : undefined;
    const data_expedicao = colIndexDataExpedicao !== -1 ? strValues[colIndexDataExpedicao] : undefined;
    const data_prevista_entrega = colIndexDataEntrega !== -1 ? strValues[colIndexDataEntrega] : undefined;
    const validador = colIndexValidador !== -1 ? strValues[colIndexValidador] : undefined;
    const separador = colIndexSeparador !== -1 ? strValues[colIndexSeparador] : undefined;
    const entregador = colIndexEntregador !== -1 ? strValues[colIndexEntregador] : undefined;
    const historico = colIndexHistorico !== -1 ? strValues[colIndexHistorico] : undefined;

    // Excel merged-cell inheritance:
    // If codigo is empty but there was a previous order and this row contains medicine/item data:
    if (!codigo && lastActiveOrderCode && strValues.some(v => v.length > 0)) {
      codigo = lastActiveOrderCode;
      if (!rawUnidade && lastActiveUnit) {
        rawUnidade = lastActiveUnit;
      }
    }

    // If order code is missing, verify if it can be found in first column
    if (!codigo) {
      const firstVal = strValues[0];
      if (firstVal && (firstVal.toUpperCase().startsWith('SOL-') || /^\d{4,8}$/.test(firstVal))) {
        codigo = firstVal;
      }
    }

    // Skip rows that have neither code nor unit
    if (!codigo && !rawUnidade) {
      continue;
    }

    // Clean up code formatting: strictly standardize to SOL-2026-XXXXX
    codigo = codigo.trim().toUpperCase();
    if (!codigo.startsWith('SOL-2026-')) {
      const digits = codigo.replace(/\D/g, '');
      if (digits) {
        codigo = `SOL-2026-${digits.padStart(5, '0')}`;
      } else {
        // Discard non-standard row that does not have a valid order code
        continue;
      }
    }

    // Normalization of unit name (cleans "UPA DR. CL", "HCB - HOSP", "HEMOAL - T", etc.)
    const cleanUnit = cleanUnitName(rawUnidade);

    // Keep track of active order and unit for merged cells
    if (codigo) lastActiveOrderCode = codigo;
    if (cleanUnit) lastActiveUnit = cleanUnit;

    if (itens <= 1) {
      itens = computeRealisticItemCount({
        codigo,
        tipo,
        unidade: cleanUnit,
        programa,
        quantidade_itens: itens
      });
    }

    // Multi-line order aggregation:
    // If the spreadsheet lists multiple items for the SAME solicitation code:
    // Aggregate the line items into the existing order instead of creating duplicates!
    if (ordersMap.has(codigo)) {
      const existing = ordersMap.get(codigo)!;
      // If the column was an explicit total items header (qtdScore >= 100), keep the total
      if (qtdScore < 100) {
        if (colIndexQtdItens !== -1) {
          const rowItemQty = parseQuantitySafe(strValues[colIndexQtdItens]);
          existing.itens += rowItemQty;
        } else {
          existing.itens += 1;
        }
      }
      continue;
    }

    const parsedRow: ParsedRow = {
      codigo: codigo,
      tipo: tipo || 'Mensal',
      solicitante: solicitante || 'Solicitante SESAU',
      cpf: cpf || '—',
      programa: programa || 'Hospitalar',
      unidade: cleanUnit,
      status: status || 'Aguardando Aprovação',
      itens,
      criada_em: data_solicitacao || new Date().toISOString(),
      data_solicitacao,
      data_aprovacao,
      data_inicio_separacao,
      data_expedicao,
      data_prevista_entrega,
      validador,
      separador,
      entregador,
      historico,
      detectedStatusHeader: colIndexStatus !== -1 ? detectedHeaders[colIndexStatus] : undefined,
      detectedConfidence: statusScore >= 80 ? 'ALTA' : (statusScore >= 50 ? 'MÉDIA' : 'BAIXA'),
      raw: Object.fromEntries(row.map((val, idx) => [detectedHeaders[idx] || `col_${idx}`, val])),
      rowIndex: r + 1,
    };

    ordersMap.set(parsedRow.codigo, parsedRow);
    rowsList.push(parsedRow);
  }

  if (rowsList.length === 0) {
    throw new Error('Nenhum pedido operacional foi identificado na planilha.');
  }

  return rowsList;
}

/**
 * Extracts orders from PDF reports (e.g. RELATORIO PEDIDOS.pdf)
 * Parses tabular layout from PDF text elements page-by-page.
 */
async function parsePdfReport(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const parsedOrders: ParsedRow[] = [];
  const ordersByCode = new Map<string, ParsedRow>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by Y-coordinate to reconstruct rows
    const rowsByY = new Map<number, { text: string; x: number }[]>();
    
    textContent.items.forEach((item: any) => {
      if (!('str' in item) || !item.str.trim()) return;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      
      // Find matching row with tolerance of 4 pixels
      let matchedY = y;
      for (const existingY of rowsByY.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedY = existingY;
          break;
        }
      }

      const list = rowsByY.get(matchedY) || [];
      list.push({ text: item.str.trim(), x });
      rowsByY.set(matchedY, list);
    });

    // Sort rows from top of page to bottom
    const sortedY = Array.from(rowsByY.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const lineItems = rowsByY.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);
      const lineText = lineItems.map(i => i.text).join(' ');

      if (isJunkOrSubtotalRow([lineText])) continue;

      // Check if line contains an order code (e.g. SOL-2026-03074 or similar)
      const solMatch = lineText.match(/(SOL[-_\s]?\d{4}[-_\s]?\d{4,6}|\bSOL[-_]?\d{4,6}\b)/i);
      if (!solMatch) continue;

      const codeRaw = solMatch[0].replace(/\s+/g, '-').toUpperCase();
      const code = codeRaw.startsWith('SOL-') ? codeRaw : `SOL-${codeRaw}`;

      // Extract quantity: look for numbers like "23 itens" or standalone integer count
      let itemsCount = 1;
      const qtdMatch = lineText.match(/(\d+)\s*(?:itens|unidades|itens)?/i);
      if (qtdMatch) {
        itemsCount = parseQuantitySafe(qtdMatch[1]);
      }

      // Extract unit using normalizer
      const unit = cleanUnitName(lineText);

      // Extract status using normalization and word-boundary matching
      let status: OrderStatus = 'Aguardando Aprovação';
      const statusOptions: OrderStatus[] = [
        'Entregue Parcialmente', 'Aguardando Aprovação', 'Aguardando Separação', 
        'Aguardando Conferência', 'Em Separação', 'Em Conferência', 'Em Transporte', 
        'Expedida', 'Aprovada', 'Entregue', 'Rejeitada', 'Cancelada'
      ];
      for (const st of statusOptions) {
        const regex = new RegExp(`\\b${st.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (regex.test(lineText)) {
          status = st;
          break;
        }
      }

      // Extract type
      let tipo = 'Mensal';
      ['Mensal', 'Emergencial', 'Falta', 'Semanal', 'Quinzenal'].forEach(t => {
        if (lineText.toLowerCase().includes(t.toLowerCase())) tipo = t;
      });

      // Extract date if present (DD/MM/YYYY)
      const dateMatch = lineText.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dateFormatted = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('pt-BR');

      if (ordersByCode.has(code)) {
        // Increment items for repeated code
        ordersByCode.get(code)!.itens += 1;
      } else {
        const orderRow: ParsedRow = {
          codigo: code,
          tipo,
          solicitante: 'Solicitante SESAU',
          cpf: '—',
          programa: 'Hospitalar',
          unidade: unit,
          status,
          itens: itemsCount > 1 ? itemsCount : computeRealisticItemCount({ codigo: code, tipo, unidade: unit, quantidade_itens: itemsCount }),
          criada_em: dateFormatted,
          data_solicitacao: dateFormatted,
          historico: `Importado de Relatório PDF (${file.name})`,
          raw: { lineText },
          rowIndex: parsedOrders.length + 1,
        };
        ordersByCode.set(code, orderRow);
        parsedOrders.push(orderRow);
      }
    }
  }

  if (parsedOrders.length === 0) {
    throw new Error('Não foi possível identificar linhas operacionais de pedidos no arquivo PDF.');
  }

  return parsedOrders;
}

export function analyzeImport(parsedRows: ParsedRow[], currentOrders: Order[], fileName: string): ImportAnalysis {
  const currentByCode = new Map<string, Order>();
  currentOrders.forEach(o => currentByCode.set(o.codigo.toLowerCase().trim(), o));

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  const diffItems: ImportDiffItem[] = parsedRows.map(row => {
    // Strictly enforce SOL-2026 standard
    if (!row.codigo || !row.codigo.toUpperCase().startsWith('SOL-2026-')) {
      errorCount++;
      return {
        row,
        action: 'ERRO',
        error: 'O código do pedido não segue a padronização oficial "SOL-2026-...". Pedidos sem padronização são descartados.',
      };
    }

    const existing = currentByCode.get(row.codigo.toLowerCase().trim());

    if (!existing) {
      newCount++;
      return {
        row,
        action: 'NOVO',
      };
    }

    // Check changes comprehensively across all order fields
    const changes: { field: string; oldVal: string; newVal: string }[] = [];

    // Status check: compare with both operational and origin status
    if (row.status && (row.status !== existing.status_operacional || row.status !== existing.status_origem)) {
      changes.push({
        field: 'Status',
        oldVal: existing.status_operacional,
        newVal: row.status,
      });
    }

    if (row.unidade && row.unidade !== existing.unidade) {
      changes.push({
        field: 'Unidade',
        oldVal: existing.unidade,
        newVal: row.unidade,
      });
    }

    if (row.itens && row.itens !== existing.quantidade_itens) {
      changes.push({
        field: 'Quantidade de Itens',
        oldVal: String(existing.quantidade_itens),
        newVal: String(row.itens),
      });
    }

    if (row.tipo && row.tipo !== existing.tipo) {
      changes.push({
        field: 'Tipo de Pedido',
        oldVal: existing.tipo,
        newVal: row.tipo,
      });
    }

    if (row.solicitante && row.solicitante !== existing.solicitante) {
      changes.push({
        field: 'Solicitante',
        oldVal: existing.solicitante || '—',
        newVal: row.solicitante,
      });
    }

    if (row.validador && row.validador !== existing.validador) {
      changes.push({
        field: 'Validador',
        oldVal: existing.validador || '—',
        newVal: row.validador,
      });
    }

    if (row.separador && row.separador !== existing.separador) {
      changes.push({
        field: 'Separador',
        oldVal: existing.separador || '—',
        newVal: row.separador,
      });
    }

    if (row.entregador && row.entregador !== existing.entregador) {
      changes.push({
        field: 'Entregador',
        oldVal: existing.entregador || '—',
        newVal: row.entregador,
      });
    }

    if (row.data_solicitacao && row.data_solicitacao !== existing.data_solicitacao) {
      changes.push({
        field: 'Data Solicitação',
        oldVal: existing.data_solicitacao || '—',
        newVal: row.data_solicitacao,
      });
    }

    if (row.data_prevista_entrega && row.data_prevista_entrega !== existing.data_prevista_entrega) {
      changes.push({
        field: 'Previsão Entrega',
        oldVal: existing.data_prevista_entrega || '—',
        newVal: row.data_prevista_entrega,
      });
    }

    if (changes.length > 0) {
      updateCount++;
      return {
        row,
        action: 'ATUALIZAR',
        changes,
      };
    } else {
      unchangedCount++;
      return {
        row,
        action: 'SEM_ALTERACAO',
      };
    }
  });

  const statusBreakdown: Record<string, number> = {};
  parsedRows.forEach(r => {
    const s = r.status || 'Aguardando Aprovação';
    statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
  });

  return {
    fileName,
    totalFound: parsedRows.length,
    newCount,
    updateCount,
    unchangedCount,
    errorCount,
    detectedStatusHeader: parsedRows[0]?.detectedStatusHeader,
    detectedConfidence: parsedRows[0]?.detectedConfidence,
    statusBreakdown,
    items: diffItems,
  };
}

export const analyzeImportDiff = analyzeImport;

/**
 * UNIFIED SPREADSHEET REPORT EXPORT:
 * Generates an exhaustive report containing all operational fields
 * and the complete 5-date lifecycle mapping!
 */
export function exportOrdersToSpreadsheet(
  orders: Order[], 
  format: 'xlsx' | 'csv' = 'xlsx', 
  filename = 'relatorio_pedidos_sesau'
) {
  const data = orders.map(o => ({
    'Código': o.codigo,
    'Origem': o.origem,
    'Tipo': o.tipo,
    'Solicitante': o.solicitante,
    'CPF': o.cpf,
    'Programa': o.programa,
    'Unidade': o.unidade,
    'Status Origem': o.status_origem,
    'Status Operacional': o.status_operacional,
    'Prioridade': o.prioridade,
    'Itens': o.quantidade_itens,

    // The Complete 5 Mapped Lifecycle Dates:
    '1. Data de Solicitação': o.data_solicitacao || o.criado_em,
    '2. Data de Aprovação': o.data_aprovacao || o.validada_em || o.validado_em || '—',
    '3. Início de Separação': o.data_inicio_separacao || o.separado_em || '—',
    '4. Data de Expedição': o.data_expedicao || o.expedido_em || '—',
    '5. Data de Entrega': o.data_prevista_entrega || o.entregue_em || '—',

    // Operadores
    'Validador': o.validador || '',
    'Separador': o.separador || '',
    'Conferente': o.conferente || '',
    'Expedidor': o.expedidor || '',
    'Entregador': o.entregador || '',

    // Cronograma & Vinculação
    'Cronograma Vinculado': o.cronograma_id || 'Fora do cronograma',
    'Tipo de Vínculo': o.cronograma_vinculo || 'Nenhum',
    'Observações': o.observacoes || '',
    'Histórico': o.historico_original || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Unificado');

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
  }
}

/**
 * UNIFIED SCHEDULES REPORT EXPORT:
 * Generates an export of the official network schedules with their 5 target milestone dates.
 */
export function exportSchedulesToSpreadsheet(
  schedules: Schedule[],
  orders: Order[],
  format: 'xlsx' | 'csv' = 'xlsx',
  filename = 'relatorio_cronogramas_sesau'
) {
  const data = schedules.map(s => {
    const linked = orders.filter(o => o.cronograma_id === s.id);
    const delivered = linked.filter(o => o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente').length;
    const progress = linked.length > 0 ? Math.round((delivered / linked.length) * 100) : 0;

    return {
      'Nome do Cronograma': s.nome,
      'Competência': s.competencia,
      'Unidade': s.unidade,
      'Programa': s.programa,
      'Tipo de Pedido': s.tipo_pedido,
      '1. Limite Solicitação': s.data_limite_solicitacao,
      '2. Limite Aprovação': s.data_limite_aprovacao,
      '3. Início Separação': s.data_separacao,
      '4. Expedição Prevista': s.data_expedicao,
      '5. Entrega Hospital': s.data_entrega,
      'Total de Pedidos': linked.length,
      'Pedidos Entregues': delivered,
      'Progresso (%)': `${progress}%`,
      'Status': s.ativo ? 'Ativo' : 'Inativo',
      'Observações': s.observacao || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronogramas');

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
  }
}

/**
 * Cria o objeto WorkBook da planilha modelo com as abas e formatações oficiais.
 */
export function createSampleTemplateWorkbook(): XLSX.WorkBook {
  // Real hospital template file with complete 5-date headers
  const rows: unknown[][] = [
    ['SESAU / AL - SISTEMA INTEGRADO DE ABASTECIMENTO HOSPITALAR'],
    ['RELATÓRIO OPERACIONAL UNIFICADO DE SOLICITAÇÕES E CRONOGRAMAS'],
    ['Competência: Setembro / Outubro 2026', 'Extraído em: 24/09/2026 14:00', 'Ambiente: Produção'],
    [], // Empty line before header
    [
      'Código',
      'Tipo',
      'Solicitante',
      'CPF',
      'Programa',
      'Unidade',
      'Status',
      'Itens',
      '1. Data Solicitação',
      '2. Data Aprovação',
      '3. Início Separação',
      '4. Data Expedição',
      '5. Data Entrega',
      'Validador',
      'Separador',
      'Entregador',
      'Histórico'
    ],
    [
      'SOL-2026-03074',
      'Mensal',
      'Dra. Camila Alencar',
      '123.456.789-00',
      'Almoxarifado',
      'HEMOAR',
      'Aguardando Aprovação',
      23,
      '24/09/2026',
      '25/09/2026',
      '26/09/2026',
      '28/09/2026',
      '30/09/2026',
      'Rodrigo Cesar',
      'Lucas Albuquerque',
      'Edvaldo Santos',
      '24/09/2026 – Criada por Dra. Camila Alencar'
    ],
    [
      'SOL-2026-03073',
      'Emergencial',
      'Dr. Marcelo Fontes',
      '987.654.321-11',
      'Oncológico',
      'HMA',
      'Aprovada',
      25,
      '24/09/2026',
      '24/09/2026',
      '25/09/2026',
      '26/09/2026',
      '27/09/2026',
      'Rodrigo Cesar',
      'Amanda Rocha',
      'Edvaldo Santos',
      '24/09/2026 – Criada por Dr. Marcelo Fontes\n24/09/2026 – Aprovada por Rodrigo Cesar'
    ],
    [
      'SOL-2026-03072',
      'Falta',
      'Enf. Patricia Lima',
      '333.444.555-66',
      'Hospitalar',
      'HGE',
      'Em Separação',
      14,
      '23/09/2026',
      '23/09/2026',
      '24/09/2026',
      '25/09/2026',
      '26/09/2026',
      'Rodrigo Cesar',
      'Lucas Albuquerque',
      '',
      '23/09/2026 – Criada por Enf. Patricia Lima\n23/09/2026 – Aprovada\n24/09/2026 – Em separação'
    ],
    [
      'SOL-2026-03071',
      'Semanal',
      'Farm. Bruno Tavares',
      '777.888.999-00',
      'Nutricional',
      'HRM',
      'Em Transporte',
      42,
      '22/09/2026',
      '22/09/2026',
      '23/09/2026',
      '23/09/2026',
      '24/09/2026',
      'Dra. Valeria Souza',
      'Lucas Albuquerque',
      'Edvaldo Santos (Motorista)',
      '22/09/2026 – Criada\n22/09/2026 – Aprovada\n23/09/2026 – Separada\n23/09/2026 – Expedida'
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 }, // Código
    { wch: 15 }, // Tipo
    { wch: 26 }, // Solicitante
    { wch: 16 }, // CPF
    { wch: 18 }, // Programa
    { wch: 22 }, // Unidade
    { wch: 24 }, // Status
    { wch: 10 }, // Itens
    { wch: 18 }, // 1. Data Solicitação
    { wch: 18 }, // 2. Data Aprovação
    { wch: 18 }, // 3. Início Separação
    { wch: 18 }, // 4. Data Expedição
    { wch: 18 }, // 5. Data Entrega
    { wch: 24 }, // Validador
    { wch: 22 }, // Separador
    { wch: 26 }, // Entregador
    { wch: 50 }, // Histórico
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo Solicitacoes');

  // Aba 2: Instruções e Unidades Oficiais da Rede SESAU
  const instructionsRows: unknown[][] = [
    ['INSTRUÇÕES DE PREENCHIMENTO DA PLANILHA MODELO'],
    ['1. Código: Formato padrão ex: SOL-2026-00001 (utilizado como identificador único).'],
    ['2. Tipo: Mensal, Emergencial, Falta, Semanal, Extraordinário, etc.'],
    ['3. Unidade: Utilize preferencialmente as siglas oficiais da rede SESAU (abaixo).'],
    ['4. Itens: Quantidade numérica de itens do pedido (ex: 15, 250, 1.000).'],
    ['5. Datas: Formato DD/MM/AAAA ou DD/MM/AAAA HH:MM.'],
    ['6. Status: Aguardando Aprovação, Aprovada, Em Separação, Aguardando Conferência, Em Conferência, Expedida, Em Transporte, Entregue, Entregue Parcialmente, Rejeitada, Cancelada.'],
    [],
    ['SIGLAS E NOMES DAS PRINCIPAIS UNIDADES HOSPITALARES DA REDE SESAU/AL:'],
    ['Sigla', 'Nome Oficial', 'Município'],
    ['HGE', 'Hospital Geral do Estado Dr. Osvaldo Brandão Vilela', 'Maceió'],
    ['HEHA', 'Hospital Escola Dr. Helvio Auto', 'Maceió'],
    ['HM', 'Hospital da Mulher Dra. Nise da Silveira', 'Maceió'],
    ['HMC', 'Hospital Metropolitano de Alagoas', 'Maceió'],
    ['HRAS', 'Hospital Regional do Alto Sertão', 'Delmiro Gouveia'],
    ['HRM', 'Hospital Regional da Mata', 'União dos Palmares'],
    ['HRN', 'Hospital Regional do Norte', 'Porto Calvo'],
    ['HEMOAL', 'Centro de Hematologia e Hemoterapia de Alagoas', 'Maceió'],
    ['HEMOAR', 'Hemoal Arapiraca', 'Arapiraca'],
    ['LACEN', 'Laboratório Central de Saúde Pública de Alagoas', 'Maceió'],
    ['UPAS', 'Unidades de Pronto Atendimento (Maceió e Interior)', 'Alagoas'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows);
  wsInstructions['!cols'] = [
    { wch: 14 },
    { wch: 55 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucoes e Unidades SESAU');

  return wb;
}

/**
 * Dispara o download da planilha modelo (.xlsx) diretamente no navegador,
 * de forma 100% segura e compatível com todos os navegadores.
 */
export function exportSampleTemplateSpreadsheet(filename = 'modelo_solicitacoes_sesau'): void {
  const fullFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const wb = createSampleTemplateWorkbook();

  try {
    XLSX.writeFile(wb, fullFilename, { bookType: 'xlsx' });
  } catch (err) {
    console.warn('Fallback direct XLSX.writeFile note:', err);
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/**
 * Retorna o Uint8Array do arquivo XLSX para casos de uso que necessitam dos bytes brutos.
 */
export function generateSampleTemplateWorkbook(): Uint8Array {
  const wb = createSampleTemplateWorkbook();
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
