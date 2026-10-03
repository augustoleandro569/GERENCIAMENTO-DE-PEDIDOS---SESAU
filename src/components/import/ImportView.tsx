import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { 
  parseSpreadsheetFile, 
  analyzeImportDiff, 
  ImportAnalysis, 
  ImportProgress,
  exportSampleTemplateSpreadsheet 
} from '../../utils/spreadsheet';
import { generateSeedOrders } from '../../services/mockData';
import { cleanUnitName } from '../../utils/unitNormalizer';
import { formatDate } from '../../utils/dateUtils';
import { showToast } from '../common/Toast';
import { ImportRecord, ImportStatus } from '../../types';
import { DatabaseSaveProgress } from '../../services/dbSync';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  X, 
  FileCheck,
  History,
  Lock,
  Sparkles,
  AlertTriangle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Zap,
  RotateCcw,
  Database
} from 'lucide-react';
import { ClearDatabaseModal } from '../common/ClearDatabaseModal';
import { SupabaseSqlModal } from '../common/SupabaseSqlModal';

export const ImportView: React.FC = () => {
  const { orders, importRecords, processImport, recordFailedImport, currentUser } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [saveElapsedSec, setSaveElapsedSec] = useState(0);
  const [dbSaveProgress, setDbSaveProgress] = useState<DatabaseSaveProgress | null>(null);
  const [dbSaveAbortController, setDbSaveAbortController] = useState<AbortController | null>(null);

  // Active 1-second timer during database saving
  React.useEffect(() => {
    let interval: any = null;
    if (isSavingToDb) {
      setSaveElapsedSec(0);
      interval = setInterval(() => {
        setSaveElapsedSec(s => s + 1);
      }, 1000);
    } else {
      setSaveElapsedSec(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSavingToDb]);
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Real-time Import Progress & Status (File Reading stage)
  const [importProgress, setImportProgress] = useState<ImportProgress & { elapsedSec?: number } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // Explicit Non-Concluded Import Status
  const [unfinishedStatus, setUnfinishedStatus] = useState<{
    fileName: string;
    motivo: string;
    status: ImportStatus;
    timestamp: string;
    linhasLidas?: number;
    stage?: 'LEITURA' | 'GRAVACAO_BANCO';
    canRetrySave?: boolean;
  } | null>(null);

  // Modal to inspect full details of an import record
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState<ImportRecord | null>(null);

  // Analysis & Diff Preview
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'NOVO' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'ERRO'>('ALL');
  
  // Pagination & Search in Preview (prevents 25,000 DOM elements lag on 3,000+ rows)
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState<number>(50);
  const [previewSearchTerm, setPreviewSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCancelRunningImport = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleCancelDbSave = () => {
    if (dbSaveAbortController) {
      dbSaveAbortController.abort();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUnfinishedStatus(null);
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);
    const startTime = performance.now();

    setImportProgress({
      stage: 'LENDO_ARQUIVO',
      message: `Carregando arquivo "${file.name}"...`,
      current: 0,
      total: 100,
      percentage: 5,
      elapsedSec: 0,
    });

    try {
      // High-performance asynchronous reader with non-blocking event loop yielding
      const parsedRows = await parseSpreadsheetFile(file, {
        signal: controller.signal,
        onProgress: (p) => {
          const elapsedSec = Math.round((performance.now() - startTime) / 1000);
          setImportProgress({ ...p, elapsedSec });
        },
      });

      if (!parsedRows || parsedRows.length === 0) {
        throw new Error('Nenhum registro operacional foi identificado na planilha.');
      }

      setImportProgress({
        stage: 'FINALIZANDO',
        message: `Comparando ${parsedRows.length.toLocaleString('pt-BR')} registros com o banco de dados...`,
        current: parsedRows.length,
        total: parsedRows.length,
        percentage: 95,
        elapsedSec: Math.round((performance.now() - startTime) / 1000),
      });

      // Quick pause to allow UI repaint
      await new Promise(r => setTimeout(r, 15));

      const durationMs = Math.round(performance.now() - startTime);
      const diff = analyzeImportDiff(parsedRows, orders, file.name, durationMs);
      
      setAnalysis(diff);
      setPreviewPage(1);
      setPreviewSearchTerm('');
      
      showToast(
        'success', 
        'Planilha Lida com Sucesso', 
        `${parsedRows.length.toLocaleString('pt-BR')} pedidos processados em ${(durationMs / 1000).toFixed(1)}s.`
      );
    } catch (err: unknown) {
      const isAborted = err instanceof Error && (err.name === 'AbortError' || err.message.includes('cancelada'));
      const failureReason = isAborted 
        ? 'Importação interrompida pelo usuário antes da conclusão da leitura.' 
        : (err instanceof Error ? err.message : 'Falha crítica ao ler a planilha.');

      // Record non-concluded status in store and history for auditing
      recordFailedImport({
        fileName: file.name,
        totalFound: 0,
        motivo: failureReason,
        status: isAborted ? 'CANCELADA' : 'NAO_CONCLUIDA',
        usuario: currentUser.nome,
        duracaoMs: Math.round(performance.now() - startTime),
      });

      setUnfinishedStatus({
        fileName: file.name,
        motivo: failureReason,
        status: isAborted ? 'CANCELADA' : 'NAO_CONCLUIDA',
        timestamp: new Date().toISOString(),
      });

      setErrorMsg(failureReason);
      showToast('error', isAborted ? 'Importação Cancelada' : 'Importação Não Concluída', failureReason);
    } finally {
      setIsLoading(false);
      setImportProgress(null);
      setAbortController(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDiscardAnalysis = () => {
    if (!analysis) return;
    
    // Register cancellation in history if user was conferring a file
    recordFailedImport({
      fileName: analysis.fileName,
      totalFound: analysis.totalFound,
      motivo: 'Cancelada pelo usuário na etapa de conferência prévia antes da gravação.',
      status: 'CANCELADA',
      usuario: currentUser.nome,
      duracaoMs: analysis.tempoProcessamentoMs,
    });

    setUnfinishedStatus({
      fileName: analysis.fileName,
      motivo: 'Conferência cancelada pelo usuário. Nenhum pedido foi gravado no banco.',
      status: 'CANCELADA',
      timestamp: new Date().toISOString(),
      linhasLidas: analysis.totalFound,
    });

    setAnalysis(null);
    showToast('info', 'Importação Cancelada', 'A prévia foi descartada e registrada como Cancelada no histórico.');
  };

  const handleConfirmImport = async () => {
    if (!analysis) return;
    setIsSavingToDb(true);
    setErrorMsg(null);
    setUnfinishedStatus(null);

    const startTime = performance.now();
    const controller = new AbortController();
    setDbSaveAbortController(controller);

    setDbSaveProgress({
      stage: 'INICIANDO',
      current: 0,
      total: analysis.totalFound,
      percentage: 2,
      message: `Iniciando gravação de ${analysis.totalFound.toLocaleString('pt-BR')} registros no banco de dados...`,
      speedRowsPerSec: 0,
      elapsedSec: 0,
    });

    try {
      const record = await processImport(
        analysis, 
        currentUser,
        (progress) => {
          setDbSaveProgress(progress);
        },
        controller.signal
      );
      
      const statusTitle = record.status === 'PARCIAL' 
        ? 'Importação Concluída com Inconformidades'
        : 'Importação Concluída com Sucesso';

      setSuccessMsg(
        `Importação de "${analysis.fileName}" concluída! ${record.novos} novos e ${record.atualizados} atualizados foram gravados com sucesso no banco de dados e sincronizados com todas as unidades hospitalares.`
      );
      
      showToast(
        record.status === 'PARCIAL' ? 'info' : 'success', 
        statusTitle, 
        `${record.novos} pedidos novos, ${record.atualizados} atualizados (${((performance.now() - startTime) / 1000).toFixed(1)}s).`
      );
      setAnalysis(null);
    } catch (err: unknown) {
      console.error('Import save error:', err);
      const isAborted = controller.signal.aborted;
      const failReason = isAborted 
        ? 'A gravação no banco de dados foi cancelada pelo usuário.'
        : (err instanceof Error ? err.message : 'Falha ao sincronizar registros com o banco de dados.');
      
      recordFailedImport({
        fileName: analysis.fileName,
        totalFound: analysis.totalFound,
        motivo: `Falha na gravação do banco: ${failReason}`,
        status: isAborted ? 'CANCELADA' : 'NAO_CONCLUIDA',
        usuario: currentUser.nome,
        duracaoMs: Math.round(performance.now() - startTime),
      });

      setUnfinishedStatus({
        fileName: analysis.fileName,
        motivo: `A leitura da planilha foi realizada com sucesso (${analysis.totalFound.toLocaleString('pt-BR')} registros), mas a gravação das informações no banco de dados NÃO foi concluída: ${failReason}`,
        status: isAborted ? 'CANCELADA' : 'NAO_CONCLUIDA',
        timestamp: new Date().toISOString(),
        linhasLidas: analysis.totalFound,
        stage: 'GRAVACAO_BANCO',
        canRetrySave: true,
      });

      setErrorMsg(failReason);
    } finally {
      setIsSavingToDb(false);
      setDbSaveProgress(null);
      setDbSaveAbortController(null);
    }
  };

  const handleImportCleanReport = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUnfinishedStatus(null);

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

      const diff = analyzeImportDiff(parsedRows, orders, 'RELATORIO_PEDIDOS_SESAU_HIGIENIZADO.xlsx', 120);
      setAnalysis(diff);
      setPreviewPage(1);
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
    setUnfinishedStatus(null);

    const sampleRows = [
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
      const diff = analyzeImportDiff(sampleRows, orders, 'relatorio-atualizacoes-sesau.xlsx', 180);
      setAnalysis(diff);
      setIsLoading(false);
      setPreviewPage(1);
    }, 250);
  };

  // Instant filtering and pagination without DOM freezing
  const filteredDiffItems = useMemo(() => {
    if (!analysis) return [];
    return analysis.items.filter(item => {
      if (activeFilterTab !== 'ALL' && item.action !== activeFilterTab) return false;
      if (previewSearchTerm.trim()) {
        const term = previewSearchTerm.toLowerCase().trim();
        const matchCode = (item.row.codigo || '').toLowerCase().includes(term);
        const matchUnit = (item.row.unidade || '').toLowerCase().includes(term);
        const matchStatus = (item.row.status || '').toLowerCase().includes(term);
        const matchSolicitante = (item.row.solicitante || '').toLowerCase().includes(term);
        if (!matchCode && !matchUnit && !matchStatus && !matchSolicitante) return false;
      }
      return true;
    });
  }, [analysis, activeFilterTab, previewSearchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDiffItems.length / previewPageSize));
  const paginatedDiffItems = useMemo(() => {
    const startIndex = (previewPage - 1) * previewPageSize;
    return filteredDiffItems.slice(startIndex, startIndex + previewPageSize);
  }, [filteredDiffItems, previewPage, previewPageSize]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Importação de Planilhas e Relatórios (XLSX / CSV / PDF)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>Sincronização de pedidos com chave única "Código"</span>
            <span>·</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-600" />
              Motor de alta performance (arquivos com 3.000+ linhas)
            </span>
            <span>·</span>
            <span className="text-blue-700 font-medium">Rastreabilidade e status de conclusão ativos</span>
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
            title="Simula a leitura de uma planilha contendo novos pedidos e atualizações"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Simular Carga</span>
          </button>

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Exibir comandos SQL para o Supabase"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>SQL Supabase</span>
          </button>

          <button
            onClick={handleDownloadSampleTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Modelo (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Supabase SQL Modal */}
      <SupabaseSqlModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      {/* Security-Locked Modal to Clean Database */}
      <ClearDatabaseModal
        isOpen={isCleanModalOpen}
        onClose={() => setIsCleanModalOpen(false)}
        onSuccess={(msg) => {
          setSuccessMsg(msg);
        }}
      />

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold leading-relaxed">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PROMINENT STATUS: IMPORTAÇÃO NÃO CONCLUÍDA */}
      {unfinishedStatus && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-950 rounded-2xl space-y-2.5 shadow-xs animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-extrabold tracking-wider uppercase ${
                unfinishedStatus.status === 'CANCELADA' 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-rose-700 text-white shadow-xs'
              }`}>
                <XCircle className="w-3.5 h-3.5" />
                STATUS: IMPORTAÇÃO {unfinishedStatus.status === 'CANCELADA' ? 'CANCELADA' : 'NÃO CONCLUÍDA'}
              </span>
              <span className="font-bold text-slate-800 text-xs">
                Arquivo: <strong className="font-mono">{unfinishedStatus.fileName}</strong>
              </span>
            </div>
            <button 
              onClick={() => setUnfinishedStatus(null)} 
              className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              title="Fechar aviso de não conclusão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-rose-200/80 text-xs space-y-1">
            <p className="font-semibold text-rose-900">
              {unfinishedStatus.motivo}
            </p>
            {unfinishedStatus.linhasLidas !== undefined && unfinishedStatus.linhasLidas > 0 && (
              <p className="text-[11px] text-slate-600">
                Quantidade de linhas analisadas antes da interrupção: <strong>{unfinishedStatus.linhasLidas.toLocaleString('pt-BR')} registros</strong>.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Registrado em: {formatDate(unfinishedStatus.timestamp)}</span>
              <span>·</span>
              <span className="text-rose-700 font-medium">Esta ocorrência foi salva no histórico de importações para fins de auditoria.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSqlModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 hover:bg-slate-100 border border-rose-300 font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Visualizar e copiar script SQL de correção para o Supabase"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ver SQL Supabase</span>
              </button>

              {unfinishedStatus.canRetrySave && analysis && (
                <button
                  onClick={handleConfirmImport}
                  disabled={isSavingToDb}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer active:scale-98"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar Gravar no Banco Novamente</span>
                </button>
              )}

              {analysis && (
                <button
                  onClick={handleDiscardAnalysis}
                  disabled={isSavingToDb}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  Descartar Prévia
                </button>
              )}

              <button
                onClick={() => {
                  setUnfinishedStatus(null);
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                className="inline-flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer px-2 py-1 text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Selecionar outro arquivo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME DATABASE SAVING PROGRESS MODAL */}
      {isSavingToDb && dbSaveProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-blue-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Gravando Informações no Banco de Dados
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {dbSaveProgress.stage === 'FIRESTORE' 
                      ? 'Persistência no Firestore' 
                      : (dbSaveProgress.stage === 'SUPABASE' 
                        ? 'Sincronização com Supabase' 
                        : 'Preparando registros')}
                  </p>
                </div>
              </div>
              <span className="text-base font-extrabold font-mono text-blue-700">
                {dbSaveProgress.percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div 
                className="h-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-150 ease-out shadow-xs"
                style={{ width: `${dbSaveProgress.percentage}%` }}
              />
            </div>

            {/* Status message */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium leading-relaxed">
              {dbSaveProgress.message}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Pedidos</span>
                <span className="font-bold font-mono text-slate-800">
                  {dbSaveProgress.current.toLocaleString('pt-BR')} / {dbSaveProgress.total.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Velocidade</span>
                <span className="font-bold font-mono text-emerald-700">
                  {dbSaveProgress.speedRowsPerSec ? `⚡ ~${dbSaveProgress.speedRowsPerSec.toLocaleString('pt-BR')} ped/s` : 'Calculando...'}
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tempo</span>
                <span className="font-bold font-mono text-slate-800">
                  ⏱ {saveElapsedSec}s
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Lote {dbSaveProgress.currentBatch || 1} de {dbSaveProgress.totalBatches || 1}
              </span>
              <button
                type="button"
                onClick={handleCancelDbSave}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar Gravação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Error Notice */}
      {errorMsg && !unfinishedStatus && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X className="w-4 h-4" />
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
              Clique para selecionar a planilha
            </label>
            <span className="text-sm text-slate-600"> ou arraste e solte o arquivo aqui</span>
          </div>

          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Formatos aceitos: <strong>.XLSX</strong>, <strong>.XLS</strong>, <strong>.CSV</strong> ou relatórios <strong>.PDF</strong> (ex: <em>RELATORIO PEDIDOS.pdf</em>).
            <br />
            Otimizado para <strong>arquivos volumosos (acima de 3.000 linhas)</strong>: processamento fluido em segundo plano, sem travamento de tela e com normalização imediata de unidades.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2 justify-center">
            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Baixar Planilha Modelo Oficial (.xlsx)</span>
            </button>
          </div>

          {/* ACTIVE IMPORT PROGRESS PANEL (REAL-TIME NON-BLOCKING) */}
          {isLoading && importProgress && (
            <div className="w-full max-w-xl mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 shadow-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-900">
                    {importProgress.message}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-blue-700">
                  {importProgress.percentage}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>

              {/* Real-time stats & Cancel option */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <div className="flex items-center gap-3">
                  <span>
                    Linhas: <strong>{importProgress.current.toLocaleString('pt-BR')}</strong>
                    {importProgress.total > 0 && ` / ~${importProgress.total.toLocaleString('pt-BR')}`}
                  </span>
                  {importProgress.speedRowsPerSec ? (
                    <span className="text-emerald-700 font-semibold">
                      ⚡ ~{importProgress.speedRowsPerSec.toLocaleString('pt-BR')} lin/s
                    </span>
                  ) : null}
                  {importProgress.elapsedSec !== undefined && (
                    <span>⏱ {importProgress.elapsedSec}s decorridos</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCancelRunningImport}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelar Leitura</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PREVIEW & CONFERÊNCIA SCREEN (BEFORE PERSISTING) */}
      {analysis && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  Conferência Prévia de Importação
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  analysis.isComplete === false 
                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                    : analysis.errorCount > 0 
                    ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {analysis.isComplete === false 
                    ? '● Incompleta / Bloqueada' 
                    : analysis.errorCount > 0 
                    ? '● Parcial (Com Inconformidades)' 
                    : '● Leitura 100% Concluída'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                <span>Arquivo: {analysis.fileName}</span>
                {analysis.tempoProcessamentoMs && (
                  <span className="text-xs font-normal font-mono text-slate-400">
                    ({(analysis.tempoProcessamentoMs / 1000).toFixed(1)}s de leitura)
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardAnalysis}
                disabled={isSavingToDb}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                title="Descartar conferência e registrar como cancelada"
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
                    <span>Confirmar e Alimentar Banco ({analysis.totalFound.toLocaleString('pt-BR')} registros)</span>
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
                {analysis.totalFound.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-semibold block">Novos Pedidos</span>
              <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                {analysis.newCount.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="text-[11px] text-blue-700 font-semibold block">Atualizações</span>
              <span className="text-xl font-bold font-mono text-blue-800 tabular-nums">
                {analysis.updateCount.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Sem Alteração</span>
              <span className="text-xl font-bold font-mono text-slate-600 tabular-nums">
                {analysis.unchangedCount.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[11px] text-rose-700 font-semibold block">Erros / Inválidos</span>
              <span className="text-xl font-bold font-mono text-rose-800 tabular-nums">
                {analysis.errorCount.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Intelligent Column Mapping & Status Breakdown */}
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
                Padronização oficial SOL-2026 e normalização de nomes completos das unidades
              </span>
            </div>

            {/* Distribution of statuses in file */}
            {analysis.statusBreakdown && Object.keys(analysis.statusBreakdown).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-600 mr-1">Status detectados:</span>
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

          {/* Search Bar & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1 text-xs overflow-x-auto">
              {[
                { id: 'ALL', label: `Todos (${analysis.items.length.toLocaleString('pt-BR')})` },
                { id: 'NOVO', label: `Novos (${analysis.newCount.toLocaleString('pt-BR')})` },
                { id: 'ATUALIZAR', label: `Atualizações (${analysis.updateCount.toLocaleString('pt-BR')})` },
                { id: 'SEM_ALTERACAO', label: `Inalterados (${analysis.unchangedCount.toLocaleString('pt-BR')})` },
                { id: 'ERRO', label: `Erros (${analysis.errorCount.toLocaleString('pt-BR')})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveFilterTab(tab.id as typeof activeFilterTab);
                    setPreviewPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    activeFilterTab === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick search inside the preview */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={previewSearchTerm}
                onChange={(e) => {
                  setPreviewSearchTerm(e.target.value);
                  setPreviewPage(1);
                }}
                placeholder="Filtrar por código, unidade..."
                className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
              {previewSearchTerm && (
                <button 
                  onClick={() => { setPreviewSearchTerm(''); setPreviewPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Paginated Diff Preview Table (Instant 60fps, no lag) */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="p-2.5">Ação</th>
                    <th className="p-2.5">Código Padronizado</th>
                    <th className="p-2.5">Unidade Hospitalar (Nome Completo)</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Status na Planilha</th>
                    <th className="p-2.5 text-right">Itens</th>
                    <th className="p-2.5">Alterações / Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {paginatedDiffItems.length > 0 ? (
                    paginatedDiffItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 whitespace-nowrap">
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
                        <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{item.row.codigo}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-800">{item.row.unidade}</td>
                        <td className="p-2.5 font-sans text-slate-600 whitespace-nowrap">{item.row.tipo}</td>
                        <td className="p-2.5 font-sans text-slate-700 whitespace-nowrap">{item.row.status}</td>
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
                            <span className="text-slate-400">Nenhuma divergência com o banco</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-slate-400 font-sans">
                        Nenhum pedido encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-2">
                <span>
                  Exibindo <strong>{Math.min(filteredDiffItems.length, (previewPage - 1) * previewPageSize + 1)}</strong> a <strong>{Math.min(filteredDiffItems.length, previewPage * previewPageSize)}</strong> de <strong>{filteredDiffItems.length.toLocaleString('pt-BR')}</strong> registros
                </span>
                <span>·</span>
                <label className="flex items-center gap-1 text-slate-500">
                  <span>Itens por página:</span>
                  <select
                    value={previewPageSize}
                    onChange={(e) => {
                      setPreviewPageSize(Number(e.target.value));
                      setPreviewPage(1);
                    }}
                    className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs font-semibold focus:outline-none"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </label>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewPage(1)}
                    disabled={previewPage === 1}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 border border-slate-200 cursor-pointer"
                    title="Primeira página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 border border-slate-200 cursor-pointer"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-[11px]">
                    Página <strong>{previewPage}</strong> de <strong>{totalPages}</strong>
                  </span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                    disabled={previewPage === totalPages}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 border border-slate-200 cursor-pointer"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewPage(totalPages)}
                    disabled={previewPage === totalPages}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 border border-slate-200 cursor-pointer"
                    title="Última página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTÓRICO DE IMPORTAÇÕES COM COLUNA DE STATUS OFICIAL */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Histórico de Importações e Status de Conclusão
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {importRecords.length} operações registradas
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5">Status da Importação</th>
                <th className="p-2.5">Arquivo</th>
                <th className="p-2.5">Usuário Responsável</th>
                <th className="p-2.5 text-right">Registros</th>
                <th className="p-2.5 text-right">Novos</th>
                <th className="p-2.5 text-right">Atualizados</th>
                <th className="p-2.5 text-right">Inalterados</th>
                <th className="p-2.5 text-right">Erros</th>
                <th className="p-2.5 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {importRecords.length > 0 ? (
                importRecords.map((rec) => {
                  const status = rec.status || (rec.erros > 0 && rec.novos === 0 && rec.atualizados === 0 ? 'NAO_CONCLUIDA' : (rec.erros > 0 ? 'PARCIAL' : 'CONCLUIDA'));
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {formatDate(rec.data_importacao)}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        {status === 'CONCLUIDA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Concluída</span>
                          </span>
                        )}
                        {status === 'NAO_CONCLUIDA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Não Concluída</span>
                          </span>
                        )}
                        {status === 'PARCIAL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Parcial</span>
                          </span>
                        )}
                        {status === 'CANCELADA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <X className="w-3 h-3 text-slate-500" />
                            <span>Cancelada</span>
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{rec.arquivo}</span>
                      </td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">{rec.usuario}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{rec.quantidade_registros.toLocaleString('pt-BR')}</td>
                      <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">{rec.novos.toLocaleString('pt-BR')}</td>
                      <td className="p-2.5 text-right font-mono text-blue-700 font-bold">{rec.atualizados.toLocaleString('pt-BR')}</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">{rec.sem_alteracao.toLocaleString('pt-BR')}</td>
                      <td className="p-2.5 text-right font-mono text-rose-600 font-bold">{rec.erros.toLocaleString('pt-BR')}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => setSelectedRecordForDetails(rec)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                          title="Ver detalhes e motivo do status"
                        >
                          <Info className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-xs text-slate-400">
                    Nenhuma operação de importação avulsa registrada. Todos os pedidos exibidos no sistema estão sincronizados e gravados diretamente no banco de dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DETALHES DO STATUS DA IMPORTAÇÃO */}
      {selectedRecordForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Detalhes da Importação
                </h3>
              </div>
              <button 
                onClick={() => setSelectedRecordForDetails(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-600">Status Registrado:</span>
                <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                  selectedRecordForDetails.status === 'CONCLUIDA'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : selectedRecordForDetails.status === 'NAO_CONCLUIDA'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : selectedRecordForDetails.status === 'PARCIAL'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {selectedRecordForDetails.status || 'CONCLUÍDA'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 block">Arquivo e Operador:</span>
                <p className="font-mono text-slate-800 bg-slate-100 p-2 rounded-lg">
                  {selectedRecordForDetails.arquivo} (por {selectedRecordForDetails.usuario})
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 block">Motivo / Justificativa do Status:</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed">
                  {selectedRecordForDetails.motivo_status || (
                    selectedRecordForDetails.status === 'NAO_CONCLUIDA' 
                      ? 'A importação não foi concluída devido a inconformidades nos registros ou cancelamento da operação.'
                      : 'Importação processada e gravada integralmente no banco de dados.'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center font-mono">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">Total</span>
                  <span className="font-bold text-slate-800">{selectedRecordForDetails.quantidade_registros}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <span className="text-[10px] text-emerald-700 block">Novos</span>
                  <span className="font-bold text-emerald-800">{selectedRecordForDetails.novos}</span>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <span className="text-[10px] text-blue-700 block">Atualizados</span>
                  <span className="font-bold text-blue-800">{selectedRecordForDetails.atualizados}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg">
                  <span className="text-[10px] text-rose-700 block">Erros</span>
                  <span className="font-bold text-rose-800">{selectedRecordForDetails.erros}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                <span>Data: {formatDate(selectedRecordForDetails.data_importacao)}</span>
                {selectedRecordForDetails.tempo_processamento_ms && (
                  <span>Tempo de Leitura: {(selectedRecordForDetails.tempo_processamento_ms / 1000).toFixed(1)}s</span>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecordForDetails(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
