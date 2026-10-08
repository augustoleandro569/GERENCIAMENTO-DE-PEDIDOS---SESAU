import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule, OrderStatus } from '../../types';
import { formatShortDate, formatDate } from '../../utils/dateUtils';
import { calculateDeadlineSituation } from '../../utils/dateUtils';
import { TypeTag, DeadlineBadge, InlineStatusSelect } from '../common/StatusBadge';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { showToast } from '../common/Toast';
import { StageDateFilter } from './UnifiedCalendar';
import { 
  X, 
  CalendarCheck, 
  Download, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Link2, 
  Unlink, 
  Boxes, 
  AlertCircle, 
  Package, 
  Check, 
  Zap, 
  Sparkles,
  Plus
} from 'lucide-react';

interface DayOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number;
  monthNumber: number; // 9 = SET/26, 10 = OUT/26
  onNavigateDay: (newDay: number) => void;
  onSelectOrder?: (order: Order) => void;
  onOpenLinkModal?: () => void;
  onOpenNewSchedule?: (targetDate: string) => void;
  externalFilterUnit?: string;
  externalFilterOrderType?: string;
  externalStageFilter?: StageDateFilter;
  externalFilterUnits?: string[];
  externalFilterOrderTypes?: string[];
  externalStageFilters?: string[];
  onOpenScheduleOrders?: (schedule: Schedule, filter?: 'ALL' | 'NO_PRAZO' | 'FORA_DO_PRAZO') => void;
}

