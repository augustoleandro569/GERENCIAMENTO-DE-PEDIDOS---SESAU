import React, { useState, useRef } from 'react';
import { useStore } from '../../hooks/useStore';
import { 
  parseSpreadsheetFile, 
  analyzeImportDiff, 
  ImportAnalysis, 
  exportSampleTemplateSpreadsheet,
  generateSampleTemplateWorkbook 
} from '../../utils/spreadsheet';
import { generateSeedOrders } from '../../services/mockData';
import { cleanUnitName } from '../../utils/unitNormalizer';
import { formatDate } from '../../utils/dateUtils';
import { showToast } from '../common/Toast';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  X, 
  ArrowRight,
  FileCheck,
  History,
  FileText,
  Trash2,
  Sparkles,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { ClearDatabaseModal } from '../common/ClearDatabaseModal';

export const ImportView: React.FC = () => {
  const { orders, importRecords, processImport, currentUser } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'NOVO' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'ERRO'>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const parsedRows = await parseSpreadsheetFile(file);
      if (parsedRows.length === 0) {
        throw new Error('Nenhum registro operacional foi identificado na planilha.');
      }

      const diff = analyzeImportDiff(parsedRows, orders, file.name);
      setAnalysis(diff);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao processar arquivo.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!analysis) return;
    setIsSavingToDb(true);
    setErrorMsg(null);
    try {
      const record = await processImport(analysis, currentUser);
      setSuccessMsg(`Importação de "${analysis.fileName}" concluída com sucesso! Os pedidos e o histórico foram gravados e alimentaram o banco de dados (${record.novos} novos e ${record.atualizados} atualizados). Todas as unidades foram normalizadas.`);
      setAnalysis(null);
    } catch (err: unknown) {
      console.error('Import error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao alimentar o banco de dados com a planilha.');
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleImportCleanReport = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const seedOrders = generateSeedOrders();
      const parsedRows = seedOrders.map((o, idx) => ({
        codigo: o.codigo,
        tipo: o.tipo,
        solicitante: o.solicitante,
        cpf: o.cpf,
        programa: o.programa,
        unidade: cleanUnitName(o.unidade),
        status: o.status_operacional,
        itens: o.quantidade_itens,
        criada_em: o.criado_em,
        data_solicitacao: o.data_solicitacao,
        data_aprovacao: o.data_aprovacao,
        data_inicio_separacao: o.data_inicio_separacao,
        data_expedicao: o.data_expedicao,
        data_prevista_entrega: o.data_prevista_entrega,
        validador: o.validador,
        validada_em: o.validada_em,
        separador: o.separador,
        separada_em: o.separado_em,
        entregador: o.entregador,
        entregue_em: o.entregue_em,
        historico: o.historico_original,
        raw: {},
        rowIndex: idx + 2,
      }));

      const diff = analyzeImportDiff(parsedRows, orders, 'RELATORIO_PEDIDOS_SESAU_HIGIENIZADO.xlsx');
      setAnalysis(diff);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar carga higienizada.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    try {
      exportSampleTemplateSpreadsheet('modelo_solicitacoes_sesau');
      showToast('success', 'Planilha Modelo Baixada', 'Arquivo modelo_solicitacoes_sesau.xlsx gerado com sucesso!');
    } catch (err: unknown) {
      console.error('Download template error:', err);
      setErrorMsg('Falha ao baixar a planilha modelo.');
    }
  };

  const handleSimulateExampleImport = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Simulated parsed rows representing an updated daily spreadsheet from SESAU
    const sampleRows = [
      // 1. SOL-2026-03074 (Existing: HEMOAR - was Aguardando Aprovação, now Aprovada by Rodrigo Cesar)
      {
        codigo: 'SOL-2026-03074',
        tipo: 'Mensal',
        solicitante: 'Dra. Camila Alencar',
        cpf: '123.456.789-00',
        programa: 'Almoxarifado',
        unidade: 'HEMOAR',
        status: 'Aprovada',
        itens: 23,
        criada_em: '2026-09-24 09:30',
        validador: 'Rodrigo Cesar de Moura Castro Alves',
        validada_em: '2026-09-24 14:40',
        historico: '24/09/2026 09:30 – Criada por Dra. Camila Alencar\n24/09/2026 14:40 – Aprovada por Rodrigo Cesar de Moura',
        raw: {},
        rowIndex: 2,
      },
      // 2. SOL-2026-03073 (Existing: HMA - was Aprovada, now Em Separação with picker)
      {
        codigo: 'SOL-2026-03073',
        tipo: 'Emergencial',
        solicitante: 'Dr. Marcelo Fontes',
        cpf: '987.654.321-11',
        programa: 'Oncológico',
        unidade: 'HMA',
        status: 'Em Separação',
        itens: 25,
        criada_em: '2026-09-24 10:15',
        validador: 'Rodrigo Cesar de Moura Castro Alves',
        validada_em: '2026-09-24 10:45',
        separador: 'Lucas Albuquerque',
        separada_em: '2026-09-24 14:15',
        historico: '24/09/2026 10:15 – Criada por Dr. Marcelo Fontes\n24/09/2026 10:45 – Aprovada por Rodrigo Cesar\n24/09/2026 14:15 – Em separação no Almoxarifado Central por Lucas Albuquerque',
        raw: {},
        rowIndex: 3,
      },
      // 3. SOL-2026-03071 (Existing: HRM - was Em Transporte, now Entregue!)
      {
        codigo: 'SOL-2026-03071',
        tipo: 'Semanal',
        solicitante: 'Farm. Bruno Tavares',
        cpf: '777.888.999-00',
        programa: 'Nutricional',
        unidade: 'HRM',
        status: 'Entregue',
        itens: 42,
        criada_em: '2026-09-22 11:00',
        validador: 'Dra. Valeria Souza',
        validada_em: '2026-09-22 11:30',
        separador: 'Lucas Albuquerque',
        separado_em: '2026-09-23 09:00',
        entregador: 'Edvaldo Santos (Motorista)',
        entregue_em: '2026-09-24 14:30',
        historico: '22/09/2026 11:00 – Criada\n22/09/2026 11:30 – Aprovada\n23/09/2026 09:00 – Separada\n24/09/2026 07:15 – Em transporte\n24/09/2026 14:30 – Entregue e atestado na recepção do HRM',
        raw: {},
        rowIndex: 4,
      },
      // 4. SOL-2026-03070 (Existing: LACEN - Unchanged)
      {
        codigo: 'SOL-2026-03070',
        tipo: 'Quinzenal',
        solicitante: 'Dra. Silvia Regina',
        cpf: '555.666.777-88',
        programa: 'LACEN',
        unidade: 'LACEN',
        status: 'Entregue',
        itens: 19,
        criada_em: '2026-09-21 08:00',
        validador: 'Rodrigo Cesar',
        validada_em: '2026-09-21 08:45',
        separador: 'Amanda Rocha',
        separada_em: '2026-09-21 14:30',
        entregador: 'Edvaldo Santos',
        entregue_em: '2026-09-22 10:20',
        historico: '21/09/2026 08:00 – Criada\n21/09/2026 08:45 – Aprovada\n21/09/2026 14:30 – Separada\n22/09/2026 10:20 – Entregue',
        raw: {},
        rowIndex: 5,
      },
      // 5. SOL-2026-03075 (Brand New Order: UPA Viçosa)
      {
        codigo: 'SOL-2026-03075',
        tipo: 'Emergencial',
        solicitante: 'Dr. Leonardo Cavalcante',
        cpf: '456.789.012-33',
        programa: 'Hospitalar',
        unidade: 'UPA-VIC',
        status: 'Aguardando Aprovação',
        itens: 18,
        criada_em: '2026-09-24 14:20',
        historico: '24/09/2026 14:20 – Criada por Dr. Leonardo Cavalcante',
        raw: {},
        rowIndex: 6,
      },
      // 6. SOL-2026-03076 (Brand New Order: Hospital Regional do Alto Sertão)
      {
        codigo: 'SOL-2026-03076',
        tipo: 'Mensal',
        solicitante: 'Enf. Luciana Gusmão',
        cpf: '888.999.111-22',
        programa: 'Nutricional',
        unidade: 'HRA',
        status: 'Aprovada',
        itens: 34,
        criada_em: '2026-09-24 13:45',
        validador: 'Dra. Valeria Souza',
        validada_em: '2026-09-24 14:10',
        historico: '24/09/2026 13:45 – Criada por Luciana Gusmão\n24/09/2026 14:10 – Aprovada por Dra. Valeria Souza',
        raw: {},
        rowIndex: 7,
      },
    ];

    setTimeout(() => {
      const diff = analyzeImportDiff(sampleRows, orders, 'relatorio-atualizacoes-sesau.xlsx');
      setAnalysis(diff);
      setIsLoading(false);
    }, 300);
  };

  const filteredDiffItems = analysis?.items.filter(item => {
    if (activeFilterTab === 'ALL') return true;
    return item.action === activeFilterTab;
  }) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Importação de Planilhas e Relatórios (XLSX / CSV / PDF)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>Sincronização de pedidos com chave única "Código"</span>
            <span>·</span>
            <span>Detecção inteligente de cabeçalhos e metadados</span>
            <span>·</span>
            <span className="text-emerald-700 font-medium">Higienização e normalização de unidades ativa</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCleanModalOpen(true)}
            disabled={isLoading || isSavingToDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Limpeza do banco de dados protegida por senha de segurança"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <span>Limpar Banco de Dados</span>
          </button>

          <button
            onClick={handleImportCleanReport}
            disabled={isLoading || isSavingToDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Importa o relatório completo e higienizado com unidades e quantitativos validados"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Carga Limpa SESAU</span>
          </button>

          <button
            onClick={handleSimulateExampleImport}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Simula a leitura de uma planilha atualizada contendo novos pedidos e atualizações de status"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Simular Carga</span>
          </button>

          <button
            onClick={handleDownloadSampleTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Modelo (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Security-Locked Modal to Clean Database */}
      <ClearDatabaseModal
        isOpen={isCleanModalOpen}
        onClose={() => setIsCleanModalOpen(false)}
        onSuccess={(msg) => {
          setSuccessMsg(msg);
        }}
      />

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
            ✕
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      {!analysis && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />

          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-sm font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Clique para selecionar o arquivo
            </label>
            <span className="text-sm text-slate-600"> ou arraste e solte aqui</span>
          </div>

          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            Formatos aceitos: <strong>.XLSX</strong>, <strong>.XLS</strong>, <strong>.CSV</strong> ou relatórios <strong>.PDF</strong> (ex: <em>RELATORIO PEDIDOS.pdf</em>).
            <br />
            O sistema ignora cabeçalhos repetidos e subtotais, agrega múltiplos itens do mesmo pedido e <strong>normaliza automaticamente os nomes das unidades hospitalares</strong>.
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Baixar Planilha Modelo Oficial (.xlsx)</span>
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mt-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analisando e comparando registros da planilha...</span>
            </div>
          )}
        </div>
      )}


      {/* PREVIEW & CONFERÊNCIA SCREEN (BEFORE IMPORTING) */}
      {analysis && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-mono font-bold text-blue-600 uppercase tracking-wider block">
                Conferência Prévia de Importação
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Arquivo: {analysis.fileName}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnalysis(null)}
                disabled={isSavingToDb}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmImport}
                disabled={currentUser.role === 'VIEWER' || isSavingToDb}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {isSavingToDb ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Gravando no Banco de Dados...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 text-white" />
                    <span>Confirmar e Alimentar Banco ({analysis.totalFound} registros)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Total Encontrado</span>
              <span className="text-xl font-bold font-mono text-slate-800 tabular-nums">
                {analysis.totalFound}
              </span>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-semibold block">Novos Pedidos</span>
              <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                {analysis.newCount}
              </span>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="text-[11px] text-blue-700 font-semibold block">Atualizações</span>
              <span className="text-xl font-bold font-mono text-blue-800 tabular-nums">
                {analysis.updateCount}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Sem Alteração</span>
              <span className="text-xl font-bold font-mono text-slate-600 tabular-nums">
                {analysis.unchangedCount}
              </span>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[11px] text-rose-700 font-semibold block">Erros / Inválidos</span>
              <span className="text-xl font-bold font-mono text-rose-800 tabular-nums">
                {analysis.errorCount}
              </span>
            </div>
          </div>

          {/* Intelligent Column Mapping & Status Breakdown Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Mapeamento Inteligente de Status:</span>
                <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-white border border-slate-300 text-slate-800">
                  {analysis.detectedStatusHeader ? `Coluna "${analysis.detectedStatusHeader}"` : 'Padrão Inicial'}
                </span>
                {analysis.detectedConfidence && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    analysis.detectedConfidence === 'ALTA' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : analysis.detectedConfidence === 'MÉDIA' 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    Confiança: {analysis.detectedConfidence}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                Terminologias de ERPs e planilhas hospitalares normalizadas para o ciclo oficial
              </span>
            </div>

            {/* Distribution of statuses in this file */}
            {analysis.statusBreakdown && Object.keys(analysis.statusBreakdown).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-600 mr-1">Status lidos no arquivo:</span>
                {Object.entries(analysis.statusBreakdown).map(([st, count]) => (
                  <span 
                    key={st}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                      st === 'Entregue' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                        : st === 'Em Separação' || st === 'Aguardando Separação'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : st === 'Em Transporte' || st === 'Expedida'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    <span>{st}:</span>
                    <strong className="font-mono">{count}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Filter tabs for diff table */}
          <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
            {[
              { id: 'ALL', label: `Todos (${analysis.items.length})` },
              { id: 'NOVO', label: `Novos (${analysis.newCount})` },
              { id: 'ATUALIZAR', label: `Atualizações (${analysis.updateCount})` },
              { id: 'SEM_ALTERACAO', label: `Sem Alteração (${analysis.unchangedCount})` },
              { id: 'ERRO', label: `Erros (${analysis.errorCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id as typeof activeFilterTab)}
                className={`px-3 py-2 font-semibold border-b-2 transition-colors ${
                  activeFilterTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Diff Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="p-2.5">Ação</th>
                  <th className="p-2.5">Código</th>
                  <th className="p-2.5">Unidade</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5">Status Planilha</th>
                  <th className="p-2.5 text-right">Itens</th>
                  <th className="p-2.5">Alterações Detectadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredDiffItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5">
                      {item.action === 'NOVO' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          + NOVO
                        </span>
                      )}
                      {item.action === 'ATUALIZAR' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          ATUALIZAR
                        </span>
                      )}
                      {item.action === 'SEM_ALTERACAO' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                          INALTERADO
                        </span>
                      )}
                      {item.action === 'ERRO' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          ERRO
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{item.row.codigo}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-800">{item.row.unidade}</td>
                    <td className="p-2.5 font-sans text-slate-600">{item.row.tipo}</td>
                    <td className="p-2.5 font-sans text-slate-700">{item.row.status}</td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{item.row.itens}</td>
                    <td className="p-2.5 font-sans text-slate-600">
                      {item.changes && item.changes.length > 0 ? (
                        <div className="space-y-0.5">
                          {item.changes.map((c, cidx) => (
                            <span key={cidx} className="block text-[10px]">
                              <strong>{c.field}:</strong> {c.oldVal} → <span className="text-blue-600 font-bold">{c.newVal}</span>
                            </span>
                          ))}
                        </div>
                      ) : item.errorMessage ? (
                        <span className="text-rose-600 font-medium">{item.errorMessage}</span>
                      ) : (
                        <span className="text-slate-400">Nenhuma divergência</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IMPORT HISTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Histórico de Importações
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {importRecords.length} operações registradas
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5">Arquivo</th>
                <th className="p-2.5">Usuário Responsável</th>
                <th className="p-2.5 text-right">Registros</th>
                <th className="p-2.5 text-right">Novos</th>
                <th className="p-2.5 text-right">Atualizados</th>
                <th className="p-2.5 text-right">Inalterados</th>
                <th className="p-2.5 text-right">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {importRecords.length > 0 ? (
                importRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatDate(rec.data_importacao)}
                    </td>
                    <td className="p-2.5 font-semibold text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{rec.arquivo}</span>
                    </td>
                    <td className="p-2.5 text-slate-600">{rec.usuario}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">{rec.quantidade_registros}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">{rec.novos}</td>
                    <td className="p-2.5 text-right font-mono text-blue-700 font-bold">{rec.atualizados}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{rec.sem_alteracao}</td>
                    <td className="p-2.5 text-right font-mono text-rose-600 font-bold">{rec.erros}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-xs text-slate-400">
                    Nenhuma operação de importação avulsa registrada. Todos os pedidos exibidos no sistema estão sincronizados e gravados diretamente no banco de dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
