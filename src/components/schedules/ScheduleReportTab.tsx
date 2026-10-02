import React, { useState, useMemo } from 'react';
import { Order, Schedule, HospitalUnit, RequestType, OrderStatus } from '../../types';
import { useStore } from '../../hooks/useStore';
import { parseDateSafe, formatDate, formatShortDate, calculateDeadlineSituation } from '../../utils/dateUtils';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { showToast } from '../common/Toast';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Boxes,
  Truck,
  Send,
  AlertCircle,
  Trophy,
  BarChart3,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  Layers,
  Building2,
  CalendarDays,
  FileText
} from 'lucide-react';

interface ScheduleReportTabProps {
  onSelectOrder?: (order: Order) => void;
}

// Status definitions and standard colors matching the official SESAU/LINUS report
interface StatusMeta {
  key: string;
  label: string;
  color: string;
  bgBadge: string;
  textColor: string;
  dotColor: string;
  matches: (status: string) => boolean;
}

const STATUS_TAXONOMY: StatusMeta[] = [
  {
    key: 'APROVADA',
    label: 'Aprovada',
    color: '#10B981',
    bgBadge: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    textColor: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    matches: (s) => s === 'Aprovada' || s === 'Aprovado' || s === 'Validada' || s === 'Validado',
  },
  {
    key: 'AGUARDANDO_SEPARACAO',
    label: 'Aguardando separação',
    color: '#854D0E',
    bgBadge: 'bg-amber-100/60 border-amber-300 text-amber-950',
    textColor: 'text-amber-800',
    dotColor: 'bg-amber-700',
    matches: (s) => s === 'Aguardando Separação' || s === 'Aguardando separacao',
  },
  {
    key: 'EM_SEPARACAO',
    label: 'Em separação',
    color: '#F97316',
    bgBadge: 'bg-orange-50 border-orange-200 text-orange-950',
    textColor: 'text-orange-700',
    dotColor: 'bg-orange-500',
    matches: (s) => s === 'Em Separação' || s === 'Em separacao' || s === 'Separando',
  },
  {
    key: 'AGUARDANDO_CONFERENCIA',
    label: 'Aguardando conferência',
    color: '#CA8A04',
    bgBadge: 'bg-yellow-50 border-yellow-200 text-yellow-950',
    textColor: 'text-yellow-700',
    dotColor: 'bg-yellow-600',
    matches: (s) => s === 'Aguardando Conferência' || s === 'Aguardando conferencia',
  },
  {
    key: 'EM_CONFERENCIA',
    label: 'Em conferência',
    color: '#14B8A6',
    bgBadge: 'bg-teal-50 border-teal-200 text-teal-950',
    textColor: 'text-teal-700',
    dotColor: 'bg-teal-600',
    matches: (s) => s === 'Em Conferência' || s === 'Em conferencia',
  },
  {
    key: 'EXPEDIDO',
    label: 'Expedido',
    color: '#EC4899',
    bgBadge: 'bg-pink-50 border-pink-200 text-pink-950',
    textColor: 'text-pink-700',
    dotColor: 'bg-pink-500',
    matches: (s) => s === 'Expedida' || s === 'Expedido',
  },
  {
    key: 'EM_TRANSPORTE',
    label: 'Em transporte',
    color: '#64748B',
    bgBadge: 'bg-slate-100 border-slate-300 text-slate-900',
    textColor: 'text-slate-700',
    dotColor: 'bg-slate-500',
    matches: (s) => s === 'Em Transporte' || s === 'Em transporte' || s === 'Em Rota',
  },
  {
    key: 'CANCELADO',
    label: 'Cancelado',
    color: '#881337',
    bgBadge: 'bg-rose-100 border-rose-300 text-rose-950',
    textColor: 'text-rose-800',
    dotColor: 'bg-rose-800',
    matches: (s) => s === 'Cancelada' || s === 'Cancelado' || s === 'Rejeitada' || s === 'Rejeitado',
  },
  {
    key: 'ENTREGUE',
    label: 'Entregue',
    color: '#EF4444', // Red/Coral matches the user's dashboard image!
    bgBadge: 'bg-red-50 border-red-200 text-red-950',
    textColor: 'text-red-700',
    dotColor: 'bg-red-500',
    matches: (s) => s === 'Entregue' || s === 'Entregue Parcialmente',
  },
];

