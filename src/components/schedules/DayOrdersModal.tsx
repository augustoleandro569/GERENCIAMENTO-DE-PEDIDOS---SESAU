import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule, OrderStatus } from '../../types';
import { formatShortDate, formatDate } from '../../utils/dateUtils';
import { calculateDeadlineSituation } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge, PriorityBadge, InlineStatusSelect } from '../common/StatusBadge';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { showToast } from '../common/Toast';
import { 
  X, 
  Calendar, 
  CalendarCheck, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Link2, 
  Unlink, 
  Boxes, 
  Truck, 
  CheckCircle2, 
  Clock, 
  FileText, 
  AlertCircle, 
  Package, 
  Check, 
  Zap, 
  Maximize2,
  CalendarDays,
  Sparkles,
  Plus,
  RefreshCw
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
  initialOrderType?: string;
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
  initialOrderType = 'ALL',
  onOpenScheduleOrders,
}) => {
  const { 
    orders, 
    schedules, 
    units, 
    orderTypes, 
    settings, 
    currentUser, 
    updateOrder, 
    updateOperationalStatus,
    unlinkOrdersOfDay,
    unlinkOrder
  } = useStore();

  const [activeTab, setActiveTab] = useState<'TODOS' | 'ENTREGA' | 'SEPARACAO' | 'EXPEDICAO' | 'APROVACAO' | 'SOLICITACAO' | 'MARCOS'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterOrderType, setFilterOrderType] = useState<string>(initialOrderType || 'ALL');
  const [filterSLA, setFilterSLA] = useState<'ALL' | 'NO_PRAZO' | 'FORA_DO_PRAZO' | 'ATENCAO'>('ALL');
  const [editingDateOrderId, setEditingDateOrderId] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState<string>('');
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkOptions, setUnlinkOptions] = useState({
    clearSchedule: true,
    clearDeliveryDate: true,
    clearStageDates: true,
  });

  useEffect(() => {
    if (initialOrderType) {
      setFilterOrderType(initialOrderType);
    }
  }, [initialOrderType]);

  const monthStr = monthNumber === 9 ? '09' : '10';
  const monthName = monthNumber === 9 ? 'Setembro' : 'Outubro';
  const totalDaysInMonth = monthNumber === 9 ? 30 : 31;
  const isToday = monthNumber === 9 && dayNumber === 24;

  const targetDateStr = `2026-${monthStr}-${String(dayNumber).padStart(2, '0')}`;

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
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[0], 10) === dayNumber;
        } else {
          return parseInt(parts[1], 10) === monthNumber && parseInt(parts[2], 10) === dayNumber;
        }
      }
    }
    return false;
  };

  // Group orders for this day, taking into account explicit order dates AND schedule-linked dates
  const dayCategorized = useMemo(() => {
    const entregas: Order[] = [];
    const separacoes: Order[] = [];
    const expedicoes: Order[] = [];
    const aprovacoes: Order[] = [];
    const solicitacoes: Order[] = [];

    orders.forEach(o => {
      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      let matchedAny = false;

      // 1. Entrega: explicit delivery or schedule delivery
      const dEntrega = o.data_prevista_entrega || sch?.data_entrega;
      if (matchesDay(dEntrega)) {
        entregas.push(o);
        matchedAny = true;
      }

      // 2. Separação: explicit separation or schedule separation
      const dSep = o.data_inicio_separacao || sch?.data_separacao;
      if (matchesDay(dSep)) {
        separacoes.push(o);
        matchedAny = true;
      }

      // 3. Expedição: explicit expedition or schedule expedition
      const dExp = o.data_expedicao || sch?.data_expedicao;
      if (matchesDay(dExp)) {
        expedicoes.push(o);
        matchedAny = true;
      }

      // 4. Aprovação: explicit approval or schedule approval limit
      const dAprov = o.data_aprovacao || sch?.data_limite_aprovacao;
      if (matchesDay(dAprov)) {
        aprovacoes.push(o);
        matchedAny = true;
      }

      // 5. Solicitação: explicit solicitation or schedule solicitation limit
      const dSol = o.data_solicitacao || sch?.data_limite_solicitacao;
      if (matchesDay(dSol)) {
        solicitacoes.push(o);
        matchedAny = true;
      }
    });

    // Unified set of all unique orders involved in this day
    const allUniqueMap = new Map<string, Order>();
    [...entregas, ...separacoes, ...expedicoes, ...aprovacoes, ...solicitacoes].forEach(o => {
      allUniqueMap.set(o.id, o);
    });

    // Official milestones on this day
    const marcos: { sch: Schedule; stage: string; color: string }[] = [];
    schedules.forEach(sch => {
      if (filterUnit !== 'ALL') {
        const q = filterUnit.toUpperCase().trim();
        const matchesUnit = 
          (sch.unidade && sch.unidade.toUpperCase().trim() === q) ||
          (sch.unidades && sch.unidades.some(u => u.toUpperCase().trim() === q)) ||
          (sch.unidade && sch.unidade.split(',').map(x => x.trim().toUpperCase()).includes(q));
        if (!matchesUnit) return;
      }
      if (matchesDay(sch.data_limite_solicitacao)) {
        marcos.push({ sch, stage: 'Limite para Envio de Solicitações', color: 'bg-blue-100 text-blue-800' });
      }
      if (matchesDay(sch.data_limite_aprovacao)) {
        marcos.push({ sch, stage: 'Limite para Validação SESAU', color: 'bg-amber-100 text-amber-800' });
      }
      if (matchesDay(sch.data_separacao)) {
        marcos.push({ sch, stage: 'Data Prevista de Separação em Almoxarifado', color: 'bg-purple-100 text-purple-800' });
      }
      if (matchesDay(sch.data_expedicao)) {
        marcos.push({ sch, stage: 'Data Prevista de Expedição & Carga', color: 'bg-cyan-100 text-cyan-800' });
      }
      if (matchesDay(sch.data_entrega)) {
        marcos.push({ sch, stage: 'Previsão de Entrega no Hospital', color: 'bg-emerald-100 text-emerald-800' });
      }
    });

    return {
      todos: Array.from(allUniqueMap.values()),
      entregas,
      separacoes,
      expedicoes,
      aprovacoes,
      solicitacoes,
      marcos,
    };
  }, [orders, schedules, dayNumber, monthStr, filterUnit, schedulesMap]);

  // Order types breakdown for this specific day
  const dayTypesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    dayCategorized.todos.forEach(o => {
      const t = o.tipo || 'Mensal';
      map.set(t, (map.get(t) || 0) + 1);
    });
    return map;
  }, [dayCategorized.todos]);

  // Active list based on selected tab and filtered by order type
  const tabOrders = useMemo(() => {
    let list: Order[];
    switch (activeTab) {
      case 'ENTREGA': list = dayCategorized.entregas; break;
      case 'SEPARACAO': list = dayCategorized.separacoes; break;
      case 'EXPEDICAO': list = dayCategorized.expedicoes; break;
      case 'APROVACAO': list = dayCategorized.aprovacoes; break;
      case 'SOLICITACAO': list = dayCategorized.solicitacoes; break;
      case 'MARCOS': list = []; break;
      default: list = dayCategorized.todos; break;
    }

    if (filterOrderType !== 'ALL') {
      return list.filter(o => o.tipo === filterOrderType);
    }
    return list;
  }, [activeTab, dayCategorized, filterOrderType]);

  // Filtered by Search & Unit & Order Type & SLA
  const filteredOrders = useMemo(() => {
    return tabOrders.filter(o => {
      if (filterUnit !== 'ALL' && o.unidade !== filterUnit) return false;
      if (filterSLA !== 'ALL') {
        const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
        const { situation } = calculateDeadlineSituation(o, sch, settings?.horas_alerta_atencao || 48);
        if (filterSLA === 'NO_PRAZO' && situation !== 'Dentro do prazo' && situation !== 'Concluído no prazo') return false;
        if (filterSLA === 'ATENCAO' && situation !== 'Atenção') return false;
        if (filterSLA === 'FORA_DO_PRAZO' && situation !== 'Atrasado' && situation !== 'Concluído com atraso') return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCode = o.codigo.toLowerCase().includes(q);
        const matchesUnit = o.unidade.toLowerCase().includes(q);
        const matchesRequester = o.solicitante.toLowerCase().includes(q);
        const matchesProgram = o.programa.toLowerCase().includes(q);
        const matchesType = o.tipo.toLowerCase().includes(q);
        if (!matchesCode && !matchesUnit && !matchesRequester && !matchesProgram && !matchesType) return false;
      }
      return true;
    });
  }, [tabOrders, filterUnit, filterSLA, searchTerm, schedulesMap, settings]);

  // Aggregated KPIs for the day (adjusted dynamically by order type filter)
  const kpis = useMemo(() => {
    const baseList = filterOrderType === 'ALL'
      ? dayCategorized.todos
      : dayCategorized.todos.filter(o => o.tipo === filterOrderType);

    const totalOrders = baseList.length;
    let totalItems = 0;
    let urgentes = 0;
    let entregues = 0;
    let noPrazo = 0;
    let atencao = 0;
    let foraDoPrazo = 0;
    let uninitializedCount = 0;

    baseList.forEach(o => {
      totalItems += o.quantidade_itens || 0;
      if (o.tipo === 'Emergencial' || o.tipo === 'Falta') urgentes++;
      if (o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente') entregues++;

      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(o, sch, settings?.horas_alerta_atencao || 48);
      if (situation === 'Dentro do prazo' || situation === 'Concluído no prazo') {
        noPrazo++;
      } else if (situation === 'Atenção') {
        atencao++;
      } else if (situation === 'Atrasado' || situation === 'Concluído com atraso') {
        foraDoPrazo++;
      }

      if (!o.data_inicio) {
        uninitializedCount++;
      }
    });

    const entregasCount = filterOrderType === 'ALL'
      ? dayCategorized.entregas.length
      : dayCategorized.entregas.filter(o => o.tipo === filterOrderType).length;

    const separacoesCount = filterOrderType === 'ALL'
      ? dayCategorized.separacoes.length
      : dayCategorized.separacoes.filter(o => o.tipo === filterOrderType).length;

    const expedicoesCount = filterOrderType === 'ALL'
      ? dayCategorized.expedicoes.length
      : dayCategorized.expedicoes.filter(o => o.tipo === filterOrderType).length;

    const marcosCount = filterOrderType === 'ALL'
      ? dayCategorized.marcos.length
      : dayCategorized.marcos.filter(m => m.sch.tipo_pedido === filterOrderType).length;

    return {
      totalOrders,
      totalItems,
      urgentes,
      entregues,
      entregasCount,
      separacoesCount,
      expedicoesCount,
      marcosCount,
      noPrazo,
      atencao,
      foraDoPrazo,
      uninitializedCount,
      taxaNoPrazo: totalOrders > 0 ? Math.round((noPrazo / totalOrders) * 100) : 100,
    };
  }, [dayCategorized, filterOrderType, schedulesMap, settings]);

  // Day of week calculation
  const dayOfWeek = useMemo(() => {
    try {
      const d = new Date(2026, monthNumber - 1, dayNumber);
      const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      return days[d.getDay()];
    } catch {
      return '';
    }
  }, [dayNumber, monthNumber]);

  if (!isOpen) return null;

  const handleShiftOrderDate = (order: Order, deltaDays: number) => {
    const targetDay = Math.min(totalDaysInMonth, Math.max(1, dayNumber + deltaDays));
    const newTargetDate = `2026-${monthStr}-${String(targetDay).padStart(2, '0')}`;
    updateOrder(order.id, { data_prevista_entrega: newTargetDate }, currentUser, `Reagendado do dia ${dayNumber} para ${targetDay}`);
    showToast('success', `${order.codigo} reagendado`, `Nova data prevista: ${targetDay}/${monthStr}/2026`);
  };

  const handleQuickSetInitialDate = (order: Order, dateStr: string) => {
    if (!dateStr) return;
    updateOrder(order.id, { 
      data_inicio: dateStr,
      data_solicitacao: order.data_solicitacao || dateStr,
    }, currentUser, 'Data de inicialização definida no modal do dia');
    showToast('success', `${order.codigo} atualizado`, `Data de inicialização: ${formatShortDate(dateStr)}`);
    setEditingDateOrderId(null);
  };

  const handleBatchSetInitialDates = () => {
    const uninitialized = filteredOrders.filter(o => !o.data_inicio);
    if (uninitialized.length === 0) {
      showToast('info', 'Todos já inicializados', 'Todos os pedidos exibidos já possuem data de inicialização definida.');
      return;
    }

    uninitialized.forEach(o => {
      updateOrder(o.id, { 
        data_inicio: targetDateStr,
        data_solicitacao: o.data_solicitacao || targetDateStr,
      }, currentUser, 'Inicialização em lote no dia');
    });

    showToast('success', 'Inicialização em Lote', `${uninitialized.length} pedidos inicializados com a data ${formatShortDate(targetDateStr)}.`);
  };

  const handleExportDay = () => {
    exportOrdersToSpreadsheet(
      filteredOrders.length > 0 ? filteredOrders : dayCategorized.todos,
      'xlsx',
      `romaneio_pedidos_${dayNumber}_${monthStr}_2026`
    );
    showToast('success', 'Planilha gerada com sucesso!', `Exportados os pedidos do dia ${dayNumber}/${monthStr}/2026.`);
  };

  const handleUnlinkAllOrders = async () => {
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
          `Não há pedidos com vínculos ativos para serem desvinculados neste dia.`
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Date Switcher - Rounded Top */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Visualização Completa do Dia {dayNumber} de {monthName} de 2026
                </h3>
                {isToday && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/90 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Hoje
                  </span>
                )}
                <span className="text-xs font-mono text-slate-500 font-semibold hidden md:inline">
                  ({dayOfWeek})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle detalhado de todas as solicitações, entregas, expedições e separações agendadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Day Navigators */}
            <div className="flex items-center p-1 bg-white rounded-full border border-slate-200 shadow-2xs">
              <button
                onClick={() => onNavigateDay(Math.max(1, dayNumber - 1))}
                disabled={dayNumber <= 1}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <span className="text-xs font-mono font-bold text-blue-700 px-3 py-0.5 bg-blue-50 rounded-full border border-blue-200/80">
                {String(dayNumber).padStart(2, '0')}/{monthStr}/26
              </span>

              <button
                onClick={() => onNavigateDay(Math.min(totalDaysInMonth, dayNumber + 1))}
                disabled={dayNumber >= totalDaysInMonth}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Próximo Dia"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day Metric Highlights Bar (KPIs) */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total no Dia
            </span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
              {kpis.totalOrders} <span className="text-xs font-normal text-slate-400">pedidos</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {kpis.totalItems} itens totais
            </span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Entregas</span>
            </span>
            <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">
              {kpis.entregasCount}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">
              Agendadas p/ hospital
            </span>
          </div>

          <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>Separações</span>
            </span>
            <div className="text-lg font-bold font-mono text-purple-900 mt-0.5">
              {kpis.separacoesCount}
            </div>
            <span className="text-[10px] text-purple-700 font-medium">
              Em picking / packing
            </span>
          </div>

          <div className="bg-cyan-50/60 p-3 rounded-2xl border border-cyan-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>Expedições</span>
            </span>
            <div className="text-lg font-bold font-mono text-cyan-900 mt-0.5">
              {kpis.expedicoesCount}
            </div>
            <span className="text-[10px] text-cyan-700 font-medium">
              Carga / transporte
            </span>
          </div>

          <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              <span>Urgências</span>
            </span>
            <div className="text-lg font-bold font-mono text-rose-900 mt-0.5">
              {kpis.urgentes}
            </div>
            <span className="text-[10px] text-rose-700 font-medium">
              Emergencial / Falta
            </span>
          </div>

          <div className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
              Marcos Oficiais
            </span>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {kpis.marcosCount}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Limites do ciclo
            </span>
          </div>
        </div>

        {/* Stage Filter Tabs Bar & Search - Rounded Full Controls */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Stage Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100/80 rounded-full border border-slate-200/60 text-xs">
            {[
              { id: 'TODOS', label: 'Todos os Pedidos', count: kpis.totalOrders },
              { id: 'ENTREGA', label: '🟢 Entregas', count: kpis.entregasCount },
              { id: 'SEPARACAO', label: '🟣 Separações', count: kpis.separacoesCount },
              { id: 'EXPEDICAO', label: '🟠 Expedições', count: kpis.expedicoesCount },
              { id: 'APROVACAO', label: '🟡 Aprovações', count: filterOrderType === 'ALL' ? dayCategorized.aprovacoes.length : dayCategorized.aprovacoes.filter(o => o.tipo === filterOrderType).length },
              { id: 'SOLICITACAO', label: '🔵 Solicitações', count: filterOrderType === 'ALL' ? dayCategorized.solicitacoes.length : dayCategorized.solicitacoes.filter(o => o.tipo === filterOrderType).length },
              { id: 'MARCOS', label: '🏁 Marcos Oficiais', count: kpis.marcosCount },
            ].map(tab => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap font-medium ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Type & Unit Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar pedido..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
            </div>

            {/* Filter by Type */}
            <select
              value={filterOrderType}
              onChange={(e) => setFilterOrderType(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">Todos os Tipos ({dayCategorized.todos.length})</option>
              {orderTypes.map(t => (
                <option key={t.id} value={t.nome}>
                  {t.nome} ({dayTypesCountMap.get(t.nome) || 0})
                </option>
              ))}
            </select>

            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">Todas as Unidades</option>
              {units.map(u => (
                <option key={u.id} value={u.sigla}>{u.sigla}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Order Types Pills Filter Bar */}
        <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Tipo de Pedido:
            </span>
            <button
              onClick={() => setFilterOrderType('ALL')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterOrderType === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <span>Todos</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                filterOrderType === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {dayCategorized.todos.length}
              </span>
            </button>

            {orderTypes.map(typeConfig => {
              const count = dayTypesCountMap.get(typeConfig.nome) || 0;
              const isSelected = filterOrderType === typeConfig.nome;
              return (
                <button
                  key={typeConfig.id}
                  onClick={() => setFilterOrderType(isSelected ? 'ALL' : typeConfig.nome)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                  title={`Filtrar apenas pedidos do tipo ${typeConfig.nome}`}
                >
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: typeConfig.cor }} 
                  />
                  <span>{typeConfig.nome}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filterOrderType !== 'ALL' && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
              <span>Filtrado por: <strong>{filterOrderType}</strong></span>
              <button
                onClick={() => setFilterOrderType('ALL')}
                className="text-blue-700 hover:text-blue-950 font-bold ml-1 cursor-pointer"
                title="Remover filtro de tipo de pedido"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Quick SLA Pills & Batch Initialization Bar */}
        <div className="px-4 py-2 bg-white border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Auditoria de Prazos (SLA):
            </span>
            <button
              onClick={() => setFilterSLA('ALL')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterSLA === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>Todos</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                filterSLA === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {kpis.totalOrders}
              </span>
            </button>

            <button
              onClick={() => setFilterSLA(filterSLA === 'NO_PRAZO' ? 'ALL' : 'NO_PRAZO')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterSLA === 'NO_PRAZO'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
              title="Filtrar pedidos que estão dentro do prazo previsto"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>No Prazo</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                filterSLA === 'NO_PRAZO' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-800'
              }`}>
                {kpis.noPrazo}
              </span>
            </button>

            <button
              onClick={() => setFilterSLA(filterSLA === 'FORA_DO_PRAZO' ? 'ALL' : 'FORA_DO_PRAZO')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterSLA === 'FORA_DO_PRAZO'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : kpis.foraDoPrazo > 0
                  ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300 font-bold'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Filtrar pedidos fora do prazo / atrasados"
            >
              <AlertCircle className="w-3 h-3 text-rose-500" />
              <span>Fora do Prazo</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                filterSLA === 'FORA_DO_PRAZO' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-800'
              }`}>
                {kpis.foraDoPrazo}
              </span>
            </button>

            {kpis.atencao > 0 && (
              <button
                onClick={() => setFilterSLA(filterSLA === 'ATENCAO' ? 'ALL' : 'ATENCAO')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterSLA === 'ATENCAO'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
                title="Filtrar pedidos próximos do limite"
              >
                <span>Atenção</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  filterSLA === 'ATENCAO' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-800'
                }`}>
                  {kpis.atencao}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dayCategorized.todos.length > 0 && currentUser.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                title={`Desvincular todos os ${dayCategorized.todos.length} pedidos deste dia`}
              >
                <Unlink className="w-3.5 h-3.5 text-rose-600" />
                <span>Desvincular Pedidos do Dia ({dayCategorized.todos.length})</span>
              </button>
            )}

            {kpis.uninitializedCount > 0 && currentUser.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={handleBatchSetInitialDates}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                title={`Definir data de inicialização como ${dayNumber}/${monthStr}/2026 para todos os pedidos sem data`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Inicializar Pedidos ({kpis.uninitializedCount})</span>
              </button>
            )}

            {filterSLA !== 'ALL' && (
              <button
                onClick={() => setFilterSLA('ALL')}
                className="text-slate-400 hover:text-slate-700 text-xs underline cursor-pointer"
              >
                Limpar filtro SLA
              </button>
            )}
          </div>
        </div>

        {/* Content Body: Table or Milestones List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: MARCOS OFICIAIS */}
          {activeTab === 'MARCOS' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Marcos Oficiais do Cronograma para o Dia {dayNumber}/{monthStr}/2026
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    {dayCategorized.marcos.length} marco(s) regulatório(s)
                  </span>
                </div>

                {onOpenNewSchedule && currentUser.role !== 'VIEWER' && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNewSchedule(targetDateStr);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer self-start sm:self-auto"
                    title="Registrar novo cronograma com múltiplas unidades para este dia"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Criar Cronograma neste Dia</span>
                  </button>
                )}
              </div>

              {dayCategorized.marcos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dayCategorized.marcos.map((ev, idx) => {
                    const unitsList = ev.sch.unidades && ev.sch.unidades.length > 0
                      ? ev.sch.unidades
                      : ev.sch.unidade.includes(',')
                      ? ev.sch.unidade.split(',').map(s => s.trim())
                      : [ev.sch.unidade];

                    return (
                      <div 
                        key={idx} 
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {unitsList.map(u => (
                              <span key={u} className="text-xs font-bold text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded-full border border-blue-200">
                                {u}
                              </span>
                            ))}
                            {unitsList.length > 1 && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                ({unitsList.length} unidades vinculadas)
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                              {ev.sch.competencia}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            {ev.sch.programa}
                          </span>
                        </div>

                        <div className="pt-1">
                          <span className="text-xs font-bold text-slate-800 block">
                            {ev.stage}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {ev.sch.nome} · Modalidade: {ev.sch.tipo_pedido}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-400 font-mono flex-wrap gap-1.5">
                          <span>Limite Sol.: {formatShortDate(ev.sch.data_limite_solicitacao)}</span>
                          <span className="text-emerald-700 font-bold">Entrega: {formatShortDate(ev.sch.data_entrega)}</span>
                          {onOpenScheduleOrders && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenScheduleOrders(ev.sch);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                              title="Auditar progresso, verificar pedidos no prazo/fora do prazo e definir inicialização"
                            >
                              <Sparkles className="w-3 h-3 text-blue-600" />
                              <span>Auditar Cronograma</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60">
                  Nenhum marco oficial de cronograma cadastrado especificamente para o dia {dayNumber}/{monthStr}/2026.
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: PEDIDOS TABLE */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {activeTab === 'TODOS' ? 'Todos os Pedidos com Atividade Neste Dia' : `Pedidos na Etapa: ${activeTab}`}
                  </span>
                  <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                    {filteredOrders.length} resultado(s)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportDay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-all cursor-pointer shadow-2xs"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-full transition-all cursor-pointer shadow-2xs"
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>+ Vincular Pedido</span>
                    </button>
                  )}
                </div>
              </div>

              {filteredOrders.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-3.5">Código / Origem</th>
                          <th className="py-3 px-3">Unidade Hospitalar</th>
                          <th className="py-3 px-3">Programa & Tipo</th>
                          <th className="py-3 px-3 text-right">Itens</th>
                          <th className="py-3 px-3">
                            <span className="flex items-center gap-1 text-blue-800 font-bold">
                              <Sparkles className="w-3 h-3 text-blue-600" />
                              Data Inicialização
                            </span>
                          </th>
                          <th className="py-3 px-3">Etapa no Dia {dayNumber}</th>
                          <th className="py-3 px-3">Situação SLA</th>
                          <th className="py-3 px-3">
                            <span className="flex items-center gap-1 text-slate-800 font-bold">
                              <Zap className="w-3.5 h-3.5 text-blue-600" />
                              Status (1-Clique)
                            </span>
                          </th>
                          <th className="py-3 px-3 text-center">Reagendar</th>
                          <th className="py-3 px-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {filteredOrders.map(order => {
                          const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                          const { situation, label } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);

                          // Identify which stage triggers this order on this day
                          const isEntregaHoje = matchesDay(order.data_prevista_entrega || order.entregue_em);
                          const isSepHoje = matchesDay(order.data_inicio_separacao || order.separado_em);
                          const isExpHoje = matchesDay(order.data_expedicao || order.expedido_em);
                          const isAprovHoje = matchesDay(order.data_aprovacao || order.validada_em);
                          const isSolHoje = matchesDay(order.data_solicitacao || order.criado_em);

                          return (
                            <tr 
                              key={order.id}
                              className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
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
                                    <span className="text-[9px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-full border border-purple-200">
                                      MANUAL
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                <div>
                                  <span>{order.unidade}</span>
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    {order.solicitante}
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterOrderType(order.tipo);
                                    }}
                                    className="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                                    title={`Clique para filtrar apenas pedidos do tipo: ${order.tipo}`}
                                  >
                                    <TypeTag type={order.tipo} />
                                  </button>
                                  <span className="text-slate-400 text-[11px]">
                                    · {order.programa}
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 tabular-nums">
                                {order.quantidade_itens}
                              </td>

                              {/* Data de Inicialização (Interactive / Editable) */}
                              <td 
                                className="py-2.5 px-3 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {editingDateOrderId === order.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="date"
                                      value={tempDateValue}
                                      onChange={(e) => setTempDateValue(e.target.value)}
                                      className="text-xs font-mono bg-white border border-blue-400 rounded-lg px-2 py-1 focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQuickSetInitialDate(order, tempDateValue)}
                                      className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                      title="Salvar Data de Inicialização"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDateOrderId(null)}
                                      className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                                      title="Cancelar"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {order.data_inicio ? (
                                      <span className="font-mono font-bold text-slate-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                                        {formatShortDate(order.data_inicio)}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-amber-700 font-semibold italic">
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
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline px-1 py-0.5 rounded-md hover:bg-blue-100/60 cursor-pointer"
                                        title="Definir ou alterar data de inicialização do pedido"
                                      >
                                        {order.data_inicio ? 'Alterar' : '+ Definir'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                                  {isEntregaHoje && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                      <span>Entrega Agendada</span>
                                    </span>
                                  )}
                                  {isSepHoje && (
                                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                      <span>Separação</span>
                                    </span>
                                  )}
                                  {isExpHoje && (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                                      <span>Expedição</span>
                                    </span>
                                  )}
                                  {isAprovHoje && !isEntregaHoje && !isSepHoje && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      Aprovação
                                    </span>
                                  )}
                                  {isSolHoje && !isEntregaHoje && !isSepHoje && !isExpHoje && !isAprovHoje && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                      Solicitação
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
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleShiftOrderDate(order, -1)}
                                    disabled={currentUser.role === 'VIEWER'}
                                    className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Antecipar entrega em 1 dia"
                                  >
                                    -1d
                                  </button>
                                  <button
                                    onClick={() => handleShiftOrderDate(order, 1)}
                                    disabled={currentUser.role === 'VIEWER'}
                                    className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Postergar entrega em 1 dia"
                                  >
                                    +1d
                                  </button>
                                </div>
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
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-700 hover:bg-blue-100/70 border border-blue-200 transition-all cursor-pointer"
                                    title="Ver linha do tempo completa e detalhes"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Ver</span>
                                  </button>

                                   {currentUser.role !== 'VIEWER' && (
                                    <button
                                      onClick={async () => {
                                        await unlinkOrder(order.id, currentUser, `Desvinculado no modal do dia ${dayNumber}/${monthStr}/2026`);
                                        showToast('info', `${order.codigo} desvinculado`, 'Data e cronograma foram removidos do pedido.');
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
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
                <div className="p-12 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60">
                  Nenhum pedido encontrado para os filtros selecionados neste dia.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Exibindo <span className="font-mono font-bold text-slate-800">{filteredOrders.length}</span> pedido(s) correspondente(s) ao dia <span className="font-mono font-bold text-blue-700">{dayNumber}/{monthStr}/2026</span>
          </div>

          <div className="flex items-center gap-2">
            {dayCategorized.todos.length > 0 && currentUser.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                title={`Desvincular todos os ${dayCategorized.todos.length} pedidos do dia ${dayNumber}/${monthStr}`}
              >
                <Unlink className="w-3.5 h-3.5 text-rose-600" />
                <span>Desvincular Pedidos ({dayCategorized.todos.length})</span>
              </button>
            )}

            <button
              onClick={handleExportDay}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Romaneio</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Unlink All Orders of the Day */}
      {isUnlinkConfirmOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isUnlinking && setIsUnlinkConfirmOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Unlink className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Desvincular Pedidos do Dia {dayNumber}/{monthStr}/2026?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação irá desvincular <strong>{dayCategorized.todos.length} pedido(s)</strong> atualmente programados para este dia.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Opções de Desvinculação:</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={unlinkOptions.clearDeliveryDate}
                  onChange={e => setUnlinkOptions(prev => ({ ...prev, clearDeliveryDate: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-600">Remover data prevista de entrega / agendamento do dia</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={unlinkOptions.clearSchedule}
                  onChange={e => setUnlinkOptions(prev => ({ ...prev, clearSchedule: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-600">Remover vínculo com o cronograma de entrega oficial</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={unlinkOptions.clearStageDates}
                  onChange={e => setUnlinkOptions(prev => ({ ...prev, clearStageDates: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-600">Limpar etapas operacionais vinculadas a este dia</span>
              </label>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
              <strong>Aviso:</strong> Os pedidos <strong>não</strong> serão excluídos do sistema. Eles continuarão registrados no banco de dados e no histórico operacional, mas ficarão livres para novo agendamento no calendário.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlinkConfirmOpen(false)}
                disabled={isUnlinking}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleUnlinkAllOrders}
                disabled={isUnlinking}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {isUnlinking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Desvinculando...</span>
                  </>
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
