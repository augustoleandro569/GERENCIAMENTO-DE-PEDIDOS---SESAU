import * as XLSX from 'xlsx';
import { Order, OrderStatus, Schedule } from '../types';

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
  items: ImportDiffItem[];
}

// Normalize column header strings for resilient matching
function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of rows to search for header line
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('A planilha está vazia.');
  }

  // Find header row: look for row containing "código" or "solicitante" or "unidade"
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      const rowNormalized = row.map(cell => normalizeKey(String(cell || '')));
      if (
        rowNormalized.some(c => c.includes('codigo') || c.includes('solicitacao') || c.includes('solicitante')) &&
        rowNormalized.some(c => c.includes('unidade') || c.includes('hospital') || c.includes('tipo'))
      ) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  // Parse using detected header
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    range: headerRowIndex,
    defval: '',
  });

  const parsed: ParsedRow[] = [];

  jsonRows.forEach((row, idx) => {
    // Map columns flexibly
    let codigo = '';
    let tipo = 'Mensal';
    let solicitante = '';
    let cpf = '';
    let programa = 'Hospitalar';
    let unidade = '';
    let status = 'Aguardando Aprovação';
    let itens = 1;
    let criada_em = '';
    let validador: string | undefined;
    let validada_em: string | undefined;
    let separador: string | undefined;
    let separada_em: string | undefined;
    let entregador: string | undefined;
    let entregue_em: string | undefined;
    let historico: string | undefined;
    let data_solicitacao: string | undefined;
    let data_aprovacao: string | undefined;
    let data_inicio_separacao: string | undefined;
    let data_expedicao: string | undefined;
    let data_prevista_entrega: string | undefined;

    Object.entries(row).forEach(([colName, val]) => {
      const k = normalizeKey(colName);
      const strVal = String(val || '').trim();

      if (k.includes('codigo') || k === 'cod' || k === 'id' || k.includes('numero')) {
        if (!codigo && strVal) codigo = strVal;
      } else if (k.includes('tipo') && !k.includes('evento')) {
        if (strVal) tipo = strVal;
      } else if (k.includes('solicitante') || k === 'responsavel' || k.includes('usuario')) {
        if (!solicitante && strVal) solicitante = strVal;
      } else if (k.includes('cpf')) {
        if (strVal) cpf = strVal;
      } else if (k.includes('programa')) {
        if (strVal) programa = strVal;
      } else if (k.includes('unidade') || k.includes('hospital') || k.includes('destino') || k.includes('sigla')) {
        if (!unidade && strVal) unidade = strVal;
      } else if (k.includes('status') || k.includes('situacao') || k.includes('fase')) {
        if (strVal) status = strVal;
      } else if (k.includes('item') || k.includes('qtd') || k.includes('quantidade')) {
        const num = parseInt(strVal, 10);
        if (!isNaN(num) && num > 0) itens = num;
      } else if (k.includes('datasolicitacao') || (k.includes('solicitacao') && k.includes('data'))) {
        data_solicitacao = strVal;
      } else if (k.includes('dataaprovacao') || (k.includes('aprovacao') && k.includes('data'))) {
        data_aprovacao = strVal;
      } else if (k.includes('dataseparacao') || k.includes('inicioseparacao') || (k.includes('separacao') && k.includes('data'))) {
        data_inicio_separacao = strVal;
      } else if (k.includes('dataexpedicao') || (k.includes('expedicao') && k.includes('data'))) {
        data_expedicao = strVal;
      } else if (k.includes('dataentrega') || k.includes('previstaentrega') || (k.includes('entrega') && k.includes('data'))) {
        data_prevista_entrega = strVal;
      } else if (k.includes('criada') || k.includes('abertura') || k.includes('emissao') || k.includes('data')) {
        if (!criada_em && strVal) criada_em = strVal;
      } else if (k.includes('validador')) {
        validador = strVal;
      } else if (k.includes('validada')) {
        validada_em = strVal;
      } else if (k.includes('separador')) {
        separador = strVal;
      } else if (k.includes('separada')) {
        separada_em = strVal;
      } else if (k.includes('entregador') || k.includes('motorista')) {
        entregador = strVal;
      } else if (k.includes('entregue')) {
        entregue_em = strVal;
      } else if (k.includes('historico') || k.includes('obs') || k.includes('observacao')) {
        historico = strVal;
      }
    });

    if (codigo || solicitante || unidade) {
      parsed.push({
        codigo: codigo || `SOL-IMP-${String(idx + 1).padStart(5, '0')}`,
        tipo,
        solicitante: solicitante || 'Solicitante Não Informado',
        cpf: cpf || '—',
        programa,
        unidade: unidade || 'HGE',
        status,
        itens,
        criada_em: criada_em || new Date().toISOString(),
        data_solicitacao,
        data_aprovacao,
        data_inicio_separacao,
        data_expedicao,
        data_prevista_entrega,
        validador,
        validada_em,
        separador,
        separada_em,
        entregador,
        entregue_em,
        historico,
        raw: row,
        rowIndex: headerRowIndex + 1 + idx,
      });
    }
  });

  return parsed;
}

export function analyzeImport(parsedRows: ParsedRow[], currentOrders: Order[], fileName: string): ImportAnalysis {
  const currentByCode = new Map<string, Order>();
  currentOrders.forEach(o => currentByCode.set(o.codigo.toLowerCase().trim(), o));

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  const diffItems: ImportDiffItem[] = parsedRows.map(row => {
    const existing = currentByCode.get(row.codigo.toLowerCase().trim());

    if (!existing) {
      newCount++;
      return {
        row,
        action: 'NOVO',
      };
    }

    // Check changes
    const changes: { field: string; oldVal: string; newVal: string }[] = [];

    if (row.status && row.status !== existing.status_operacional) {
      changes.push({
        field: 'Status Operacional',
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

  return {
    fileName,
    totalFound: parsedRows.length,
    newCount,
    updateCount,
    unchangedCount,
    errorCount,
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

export function generateSampleTemplateWorkbook(): Uint8Array {
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
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório Modelo');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}