export const ScheduleReportTab: React.FC<ScheduleReportTabProps> = ({ onSelectOrder }) => {
  const { orders, schedules, units, orderTypes, settings } = useStore();

  // Filters State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('ALL');
  const [selectedOrderType, setSelectedOrderType] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [dateField, setDateField] = useState<'data_solicitacao' | 'data_prevista_entrega' | 'data_inicio_separacao' | 'data_expedicao'>('data_solicitacao');
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  const [quickPreset, setQuickPreset] = useState<string>('SET_2026');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Schedules lookup
  const schedulesMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    schedules.forEach(s => map.set(s.id, s));
    return map;
  }, [schedules]);

  // Handle Preset selection
  const handleSelectPreset = (preset: string) => {
    setQuickPreset(preset);
    if (preset === 'SET_2026') {
      setStartDate('2026-09-01');
      setEndDate('2026-09-30');
    } else if (preset === 'OUT_2026') {
      setStartDate('2026-10-01');
      setEndDate('2026-10-31');
    } else if (preset === 'ULTIMOS_7') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'ULTIMOS_15') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 15);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'TODO_CICLO') {
      setStartDate('2026-09-01');
      setEndDate('2026-10-31');
    }
  };

  // Helper to extract a normalized date string (YYYY-MM-DD) from an order based on selected dateField
  const getOrderRelevantDate = (ord: Order): string | null => {
    let raw: string | undefined | null = null;
    const sch = ord.cronograma_id ? schedulesMap.get(ord.cronograma_id) : null;

    if (dateField === 'data_prevista_entrega') {
      raw = ord.data_prevista_entrega || sch?.data_entrega || ord.entregue_em;
    } else if (dateField === 'data_inicio_separacao') {
      raw = ord.data_inicio_separacao || sch?.data_separacao || ord.separado_em;
    } else if (dateField === 'data_expedicao') {
      raw = ord.data_expedicao || sch?.data_expedicao || ord.expedido_em;
    } else {
      // Default: data_solicitacao
      raw = ord.data_solicitacao || sch?.data_limite_solicitacao || ord.criado_em;
    }

    if (!raw) return null;
    const clean = raw.trim();
    if (clean.includes('-')) {
      return clean.split('T')[0].split(' ')[0];
    }
    if (clean.includes('/')) {
      const parts = clean.split(' ')[0].split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    return null;
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      // 1. Cronograma Filter
      if (selectedScheduleId === 'ONLY_LINKED') {
        if (!ord.cronograma_id || ord.cronograma_vinculo === 'NENHUM') return false;
      } else if (selectedScheduleId !== 'ALL') {
        if (ord.cronograma_id !== selectedScheduleId) return false;
      }

      // 2. Tipo de Pedido Filter
      if (selectedOrderType !== 'ALL') {
        if (ord.tipo !== selectedOrderType) return false;
      }

      // 3. Unidade Filter
      if (selectedUnit !== 'ALL') {
        if (ord.unidade !== selectedUnit) return false;
      }

      // 4. Período de Datas
      const dateStr = getOrderRelevantDate(ord);
      if (startDate && dateStr && dateStr < startDate) return false;
      if (endDate && dateStr && dateStr > endDate) return false;

      return true;
    });
  }, [orders, selectedScheduleId, selectedOrderType, selectedUnit, startDate, endDate, dateField, schedulesMap]);

  // Search within filtered orders
  const searchedOrders = useMemo(() => {
    if (!searchTerm.trim()) return filteredOrders;
    const term = searchTerm.toLowerCase();
    return filteredOrders.filter(o =>
      o.codigo.toLowerCase().includes(term) ||
      o.unidade.toLowerCase().includes(term) ||
      o.programa.toLowerCase().includes(term) ||
      o.solicitante.toLowerCase().includes(term)
    );
  }, [filteredOrders, searchTerm]);

  // Status mapping and counts
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_TAXONOMY.forEach(s => { counts[s.key] = 0; });

    let unmappedCount = 0;

    filteredOrders.forEach(ord => {
      const st = ord.status_operacional || 'Rascunho';
      const found = STATUS_TAXONOMY.find(meta => meta.matches(st));
      if (found) {
        counts[found.key]++;
      } else {
        unmappedCount++;
      }
    });

    return { counts, unmappedCount };
  }, [filteredOrders]);

  // Daily distribution calculation (horizontal stacked bars)
  interface DayDistItem {
    dateStr: string; // YYYY-MM-DD
    displayDate: string; // DD/MM/AAAA
    total: number;
    statusCounts: Record<string, number>;
  }

  const dailyDistribution = useMemo(() => {
    const dayMap = new Map<string, DayDistItem>();

    filteredOrders.forEach(ord => {
      const dateIso = getOrderRelevantDate(ord);
      if (!dateIso) return;

      if (!dayMap.has(dateIso)) {
        const parts = dateIso.split('-');
        const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateIso;
        const initialStatusCounts: Record<string, number> = {};
        STATUS_TAXONOMY.forEach(s => { initialStatusCounts[s.key] = 0; });

        dayMap.set(dateIso, {
          dateStr: dateIso,
          displayDate,
          total: 0,
          statusCounts: initialStatusCounts,
        });
      }

      const item = dayMap.get(dateIso)!;
      item.total++;

      const st = ord.status_operacional || 'Rascunho';
      const found = STATUS_TAXONOMY.find(meta => meta.matches(st));
      if (found) {
        item.statusCounts[found.key] = (item.statusCounts[found.key] || 0) + 1;
      }
    });

    // Sort chronologically
    return Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredOrders, dateField]);

  // Maximum single day total for bar scaling
  const maxDayTotal = useMemo(() => {
    let max = 1;
    dailyDistribution.forEach(d => {
      if (d.total > max) max = d.total;
    });
    return max;
  }, [dailyDistribution]);

  // Key highlights (Principais Destaques)
  const highlights = useMemo(() => {
    if (filteredOrders.length === 0) {
      return {
        peakDay: '—',
        peakCount: 0,
        predominantStatus: '—',
        predominantCount: 0,
        predominantPercent: 0,
        slaRate: 0,
        totalItems: 0,
      };
    }

    // 1. Peak day
    let peakCount = 0;
    let peakDays: string[] = [];
    dailyDistribution.forEach(d => {
      if (d.total > peakCount) {
        peakCount = d.total;
        peakDays = [d.displayDate];
      } else if (d.total === peakCount && peakCount > 0) {
        peakDays.push(d.displayDate);
      }
    });

    // 2. Predominant status
    let maxStatusKey = 'ENTREGUE';
    let maxStatusCount = 0;
    STATUS_TAXONOMY.forEach(meta => {
      const c = statusSummary.counts[meta.key] || 0;
      if (c > maxStatusCount) {
        maxStatusCount = c;
        maxStatusKey = meta.key;
      }
    });
    const predominantMeta = STATUS_TAXONOMY.find(m => m.key === maxStatusKey);
    const predominantStatus = predominantMeta ? predominantMeta.label : '—';
    const predominantPercent = filteredOrders.length > 0 ? Math.round((maxStatusCount / filteredOrders.length) * 100) : 0;

    // 3. SLA compliance
    let onTimeCount = 0;
    let totalItems = 0;
    filteredOrders.forEach(o => {
      totalItems += o.quantidade_itens || 0;
      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(o, sch, settings.horas_alerta_atencao);
      if (situation === 'Dentro do prazo' || situation === 'Concluído no prazo') {
        onTimeCount++;
      }
    });
    const slaRate = filteredOrders.length > 0 ? Math.round((onTimeCount / filteredOrders.length) * 100) : 0;

    return {
      peakDay: peakDays.length > 1 ? `${peakDays.join(' e ')} (empate)` : (peakDays[0] || '—'),
      peakCount,
      predominantStatus,
      predominantCount: maxStatusCount,
      predominantPercent,
      slaRate,
      totalItems,
    };
  }, [filteredOrders, dailyDistribution, statusSummary, schedulesMap, settings]);

  // Export to Excel with multiple tabs (Resumo Executivo + Pedidos Detalhados)
  const handleExportExcel = () => {
    if (filteredOrders.length === 0) {
      showToast('error', 'Sem dados', 'Nenhum pedido encontrado para os filtros selecionados.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumo Executivo
      const resumoHeader = [
        ['RESUMO DE PEDIDOS - SESAU/AL'],
        ['RELATÓRIO VINCULADO AO CRONOGRAMA & TIPO DE PEDIDO'],
        [`Período: ${startDate ? formatDate(startDate) : 'Início'} até ${endDate ? formatDate(endDate) : 'Fim'}`],
        [`Cronograma: ${selectedScheduleId === 'ALL' ? 'Todos os Cronogramas' : selectedScheduleId === 'ONLY_LINKED' ? 'Apenas Pedidos com Cronograma' : schedulesMap.get(selectedScheduleId)?.nome || selectedScheduleId}`],
        [`Modalidade/Tipo: ${selectedOrderType === 'ALL' ? 'Todos os Tipos' : selectedOrderType}`],
        [`Unidade: ${selectedUnit === 'ALL' ? 'Todas as Unidades' : selectedUnit}`],
        [`Data de Extração: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['1. RESUMO POR STATUS OPERACIONAL'],
        ['Status', 'Quantidade de Pedidos', 'Percentual (%)'],
      ];

      const statusRows = STATUS_TAXONOMY.map(s => {
        const count = statusSummary.counts[s.key] || 0;
        const pct = filteredOrders.length > 0 ? ((count / filteredOrders.length) * 100).toFixed(1) + '%' : '0%';
        return [s.label, count, pct];
      });

      const totalRow = [['TOTAL GERAL', filteredOrders.length, '100%']];

      const distHeader = [
        [],
        ['2. DISTRIBUIÇÃO DIÁRIA DE PEDIDOS'],
        ['Data', 'Total do Dia', ...STATUS_TAXONOMY.map(s => s.label)],
      ];

      const distRows = dailyDistribution.map(d => [
        d.displayDate,
        d.total,
        ...STATUS_TAXONOMY.map(s => d.statusCounts[s.key] || 0),
      ]);

      const wsResumo = XLSX.utils.aoa_to_sheet([
        ...resumoHeader,
        ...statusRows,
        ...totalRow,
        ...distHeader,
        ...distRows,
      ]);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

      // Sheet 2: Pedidos Detalhados
      const pedidosData = filteredOrders.map(o => {
        const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
        const { situation } = calculateDeadlineSituation(o, sch, settings.horas_alerta_atencao);

        return {
          'Código': o.codigo,
          'Unidade': o.unidade,
          'Programa': o.programa,
          'Tipo de Pedido': o.tipo,
          'Origem': o.origem,
          'Status Operacional': o.status_operacional,
          'Situação SLA': situation,
          'Quantidade Itens': o.quantidade_itens,
          'Cronograma Vinculado': sch?.nome || (o.cronograma_id ? 'Vinculado' : 'Sem Cronograma'),
          'Competência': sch?.competencia || '—',
          'Data Solicitação': o.data_solicitacao || o.criado_em,
          'Data Validação/Aprovação': o.data_aprovacao || o.validada_em || sch?.data_limite_aprovacao || '—',
          'Início Separação': o.data_inicio_separacao || o.separado_em || sch?.data_separacao || '—',
          'Data Expedição': o.data_expedicao || o.expedido_em || sch?.data_expedicao || '—',
          'Data Entrega Prevista': o.data_prevista_entrega || o.entregue_em || sch?.data_entrega || '—',
          'Solicitante': o.solicitante,
        };
      });

      const wsPedidos = XLSX.utils.json_to_sheet(pedidosData);
      XLSX.utils.book_append_sheet(wb, wsPedidos, 'Relação de Pedidos');

      const filename = `relatorio_cronograma_${selectedOrderType !== 'ALL' ? selectedOrderType.toLowerCase() : 'geral'}_${startDate}_${endDate}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast('success', 'Relatório Exportado!', `Arquivo ${filename} gerado com sucesso.`);
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('error', 'Erro ao exportar', err.message || 'Falha ao gerar o arquivo Excel.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    exportOrdersToSpreadsheet(
      filteredOrders,
      'csv',
      `relatorio_pedidos_${selectedOrderType !== 'ALL' ? selectedOrderType.toLowerCase() : 'geral'}_${startDate}_${endDate}`
    );
    showToast('success', 'CSV Exportado!', `${filteredOrders.length} pedidos exportados em CSV.`);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* 1. FILTER CONTROLS BAR (CRONOGRAMA, TIPO DE PEDIDO, PERÍODO) */}
      <div className="bg-white rounded-2xl border border-slate-300 p-4 shadow-xs space-y-3.5 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Filtros do Relatório Vinculado ao Cronograma
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecione o cronograma de referência, o tipo de pedido e a janela de datas para consolidação
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
              title="Exportar planilha Excel com Resumo Executivo e Pedidos Detalhados"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 active:scale-95 border border-slate-300 rounded-xl transition-all cursor-pointer"
              title="Exportar dados tabulares em formato CSV"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 active:scale-95 border border-slate-300 rounded-xl transition-all cursor-pointer"
              title="Imprimir relatório gerencial ou salvar como PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter 1: Cronograma */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-blue-600" />
              <span>Cronograma Vinculado:</span>
            </label>
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="ALL">🌐 Todos os Cronogramas</option>
              <option value="ONLY_LINKED">🔗 Apenas Pedidos Vinculados</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.competencia} - {s.tipo_pedido})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Tipo de Pedido */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Boxes className="w-3 h-3 text-purple-600" />
              <span>Tipo de Pedido (Modalidade):</span>
            </label>
            <select
              value={selectedOrderType}
              onChange={(e) => setSelectedOrderType(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="ALL">📦 Todos os Tipos de Pedido</option>
              {orderTypes.map(t => (
                <option key={t.id} value={t.nome}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Unidade Hospitalar */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-600" />
              <span>Unidade Hospitalar:</span>
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="ALL">🏥 Todas as Unidades</option>
              {units.map(u => (
                <option key={u.id} value={u.sigla}>
                  {u.sigla} - {u.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Base da Data */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Data de Referência:</span>
            </label>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as any)}
              className="w-full text-xs font-medium bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="data_solicitacao">📅 Data de Solicitação / Emissão</option>
              <option value="data_prevista_entrega">🚚 Data de Entrega no Hospital</option>
              <option value="data_inicio_separacao">📦 Data de Separação em Almoxarifado</option>
              <option value="data_expedicao">✈️ Data de Expedição / Carga</option>
            </select>
          </div>
        </div>

        {/* Date Period Pickers & Quick Presets */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mr-1">
              Período Rápido:
            </span>
            {[
              { id: 'SET_2026', label: 'Setembro 2026 (SET/26)' },
              { id: 'OUT_2026', label: 'Outubro 2026 (OUT/26)' },
              { id: 'ULTIMOS_15', label: '10 a 25/Set' },
              { id: 'TODO_CICLO', label: 'Ciclo Completo (Set + Out)' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickPreset === p.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setQuickPreset(''); }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setQuickPreset(''); }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>
            {(selectedScheduleId !== 'ALL' || selectedOrderType !== 'ALL' || selectedUnit !== 'ALL' || quickPreset !== 'SET_2026') && (
              <button
                onClick={() => {
                  setSelectedScheduleId('ALL');
                  setSelectedOrderType('ALL');
                  setSelectedUnit('ALL');
                  handleSelectPreset('SET_2026');
                }}
                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                title="Redefinir filtros padrão"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. THE VISUAL EXECUTIVE REPORT CONTAINER (MATCHING USER DASHBOARD IMAGE) */}
      <div className="bg-white rounded-3xl border border-slate-300 shadow-md p-5 sm:p-7 space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Report Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-slate-200">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-950 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardList className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight flex items-center gap-2 flex-wrap">
                <span>
                  {selectedOrderType !== 'ALL'
                    ? `RESUMO DE PEDIDOS ${selectedOrderType.toUpperCase()}S — SESAU/AL`
                    : 'RESUMO GERAL DE PEDIDOS POR CRONOGRAMA — SESAU/AL'}
                </span>
              </h1>
              <p className="text-xs text-blue-700 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Pedidos por data e status da situação</span>
                <span>•</span>
                <span className="font-mono">
                  Período: {startDate ? formatDate(startDate) : 'Início'} a {endDate ? formatDate(endDate) : 'Fim'}
                </span>
                <span>•</span>
                <span className="text-slate-500 font-normal">
                  Atualizado em {new Date().toLocaleDateString('pt-BR')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
            <div className="text-right">
              <div className="text-xs font-black text-slate-800 tracking-wider">SESAU / AL</div>
              <div className="text-[10px] font-mono text-slate-500 font-semibold">Abastecimento Hospitalar</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
              L
            </div>
          </div>
        </div>

        {/* 3. STATUS RIBBON KPI CARDS (MATCHING THE 9 PILLS IN THE IMAGE) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {/* Total de Pedidos */}
          <div className="p-3 bg-white rounded-2xl border-2 border-slate-300 flex flex-col items-center justify-center text-center shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center mb-1">
              <FileSpreadsheet className="w-4 h-4 text-blue-300" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900">
              {filteredOrders.length}
            </div>
            <span className="text-[10px] font-bold text-slate-600 tracking-tight">
              Total de pedidos
            </span>
          </div>

          {/* 8 Status Badges */}
          {STATUS_TAXONOMY.map(statusMeta => {
            const count = statusSummary.counts[statusMeta.key] || 0;
            return (
              <div
                key={statusMeta.key}
                className="p-2.5 bg-white rounded-2xl border border-slate-200/90 hover:border-slate-400 flex flex-col items-center justify-center text-center shadow-2xs transition-all"
              >
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center mb-1 text-white shadow-2xs"
                  style={{ backgroundColor: statusMeta.color }}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
                </div>
                <div 
                  className="text-lg font-black font-mono leading-none my-0.5"
                  style={{ color: statusMeta.color }}
                >
                  {count}
                </div>
                <span className="text-[10px] font-semibold text-slate-700 tracking-tight leading-tight line-clamp-2">
                  {statusMeta.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* 4. TWO-COLUMN MIDDLE SECTION (DISTRIBUIÇÃO DIÁRIA + RESUMO POR STATUS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Distribuição diária por status (Horizontal Stacked Bar Chart) */}
          <div className="lg:col-span-8 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h2 className="text-xs sm:text-sm font-black text-blue-950 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-700 rounded-sm" />
                <span>Distribuição diária por status</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {dailyDistribution.length} datas mapeadas
              </span>
            </div>

            {dailyDistribution.length > 0 ? (
              <div className="space-y-2.5">
                {dailyDistribution.map(dayItem => (
                  <div key={dayItem.dateStr} className="flex items-center gap-3 text-xs">
                    {/* Date Label */}
                    <div className="w-20 font-mono text-[11px] font-bold text-slate-700 shrink-0 text-right">
                      {dayItem.displayDate}
                    </div>

                    {/* Stacked Bar */}
                    <div className="flex-1 bg-slate-200/70 h-7 rounded-lg overflow-hidden flex items-stretch border border-slate-300 relative shadow-2xs">
                      {STATUS_TAXONOMY.map(stMeta => {
                        const count = dayItem.statusCounts[stMeta.key] || 0;
                        if (count === 0) return null;
                        const pctOfMax = (count / maxDayTotal) * 100;

                        return (
                          <div
                            key={stMeta.key}
                            style={{
                              width: `${pctOfMax}%`,
                              backgroundColor: stMeta.color,
                            }}
                            className="h-full flex items-center justify-center text-white text-[10px] font-black font-mono transition-all hover:brightness-110"
                            title={`${dayItem.displayDate} - ${stMeta.label}: ${count} pedido(s)`}
                          >
                            {count >= 2 ? count : ''}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total on Right */}
                    <div className="w-16 font-mono text-xs font-black text-blue-900 shrink-0">
                      Total {dayItem.total}
                    </div>
                  </div>
                ))}

                {/* X-Axis Scale Indicator */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-400 pl-24 pr-16">
                  <span>0</span>
                  <span>{Math.round(maxDayTotal * 0.25)}</span>
                  <span>{Math.round(maxDayTotal * 0.5)}</span>
                  <span>{Math.round(maxDayTotal * 0.75)}</span>
                  <span>{maxDayTotal}</span>
                </div>
                <div className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Quantidade de pedidos por dia
                </div>

                {/* Chart Legend matching image */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-semibold text-slate-700">
                  {STATUS_TAXONOMY.map(st => (
                    <div key={st.key} className="flex items-center gap-1.5">
                      <span 
                        className="w-3 h-3 rounded-xs shrink-0" 
                        style={{ backgroundColor: st.color }} 
                      />
                      <span>{st.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500 italic bg-white rounded-xl border border-slate-200">
                Nenhum pedido encontrado no intervalo de datas selecionado ({startDate} a {endDate}).
              </div>
            )}
          </div>

          {/* RIGHT: Resumo por status (Table matching image) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="p-3 bg-blue-950 text-white flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-400 rounded-sm" />
                <span>Resumo por status</span>
              </h2>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-blue-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {STATUS_TAXONOMY.map(stMeta => {
                  const count = statusSummary.counts[stMeta.key] || 0;
                  return (
                    <tr key={stMeta.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 flex items-center gap-2.5">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs" 
                          style={{ backgroundColor: stMeta.color }}
                        />
                        <span className="font-semibold text-slate-800">{stMeta.label}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-100/70 border-t-2 border-blue-300 font-bold">
                <tr>
                  <td className="py-3 px-4 font-black text-blue-950 text-sm tracking-wider">
                    TOTAL
                  </td>
                  <td className="py-3 px-4 text-right font-black font-mono text-blue-950 text-base">
                    {filteredOrders.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 5. PRINCIPAIS DESTAQUES (MATCHING BOTTOM OF IMAGE) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-300 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Title Badge */}
            <div className="md:col-span-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BarChart3 className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-blue-950 tracking-tight">
                  PRINCIPAIS DESTAQUES
                </h3>
                <p className="text-[11px] text-slate-500">
                  Métricas agregadas do período analisado
                </p>
              </div>
            </div>

            {/* Highlight 1: Peak Daily Volume */}
            <div className="md:col-span-4 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Maior volume diário
                </span>
                <div className="text-base font-black text-blue-950">
                  {highlights.peakCount} pedidos
                </div>
                <span className="text-[11px] text-slate-600 font-medium">
                  {highlights.peakDay}
                </span>
              </div>
            </div>

            {/* Highlight 2: Predominant Status */}
            <div className="md:col-span-4 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Status predominante
                </span>
                <div className="text-base font-black text-red-600">
                  {highlights.predominantStatus}
                </div>
                <span className="text-[11px] text-slate-600 font-medium">
                  {highlights.predominantCount} pedidos ({highlights.predominantPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. DETAILED ORDERS TABLE FOR AUDIT AND VERIFICATION */}
        <div className="space-y-3 pt-4 border-t border-slate-200 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Relação Detalhada dos Pedidos no Relatório ({searchedOrders.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Clique sobre qualquer pedido para inspecionar o histórico completo de movimentações
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por código, unidade ou programa..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 text-slate-900"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Unidade</th>
                    <th className="py-2.5 px-3">Programa / Tipo</th>
                    <th className="py-2.5 px-3">Cronograma</th>
                    <th className="py-2.5 px-3">Data Ref.</th>
                    <th className="py-2.5 px-3 text-right">Itens</th>
                    <th className="py-2.5 px-3">Status Operacional</th>
                    <th className="py-2.5 px-3">Situação SLA</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {searchedOrders.slice(0, 50).map(ord => {
                    const sch = ord.cronograma_id ? schedulesMap.get(ord.cronograma_id) : null;
                    const { situation } = calculateDeadlineSituation(ord, sch, settings.horas_alerta_atencao);
                    const refDate = getOrderRelevantDate(ord);

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => onSelectOrder?.(ord)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {ord.codigo}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {ord.unidade}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700">{ord.programa}</span>
                          <span className="text-[10px] text-slate-500 block">{ord.tipo}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {sch ? (
                            <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                              {sch.nome}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Fora de cronograma</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {refDate ? formatDate(refDate) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          {ord.quantidade_itens}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="text-[11px] font-bold text-slate-800">
                            {ord.status_operacional}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            situation === 'Dentro do prazo' || situation === 'Concluído no prazo'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : situation === 'Atenção'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {situation}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white"
                            title="Ver detalhes"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {searchedOrders.length > 50 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                Exibindo os primeiros 50 pedidos de {searchedOrders.length}. Exporte para Excel (.xlsx) para acessar a planilha completa.
              </div>
            )}
          </div>
        </div>

        {/* 7. OFFICIAL FOOTER NOTE */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
          <div className="flex items-center gap-1.5 font-mono">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>Fonte: PLANILHA OPERACIONAL INTEGRADA DE PEDIDOS — SESAU / ALAGOAS</span>
          </div>
          <div>
            Relatório gerado em conformidade com o cronograma oficial de abastecimento hospitalar.
          </div>
        </div>
      </div>
    </div>
  );
};