export const DayOrdersModal: React.FC<DayOrdersModalProps> = ({
  isOpen,
  onClose,
  dayNumber,
  monthNumber,
  onNavigateDay,
  onSelectOrder,
  onOpenLinkModal,
  onOpenNewSchedule,
  externalFilterUnit = 'ALL',
  externalFilterOrderType = 'ALL',
  externalStageFilter = 'TODOS',
  externalFilterUnits,
  externalFilterOrderTypes,
  externalStageFilters,
  onOpenScheduleOrders,
}) => {
  const { 
    orders, 
    schedules, 
    settings, 
    currentUser, 
    updateOrder, 
    updateOperationalStatus,
    unlinkOrdersOfDay,
    unlinkOrder
  } = useStore();

  const [editingDateOrderId, setEditingDateOrderId] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState<string>('');
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkOptions, setUnlinkOptions] = useState({
    clearSchedule: true,
    clearDeliveryDate: true,
    clearStageDates: true,
  });

  const monthStr = monthNumber === 9 ? '09' : '10';
  const monthName = monthNumber === 9 ? 'Setembro' : 'Outubro';
  const totalDaysInMonth = monthNumber === 9 ? 30 : 31;
  const isToday = monthNumber === 9 && dayNumber === 24;
  const targetDateStr = `2026-${monthStr}-${String(dayNumber).padStart(2, '0')}`;

  // Multi-filtro externo normalizado
  const effectiveUnits = useMemo(() => {
    if (externalFilterUnits && externalFilterUnits.length > 0) return externalFilterUnits;
    if (externalFilterUnit && externalFilterUnit !== 'ALL') return [externalFilterUnit];
    return [];
  }, [externalFilterUnits, externalFilterUnit]);

  const effectiveOrderTypes = useMemo(() => {
    if (externalFilterOrderTypes && externalFilterOrderTypes.length > 0) return externalFilterOrderTypes;
    if (externalFilterOrderType && externalFilterOrderType !== 'ALL') return [externalFilterOrderType];
    return [];
  }, [externalFilterOrderTypes, externalFilterOrderType]);

  const effectiveStages = useMemo(() => {
    if (externalStageFilters && externalStageFilters.length > 0) return externalStageFilters;
    if (externalStageFilter && externalStageFilter !== 'TODOS') return [externalStageFilter];
    return [];
  }, [externalStageFilters, externalStageFilter]);

  // Schedules map for SLA calculation and linked date fallback
  const schedulesMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    schedules.forEach(s => map.set(s.id, s));
    return map;
  }, [schedules]);

  // Helper to extract day number from date string
  const matchesDay = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split(' ')[0].split('-');
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[2], 10) === dayNumber;
        } else {
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[0], 10) === dayNumber;
        }
      }
    } else if (clean.includes('/')) {
      const parts = clean.split(' ')[0].split('/');
      if (parts.length >= 3) {
        if (parts[2].length === 4) {
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[2], 10) === dayNumber;
        } else {
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[2], 10) === dayNumber;
        }
      }
    }
    return false;
  };

  // Group active orders for this day, strictly filtering out unlinked items and respecting external filters
  const dayCategorized = useMemo(() => {
    const entregas: Order[] = [];
    const separacoes: Order[] = [];

    orders.forEach(o => {
      // Pedidos desvinculados sem cronograma e sem datas agendadas não pertencem ao dia
      if (o.cronograma_vinculo === 'NENHUM' && !o.cronograma_id && !o.data_prevista_entrega) {
        return;
      }

      // Aplica multi-filtros externos
      if (effectiveUnits.length > 0) {
        const uLow = (o.unidade || '').toLowerCase();
        const matchesUnit = effectiveUnits.some(eu => {
          const euLow = eu.toLowerCase();
          return uLow === euLow || uLow.includes(euLow) || euLow.includes(uLow);
        });
        if (!matchesUnit) return;
      }
      if (effectiveOrderTypes.length > 0 && !effectiveOrderTypes.includes(o.tipo)) {
        return;
      }

      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : undefined;

      // 1. Entrega / Expedição: unificada em 1 só etapa (expedição é a mesma que entrega)
      const dEntrega = o.data_prevista_entrega || o.data_expedicao || sch?.data_entrega || sch?.data_expedicao;
      if (matchesDay(dEntrega)) {
        entregas.push(o);
      }

      // 2. Separação: explicit separation or schedule separation
      const dSep = o.data_inicio_separacao || sch?.data_separacao;
      if (matchesDay(dSep)) {
        separacoes.push(o);
      }
    });

    // Conjunto unificado de todos os pedidos ativos do dia
    const allUniqueMap = new Map<string, Order>();
    [...entregas, ...separacoes].forEach(o => {
      allUniqueMap.set(o.id, o);
    });

    return {
      todos: Array.from(allUniqueMap.values()),
      entregas,
      separacoes,
    };
  }, [orders, schedules, dayNumber, monthStr, effectiveUnits, effectiveOrderTypes, schedulesMap]);

  // Lista de pedidos que segue estritamente o filtro de etapa externo (suporta multi-seleção de etapas)
  const displayedOrders = useMemo(() => {
    if (effectiveStages.length === 0 || effectiveStages.includes('TODOS')) {
      return dayCategorized.todos;
    }
    const orderSet = new Set<string>();
    const list: Order[] = [];

    if (effectiveStages.includes('ENTREGA')) {
      dayCategorized.entregas.forEach(o => {
        if (!orderSet.has(o.id)) { orderSet.add(o.id); list.push(o); }
      });
    }
    if (effectiveStages.includes('SEPARACAO')) {
      dayCategorized.separacoes.forEach(o => {
        if (!orderSet.has(o.id)) { orderSet.add(o.id); list.push(o); }
      });
    }

    return list;
  }, [effectiveStages, dayCategorized]);

  // Indicador legível das etapas externas
  const stageFilterLabel = useMemo(() => {
    if (effectiveStages.length === 0 || effectiveStages.includes('TODOS')) {
      return 'Todas as Etapas';
    }
    const mapLabels: Record<string, string> = {
      ENTREGA: 'Entregas',
      SEPARACAO: 'Separações',
    };
    return effectiveStages.map(s => mapLabels[s] || s).join(', ');
  }, [effectiveStages]);

  // KPIs agregados
  const kpis = useMemo(() => {
    const totalOrders = dayCategorized.todos.length;
    let totalItems = 0;
    let urgentes = 0;
    let entregues = 0;

    dayCategorized.todos.forEach(o => {
      totalItems += o.quantidade_itens || 0;
      if (o.tipo === 'Emergencial' || o.tipo === 'Falta') urgentes++;
      if (o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente') entregues++;
    });

    return {
      totalOrders,
      totalItems,
      urgentes,
      entregues,
      entregasCount: dayCategorized.entregas.length,
      separacoesCount: dayCategorized.separacoes.length,
    };
  }, [dayCategorized]);

  const dayOfWeek = useMemo(() => {
    const d = new Date(2026, monthNumber - 1, dayNumber);
    return d.toLocaleDateString('pt-BR', { weekday: 'long' });
  }, [monthNumber, dayNumber]);

  if (!isOpen) return null;

  const handleExportDay = () => {
    const listToExport = displayedOrders.length > 0 ? displayedOrders : dayCategorized.todos;
    if (listToExport.length === 0) {
      showToast('info', 'Sem pedidos', 'Não há pedidos para exportar neste dia.');
      return;
    }
    exportOrdersToSpreadsheet(listToExport, 'xlsx', `pedidos_dia_${String(dayNumber).padStart(2, '0')}_${monthStr}_2026`);
    showToast('success', 'Planilha exportada', `${listToExport.length} pedidos do dia foram exportados com sucesso.`);
  };

  const handleSaveInitialDate = (order: Order) => {
    if (!tempDateValue) {
      setEditingDateOrderId(null);
      return;
    }
    updateOrder(order.id, { 
      data_inicio: tempDateValue,
      data_solicitacao: order.data_solicitacao || tempDateValue,
    }, currentUser, `Data de inicialização definida para ${formatShortDate(tempDateValue)}`);
    showToast('success', `${order.codigo} atualizado`, `Data de inicialização: ${formatShortDate(tempDateValue)}`);
    setEditingDateOrderId(null);
  };

  const handleShiftDate = (order: Order, deltaDays: number) => {
    const curDay = dayNumber;
    const targetDay = Math.min(totalDaysInMonth, Math.max(1, curDay + deltaDays));
    const newTargetDate = `2026-${monthStr}-${String(targetDay).padStart(2, '0')}`;
    updateOrder(order.id, { data_prevista_entrega: newTargetDate }, currentUser, `Reagendado para dia ${targetDay}`);
    showToast('success', `${order.codigo} reagendado`, `Nova data prevista: ${targetDay}/${monthStr}/2026`);
  };

  const handleConfirmBatchUnlink = async () => {
    try {
      setIsUnlinking(true);
      const result = await unlinkOrdersOfDay(dayNumber, monthNumber, {
        clearSchedule: unlinkOptions.clearSchedule,
        clearDeliveryDate: unlinkOptions.clearDeliveryDate,
        clearStageDates: unlinkOptions.clearStageDates,
        responsavel: currentUser,
        motivo: `Desvinculação em lote realizada por ${currentUser.nome} no dia ${dayNumber}/${monthStr}/2026`,
      });

      if (result.unlinkedCount > 0) {
        showToast(
          'success',
          'Pedidos Desvinculados!',
          `${result.unlinkedCount} pedido(s) foram desvinculados do dia ${dayNumber}/${monthStr}/2026 com sucesso.`
        );
      } else {
        showToast(
          'info',
          'Nenhum pedido vinculado',
          'Não há pedidos com vínculos ativos para serem desvinculados neste dia.'
        );
      }
      setIsUnlinkConfirmOpen(false);
    } catch (err) {
      showToast('error', 'Erro ao desvincular', 'Ocorreu uma falha ao tentar desvincular os pedidos.');
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Date Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-300 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-950 tracking-tight">
                  Visualização Completa do Dia {dayNumber} de {monthName} de 2026
                </h3>
                {isToday && (
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-300">
                    Hoje
                  </span>
                )}
                <span className="text-xs font-mono text-slate-600 font-semibold capitalize hidden md:inline">
                  ({dayOfWeek})
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Controle operacional de entregas/expedições e separações agendadas (solicitação e aprovação para controle interno)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Day Navigators */}
            <div className="flex items-center p-1 bg-white rounded-xl border border-slate-300 shadow-2xs">
              <button
                onClick={() => onNavigateDay(Math.max(1, dayNumber - 1))}
                disabled={dayNumber <= 1}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-950 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <span className="text-xs font-mono font-bold text-blue-900 px-3 py-0.5 bg-blue-50 rounded-lg border border-blue-200">
                {String(dayNumber).padStart(2, '0')}/{monthStr}/26
              </span>

              <button
                onClick={() => onNavigateDay(Math.min(totalDaysInMonth, dayNumber + 1))}
                disabled={dayNumber >= totalDaysInMonth}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-950 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Próximo Dia"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-950 flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day Metric Highlights Bar (KPIs) - Crisp high contrast */}
        <div className="p-4 bg-slate-100/60 border-b border-slate-300 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-300 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total no Dia
            </span>
            <div className="text-lg font-bold font-mono text-slate-950 mt-0.5">
              {kpis.totalOrders} <span className="text-xs font-normal text-slate-500">pedidos</span>
            </div>
            <span className="text-[10px] text-slate-600 font-mono font-medium">
              {kpis.totalItems} itens totais
            </span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-300 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Entregas / Expedição</span>
            </span>
            <div className="text-lg font-bold font-mono text-emerald-950 mt-0.5">
              {kpis.entregasCount}
            </div>
            <span className="text-[10px] text-emerald-800 font-medium">
              Agendadas p/ hospital
            </span>
          </div>

          <div className="bg-purple-50 p-3 rounded-2xl border border-purple-300 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              <span>Separações</span>
            </span>
            <div className="text-lg font-bold font-mono text-purple-950 mt-0.5">
              {kpis.separacoesCount}
            </div>
            <span className="text-[10px] text-purple-800 font-medium">
              Em picking / packing
            </span>
          </div>

          <div className="bg-rose-50 p-3 rounded-2xl border border-rose-300 shadow-2xs">
            <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Urgências</span>
            </span>
            <div className="text-lg font-bold font-mono text-rose-950 mt-0.5">
              {kpis.urgentes}
            </div>
            <span className="text-[10px] text-rose-800 font-medium">
              Emergencial / Falta
            </span>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-300 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Status Entregue</span>
            </span>
            <div className="text-lg font-bold font-mono text-emerald-950 mt-0.5">
              {kpis.entregues}
            </div>
            <span className="text-[10px] text-emerald-800 font-medium">
              Pedidos finalizados
            </span>
          </div>
        </div>

        {/* Inherited External Filters Banner - ZERO internal filter controls */}
        <div className="px-4 py-3 bg-white border-b border-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Filtros Ativos do Calendário:
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 font-bold shadow-2xs">
              <span className="text-slate-500 font-normal">Etapas:</span>
              <span>{stageFilterLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 font-bold shadow-2xs">
              <span className="text-slate-500 font-normal">Unidades:</span>
              <span>{effectiveUnits.length === 0 ? 'Todas as Unidades' : effectiveUnits.join(', ')}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 font-bold shadow-2xs">
              <span className="text-slate-500 font-normal">Tipos:</span>
              <span>{effectiveOrderTypes.length === 0 ? 'Todos os Tipos' : effectiveOrderTypes.join(', ')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportDay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            {onOpenNewSchedule && currentUser.role !== 'VIEWER' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewSchedule(targetDateStr);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Registrar novo cronograma com múltiplas unidades para este dia"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Criar Cronograma</span>
              </button>
            )}

            {onOpenLinkModal && currentUser.role !== 'VIEWER' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenLinkModal();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
                title="Vincular um ou múltiplos pedidos a este dia do calendário"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>+ Vincular Pedidos a este Dia</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* VIEW ORDERS TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {externalStageFilter === 'TODOS' ? 'Todos os Pedidos Ativos Neste Dia' : `Pedidos na Etapa: ${stageFilterLabel}`}
                </span>
                <span className="text-[11px] font-mono text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full font-bold border border-blue-300">
                  {displayedOrders.length} resultado(s)
                </span>
              </div>
            </div>

              {displayedOrders.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-3.5">Código / Origem</th>
                          <th className="py-3 px-3">Unidade Hospitalar</th>
                          <th className="py-3 px-3">Programa & Tipo</th>
                          <th className="py-3 px-3 text-right">Itens</th>
                          <th className="py-3 px-3">
                            <span className="flex items-center gap-1 text-blue-900 font-bold">
                              <Sparkles className="w-3 h-3 text-blue-600" />
                              Data Inicialização
                            </span>
                          </th>
                          <th className="py-3 px-3">Etapa no Dia {dayNumber}</th>
                          <th className="py-3 px-3">Situação SLA</th>
                          <th className="py-3 px-3">
                            <span className="flex items-center gap-1 text-slate-900 font-bold">
                              <Zap className="w-3.5 h-3.5 text-blue-600" />
                              Status (1-Clique)
                            </span>
                          </th>
                          <th className="py-3 px-3 text-center">Reagendar</th>
                          <th className="py-3 px-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-normal">
                        {displayedOrders.map((order, idx) => {
                          const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                          const { situation, label } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);

                          const isEntregaHoje = matchesDay(order.data_prevista_entrega || order.data_expedicao || sch?.data_entrega || sch?.data_expedicao);
                          const isSepHoje = matchesDay(order.data_inicio_separacao || sch?.data_separacao);

                          const isOrderLinked = Boolean(order.cronograma_id || order.data_prevista_entrega);

                          return (
                            <tr 
                              key={`${order.id}-${idx}`}
                              className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                              onClick={() => {
                                onClose();
                                onSelectOrder?.(order);
                              }}
                            >
                              <td className="py-2.5 px-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-blue-700 group-hover:underline">
                                    {order.codigo}
                                  </span>
                                  {order.origem === 'MANUAL' && (
                                    <span className="text-[9px] font-mono text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded-md border border-purple-300 font-bold">
                                      MANUAL
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {order.unidade}
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <TypeTag type={order.tipo} />
                                  <span className="text-slate-500 text-[11px] truncate max-w-[120px]">
                                    {order.programa}
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                                {order.quantidade_itens}
                              </td>

                              {/* Editable initialization date */}
                              <td 
                                className="py-2 px-3 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {editingDateOrderId === order.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="date"
                                      value={tempDateValue}
                                      onChange={(e) => setTempDateValue(e.target.value)}
                                      className="text-xs bg-white border border-blue-500 rounded-lg px-2 py-0.5 text-slate-900 font-mono shadow-xs focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInitialDate(order)}
                                      className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-md"
                                      title="Salvar"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDateOrderId(null)}
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                                      title="Cancelar"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {order.data_inicio ? (
                                      <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-300 text-[11px]">
                                        {formatShortDate(order.data_inicio)}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-amber-800 font-semibold italic">
                                        Não definida
                                      </span>
                                    )}

                                    {currentUser.role !== 'VIEWER' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDateOrderId(order.id);
                                          setTempDateValue(order.data_inicio || order.data_solicitacao || targetDateStr);
                                        }}
                                        className="text-[10px] text-blue-700 hover:text-blue-950 font-bold hover:underline px-1 py-0.5 rounded-md hover:bg-blue-100 cursor-pointer"
                                        title="Definir data de inicialização"
                                      >
                                        {order.data_inicio ? 'Alterar' : '+ Definir'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Stage on Day - Somente tag de entrega */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                                  {isEntregaHoje ? (
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                      <span>Entrega Agendada</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal text-[10px]">
                                      -
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <DeadlineBadge situation={situation} label={label} />
                              </td>

                              {/* Inline status update */}
                              <td 
                                className="py-1.5 px-3 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <InlineStatusSelect
                                  currentStatus={order.status_operacional}
                                  onStatusChange={(newSt) => {
                                    updateOperationalStatus(order.id, newSt, currentUser, `Alteração rápida no modal do dia ${dayNumber}`);
                                    showToast('success', `${order.codigo} atualizado`, `Status: ${newSt}`);
                                  }}
                                  disabled={currentUser.role === 'VIEWER'}
                                />
                              </td>

                              {/* Shift date buttons */}
                              <td 
                                className="py-2 px-3 text-center whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {currentUser.role !== 'VIEWER' ? (
                                  <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-300">
                                    <button
                                      type="button"
                                      onClick={() => handleShiftDate(order, -1)}
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:text-slate-950 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Reagendar para o dia anterior (-1 dia)"
                                    >
                                      -1d
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleShiftDate(order, 1)}
                                      className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:text-slate-950 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Reagendar para o próximo dia (+1 dia)"
                                    >
                                      +1d
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono">—</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td 
                                className="py-2.5 px-3 text-center whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onSelectOrder?.(order);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-100 border border-blue-300 transition-all cursor-pointer"
                                    title="Ver detalhes completos"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Ver</span>
                                  </button>

                                  {currentUser.role !== 'VIEWER' && isOrderLinked && (
                                    <button
                                      onClick={async () => {
                                        await unlinkOrder(order.id, currentUser, `Desvinculado no modal do dia ${dayNumber}/${monthStr}/2026`);
                                        showToast('info', `${order.codigo} desvinculado`, 'Data e cronograma foram removidos do pedido.');
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Desvincular pedido deste dia e cronograma"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 italic bg-slate-50 rounded-2xl border border-slate-300 flex flex-col items-center justify-center gap-3">
                  <p>Nenhum pedido encontrado para os filtros ativos do calendário neste dia.</p>
                  {onOpenLinkModal && currentUser.role !== 'VIEWER' && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenLinkModal();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer not-italic"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>+ Vincular Pedidos a este Dia</span>
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-medium">
            Exibindo <span className="font-mono font-bold text-slate-900">{displayedOrders.length}</span> pedido(s) ativo(s) no dia <span className="font-mono font-bold text-blue-800">{dayNumber}/{monthStr}/2026</span>
          </div>

          <div className="flex items-center gap-2">
            {dayCategorized.todos.length > 0 && currentUser.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                title={`Desvincular todos os ${dayCategorized.todos.length} pedidos do dia ${dayNumber}/${monthStr}`}
              >
                <Unlink className="w-3.5 h-3.5 text-rose-600" />
                <span>Desvincular Pedidos ({dayCategorized.todos.length})</span>
              </button>
            )}

            <button
              onClick={handleExportDay}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Romaneio</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Unlink All Orders of the Day */}
      {isUnlinkConfirmOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-150"
          onClick={() => !isUnlinking && setIsUnlinkConfirmOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-300 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Unlink className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  Desvincular Pedidos do Dia {dayNumber}/{monthStr}/2026?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Esta ação irá desvincular <strong>{dayCategorized.todos.length} pedido(s)</strong> atualmente programados para este dia.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Boxes className="w-3.5 h-3.5 text-blue-600" />
                <span>Opções de Desvinculação:</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlinkOptions.clearDeliveryDate}
                  onChange={(e) => setUnlinkOptions(prev => ({ ...prev, clearDeliveryDate: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700">Limpar data prevista de entrega dos pedidos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlinkOptions.clearSchedule}
                  onChange={(e) => setUnlinkOptions(prev => ({ ...prev, clearSchedule: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700">Remover vínculo com o Cronograma Oficial</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlinkOptions.clearStageDates}
                  onChange={(e) => setUnlinkOptions(prev => ({ ...prev, clearStageDates: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700">Limpar etapas operacionais vinculadas a este dia</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(false)}
                disabled={isUnlinking}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmBatchUnlink}
                disabled={isUnlinking}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {isUnlinking ? (
                  <span>Desvinculando...</span>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Confirmar Desvinculação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
