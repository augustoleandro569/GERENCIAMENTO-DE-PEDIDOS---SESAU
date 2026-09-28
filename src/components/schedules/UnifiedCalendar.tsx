import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule, OrderStatus } from '../../types';
import { formatShortDate, formatDate } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, InlineStatusSelect } from '../common/StatusBadge';
import { LinkOrderModal } from './LinkOrderModal';
import { showToast } from '../common/Toast';
import { 
  Calendar as CalendarIcon, 
  CalendarCheck, 
  Boxes, 
  Truck, 
  CheckCircle2, 
  FileText, 
  Clock, 
  Link2, 
  Unlink, 
  Filter, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Eye,
  Check,
  Zap,
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Sparkles,
  Maximize2,
  Plus,
  TrendingUp
} from 'lucide-react';
import { DayOrdersModal } from './DayOrdersModal';

export type StageDateFilter = 'TODOS' | 'ENTREGA' | 'SEPARACAO' | 'EXPEDICAO' | 'APROVACAO' | 'SOLICITACAO' | 'MARCOS';

interface UnifiedCalendarProps {
  onSelectOrder?: (order: Order) => void;
  filterUnitProp?: string;
  onOpenNewSchedule?: (targetDate: string) => void;
  onOpenScheduleOrders?: (schedule: Schedule, filter?: 'ALL' | 'NO_PRAZO' | 'FORA_DO_PRAZO') => void;
}

export const UnifiedCalendar: React.FC<UnifiedCalendarProps> = ({
  onSelectOrder,
  filterUnitProp,
  onOpenNewSchedule,
  onOpenScheduleOrders,
}) => {
  const { 
    schedules, 
    units, 
    orderTypes, 
    orders, 
    currentUser, 
    updateOrder, 
    updateOperationalStatus,
    unlinkOrdersOfDay,
    unlinkOrder 
  } = useStore();

  const [currentMonth, setCurrentMonth] = useState<number>(9); // 9 = SET/26, 10 = OUT/26
  const [selectedDay, setSelectedDay] = useState<number | null>(24);
  const [filterUnit, setFilterUnit] = useState<string>(filterUnitProp || 'ALL');
  const [filterOrderType, setFilterOrderType] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<StageDateFilter>('TODOS');
  const [drawerStageTab, setDrawerStageTab] = useState<'TODOS' | 'ENTREGA' | 'SEPARACAO' | 'EXPEDICAO' | 'APROVACAO' | 'SOLICITACAO' | 'MARCOS'>('TODOS');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDayOrdersModalOpen, setIsDayOrdersModalOpen] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkOptions, setUnlinkOptions] = useState({
    clearSchedule: true,
    clearDeliveryDate: true,
    clearStageDates: true,
  });

  const monthStr = currentMonth === 9 ? '09' : '10';
  const totalDaysInMonth = currentMonth === 9 ? 30 : 31;

  // Schedules map for fallback dates when orders are linked to a schedule
  const schedulesMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    schedules.forEach(s => map.set(s.id, s));
    return map;
  }, [schedules]);

  // Helper to extract day number from date string matching current month (YYYY-MM-DD or DD/MM/YYYY)
  const extractDayForMonth = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split(' ')[0].split('-');
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          if (parseInt(parts[1], 10) === currentMonth) {
            const d = parseInt(parts[2], 10);
            return isNaN(d) ? null : d;
          }
        } else {
          if (parseInt(parts[1], 10) === currentMonth) {
            const d = parseInt(parts[0], 10);
            return isNaN(d) ? null : d;
          }
        }
      }
    } else if (clean.includes('/')) {
      const parts = clean.split(' ')[0].split('/');
      if (parts.length >= 3) {
        if (parts[2].length === 4) {
          if (parseInt(parts[1], 10) === currentMonth) {
            const d = parseInt(parts[0], 10);
            return isNaN(d) ? null : d;
          }
        } else {
          if (parseInt(parts[1], 10) === currentMonth) {
            const d = parseInt(parts[2], 10);
            return isNaN(d) ? null : d;
          }
        }
      }
    }
    return null;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterUnit !== 'ALL' && o.unidade !== filterUnit) return false;
      if (filterOrderType !== 'ALL' && o.tipo !== filterOrderType) return false;
      return true;
    });
  }, [orders, filterUnit, filterOrderType]);

  const filteredSchedules = useMemo(() => {
    let list = schedules;
    if (filterUnit !== 'ALL') {
      const q = filterUnit.toUpperCase().trim();
      list = list.filter(s => 
        (s.unidade && s.unidade.toUpperCase().trim() === q) ||
        (s.unidades && s.unidades.some(u => u.toUpperCase().trim() === q)) ||
        (s.unidade && s.unidade.split(',').map(x => x.trim().toUpperCase()).includes(q))
      );
    }
    if (filterOrderType !== 'ALL') {
      list = list.filter(s => s.tipo_pedido === filterOrderType);
    }
    return list;
  }, [schedules, filterUnit, filterOrderType]);

  // Unified Day Mapping Structure:
  interface DayMapping {
    entregas: Order[];
    separacoes: Order[];
    expedicoes: Order[];
    aprovacoes: Order[];
    solicitacoes: Order[];
    marcos: { sch: Schedule; stage: string; color: string }[];
  }

  const calendarDayMap = useMemo(() => {
    const map = new Map<number, DayMapping>();

    for (let d = 1; d <= totalDaysInMonth; d++) {
      map.set(d, {
        entregas: [],
        separacoes: [],
        expedicoes: [],
        aprovacoes: [],
        solicitacoes: [],
        marcos: [],
      });
    }

    // 1. Map Orders to their respective dates (explicit or schedule-linked)
    filteredOrders.forEach(ord => {
      const sch = ord.cronograma_id ? schedulesMap.get(ord.cronograma_id) : null;

      // Data de Entrega
      const dEntrega = extractDayForMonth(ord.data_prevista_entrega || sch?.data_entrega);
      if (dEntrega && map.has(dEntrega)) {
        map.get(dEntrega)!.entregas.push(ord);
      }

      // Início de Separação
      const dSep = extractDayForMonth(ord.data_inicio_separacao || sch?.data_separacao);
      if (dSep && map.has(dSep)) {
        map.get(dSep)!.separacoes.push(ord);
      }

      // Expedição
      const dExp = extractDayForMonth(ord.data_expedicao || sch?.data_expedicao);
      if (dExp && map.has(dExp)) {
        map.get(dExp)!.expedicoes.push(ord);
      }

      // Aprovação
      const dAprov = extractDayForMonth(ord.data_aprovacao || sch?.data_limite_aprovacao);
      if (dAprov && map.has(dAprov)) {
        map.get(dAprov)!.aprovacoes.push(ord);
      }

      // Solicitação
      const dSol = extractDayForMonth(ord.data_solicitacao || sch?.data_limite_solicitacao);
      if (dSol && map.has(dSol)) {
        map.get(dSol)!.solicitacoes.push(ord);
      }
    });

    // 2. Map Schedule Milestones
    filteredSchedules.forEach(sch => {
      const dSol = extractDayForMonth(sch.data_limite_solicitacao);
      if (dSol && map.has(dSol)) {
        map.get(dSol)!.marcos.push({ sch, stage: 'Limite Solicitação', color: 'bg-blue-100 text-blue-800' });
      }

      const dAprov = extractDayForMonth(sch.data_limite_aprovacao);
      if (dAprov && map.has(dAprov)) {
        map.get(dAprov)!.marcos.push({ sch, stage: 'Limite Aprovação', color: 'bg-amber-100 text-amber-800' });
      }

      const dSep = extractDayForMonth(sch.data_separacao);
      if (dSep && map.has(dSep)) {
        map.get(dSep)!.marcos.push({ sch, stage: 'Separação Prevista', color: 'bg-purple-100 text-purple-800' });
      }

      const dExp = extractDayForMonth(sch.data_expedicao);
      if (dExp && map.has(dExp)) {
        map.get(dExp)!.marcos.push({ sch, stage: 'Expedição Prevista', color: 'bg-cyan-100 text-cyan-800' });
      }

      const dEnt = extractDayForMonth(sch.data_entrega);
      if (dEnt && map.has(dEnt)) {
        map.get(dEnt)!.marcos.push({ sch, stage: 'Entrega Prevista', color: 'bg-emerald-100 text-emerald-800' });
      }
    });

    return map;
  }, [filteredOrders, filteredSchedules, schedulesMap, currentMonth, monthStr, totalDaysInMonth]);

  // Selected Day Data
  const selectedDayData: DayMapping = selectedDay
    ? (calendarDayMap.get(selectedDay) || {
        entregas: [],
        separacoes: [],
        expedicoes: [],
        aprovacoes: [],
        solicitacoes: [],
        marcos: [],
      })
    : {
        entregas: [],
        separacoes: [],
        expedicoes: [],
        aprovacoes: [],
        solicitacoes: [],
        marcos: [],
      };

  const totalDayEvents = 
    selectedDayData.entregas.length +
    selectedDayData.separacoes.length +
    selectedDayData.expedicoes.length +
    selectedDayData.aprovacoes.length +
    selectedDayData.solicitacoes.length +
    selectedDayData.marcos.length;

  // Quick reschedule helper for orders on the selected day
  const handleShiftOrderDate = (order: Order, deltaDays: number) => {
    const curDay = selectedDay || 24;
    const targetDay = Math.min(totalDaysInMonth, Math.max(1, curDay + deltaDays));
    const targetDateStr = `2026-${monthStr}-${String(targetDay).padStart(2, '0')}`;
    updateOrder(order.id, { data_prevista_entrega: targetDateStr }, currentUser, `Reagendado para dia ${targetDay}`);
    showToast('success', `${order.codigo} reagendado`, `Nova data prevista: ${targetDay}/${monthStr}/2026`);
    setSelectedDay(targetDay);
  };

  const handleUnlinkCurrentDay = async () => {
    if (!selectedDay) return;
    try {
      setIsUnlinking(true);
      const result = await unlinkOrdersOfDay(selectedDay, currentMonth, {
        clearSchedule: unlinkOptions.clearSchedule,
        clearDeliveryDate: unlinkOptions.clearDeliveryDate,
        clearStageDates: unlinkOptions.clearStageDates,
        responsavel: currentUser,
        motivo: `Desvinculação em lote realizada por ${currentUser.nome} no dia ${selectedDay}/${monthStr}/2026 via calendário`,
      });

      if (result.unlinkedCount > 0) {
        showToast(
          'success',
          'Pedidos Desvinculados!',
          `${result.unlinkedCount} pedido(s) foram desvinculados do dia ${selectedDay}/${monthStr}/2026 com sucesso.`
        );
      } else {
        showToast(
          'info',
          'Nenhum pedido vinculado',
          'Não há pedidos com vínculos ativos para serem desvinculados neste dia.'
        );
      }
      setIsUnlinkConfirmOpen(false);
    } catch {
      showToast('error', 'Erro ao desvincular', 'Ocorreu uma falha ao tentar desvincular os pedidos deste dia.');
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Month Bar - Rounded 3xl */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Month Picker - Rounded Full Pill */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/50 shadow-inner text-xs font-semibold">
            <button
              onClick={() => { setCurrentMonth(9); setSelectedDay(24); }}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                currentMonth === 9
                  ? 'bg-white text-blue-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Setembro 2026 (SET/26)
            </button>
            <button
              onClick={() => { setCurrentMonth(10); setSelectedDay(1); }}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                currentMonth === 10
                  ? 'bg-white text-blue-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Outubro 2026 (OUT/26)
            </button>
          </div>

          {currentMonth === 9 && (
            <button
              onClick={() => setSelectedDay(24)}
              className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 rounded-full border border-blue-200/70 transition-all cursor-pointer"
            >
              Ir para Hoje (24/09)
            </button>
          )}
        </div>

        {/* Filters - Rounded Full */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter Select */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Exibir:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as StageDateFilter)}
              className="text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="TODOS">Todas as Etapas & Marcos</option>
              <option value="ENTREGA">🟢 Apenas Entregas</option>
              <option value="SEPARACAO">🟣 Apenas Separações</option>
              <option value="EXPEDICAO">🟠 Apenas Expedições</option>
              <option value="APROVACAO">🟡 Apenas Aprovações</option>
              <option value="SOLICITACAO">🔵 Apenas Solicitações</option>
              <option value="MARCOS">🏁 Apenas Marcos Oficiais</option>
            </select>
          </div>

          {/* Order Type Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Tipo:</span>
            <select
              value={filterOrderType}
              onChange={(e) => setFilterOrderType(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">Todos os Tipos</option>
              {orderTypes.map(t => (
                <option key={t.id} value={t.nome}>{t.nome}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Unidade:</span>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-full px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">Todas as Unidades ({units.length})</option>
              {units.map(u => (
                <option key={u.id} value={u.sigla}>{u.sigla}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar on Left, Drawer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar Days (3 Cols) - Rounded 3xl Container */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-400 mb-2 border-b border-slate-100 pb-2 uppercase tracking-wider">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Blank offsets */}
            {Array.from({ length: currentMonth === 9 ? 2 : 4 }).map((_, i) => (
              <div key={`blank-${i}`} className="h-28 bg-slate-50/40 rounded-2xl border border-transparent opacity-40" />
            ))}

            {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map((day) => {
              const data = calendarDayMap.get(day) || {
                entregas: [],
                separacoes: [],
                expedicoes: [],
                aprovacoes: [],
                solicitacoes: [],
                marcos: [],
              };

              const isSelected = selectedDay === day;
              const isToday = currentMonth === 9 && day === 24;

              const hasEntregas = data.entregas.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'ENTREGA');
              const hasSep = data.separacoes.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'SEPARACAO');
              const hasExp = data.expedicoes.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'EXPEDICAO');
              const hasAprov = data.aprovacoes.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'APROVACAO');
              const hasSol = data.solicitacoes.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'SOLICITACAO');
              const hasMarcos = data.marcos.length > 0 && (stageFilter === 'TODOS' || stageFilter === 'MARCOS');

              const hasAny = hasEntregas || hasSep || hasExp || hasAprov || hasSol || hasMarcos;

              return (
                <div
                  key={day}
                  onClick={() => {
                    setSelectedDay(day);
                    setIsDayOrdersModalOpen(true);
                  }}
                  className={`h-28 p-2 rounded-2xl border flex flex-col justify-between transition-all duration-150 cursor-pointer text-left group select-none relative ${
                    isSelected
                      ? 'ring-2 ring-blue-600 bg-blue-50/60 border-blue-500 shadow-sm scale-[1.02] z-10'
                      : isToday
                      ? 'border-blue-400 bg-blue-50/20 hover:border-blue-500 hover:shadow-xs'
                      : hasAny
                      ? 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-white border-slate-100 hover:bg-slate-50/60'
                  }`}
                  title="Clique para abrir a visualização completa dos pedidos deste dia"
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-mono font-bold ${
                      isSelected 
                        ? 'text-blue-800' 
                        : isToday 
                        ? 'text-blue-600' 
                        : 'text-slate-800'
                    }`}>
                      {day}
                    </span>

                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                          Hoje
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                          setIsDayOrdersModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all"
                        title="Visualização completa dos pedidos"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>

                      {!isToday && hasAny && !isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:scale-125 transition-transform" />
                      )}
                    </div>
                  </div>

                  {/* Stage Badges for Day - Soft Rounded Pills */}
                  <div className="space-y-1 overflow-hidden mt-1">
                    {/* Entregas */}
                    {hasEntregas && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{data.entregas.length} entrega{data.entregas.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Separações */}
                    {hasSep && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span>{data.separacoes.length} separação</span>
                      </div>
                    )}

                    {/* Expedições */}
                    {hasExp && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                        <span>{data.expedicoes.length} expedição</span>
                      </div>
                    )}

                    {/* Aprovações */}
                    {hasAprov && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{data.aprovacoes.length} aprovação</span>
                      </div>
                    )}

                    {/* Solicitações */}
                    {hasSol && stageFilter === 'SOLICITACAO' && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>{data.solicitacoes.length} solicitação</span>
                      </div>
                    )}

                    {/* Marcos do Cronograma */}
                    {hasMarcos && (
                      <div className="text-[9px] font-medium px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 truncate flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                        <span className="truncate">{data.marcos[0].sch.unidade}: {data.marcos[0].stage}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Drawer: Selected Day Mapping (1 Col) - Rounded 3xl */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between max-h-[85vh] overflow-y-auto">
          <div className="space-y-3.5">
            {/* Header of Drawer with Interactive Day Navigation */}
            <div className="pb-3 border-b border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                    Dia {selectedDay || 24}/{monthStr}/2026
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200/60">
                  {totalDayEvents} eventos
                </span>
              </div>

              {/* Day Jumper Buttons: Anterior & Próximo */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <button
                  onClick={() => setSelectedDay(prev => Math.max(1, (prev || 24) - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/70 rounded-full transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Dia Anterior</span>
                </button>

                <button
                  onClick={() => setSelectedDay(prev => Math.min(totalDaysInMonth, (prev || 24) + 1))}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/70 rounded-full transition-all cursor-pointer"
                >
                  <span>Próximo Dia</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {selectedDay ? (
              <>
                {/* Button to Open Full Day Orders Modal - Rounded Full */}
                <button
                  onClick={() => setIsDayOrdersModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
                  title="Abrir visualização completa dos pedidos com filtros, KPIs e romaneio"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Visualização Completa do Dia ({totalDayEvents})</span>
                </button>

                {/* Button to Link / Schedule Order to this day - Rounded Full */}
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  disabled={currentUser.role === 'VIEWER'}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>+ Vincular Pedido a este Dia</span>
                </button>

                {/* Button to Unlink Orders of this day */}
                {totalDayEvents > 0 && currentUser.role !== 'VIEWER' && (
                  <button
                    onClick={() => setIsUnlinkConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer"
                    title="Desvincular pedidos deste dia"
                  >
                    <Unlink className="w-3.5 h-3.5 text-rose-600" />
                    <span>Desvincular Pedidos do Dia ({totalDayEvents})</span>
                  </button>
                )}

                {/* Button to Create New Schedule for this day with multiple units - Rounded Full */}
                {onOpenNewSchedule && currentUser.role !== 'VIEWER' && (
                  <button
                    onClick={() => onOpenNewSchedule(`2026-${monthStr}-${String(selectedDay || 1).padStart(2, '0')}`)}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
                    title="Criar novo cronograma com múltiplas unidades para esta data"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Criar Cronograma neste Dia</span>
                  </button>
                )}

                {/* Section 1: Entregas Agendadas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>1. Entregas Agendadas ({selectedDayData.entregas.length})</span>
                    </span>
                  </div>

                  {selectedDayData.entregas.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedDayData.entregas.map(ord => (
                        <div
                          key={ord.id}
                          className="p-3 bg-emerald-50/40 rounded-2xl border border-emerald-200/70 hover:border-emerald-400 hover:shadow-xs transition-all space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div 
                              onClick={() => onSelectOrder?.(ord)}
                              className="cursor-pointer hover:underline"
                            >
                              <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-950 text-[11px]">
                                <span>{ord.codigo}</span>
                                <span className="text-slate-700">· {ord.unidade}</span>
                              </div>
                              <p className="text-[10px] text-slate-500">
                                {ord.quantidade_itens} itens · {ord.tipo}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {onSelectOrder && (
                                <button
                                  onClick={() => onSelectOrder(ord)}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-white"
                                  title="Ver detalhes do pedido"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  await unlinkOrder(ord.id, currentUser, `Desvinculado do dia ${selectedDay}/${monthStr}/2026 no calendário`);
                                  showToast('success', `${ord.codigo} desvinculado`, 'Pedido foi desvinculado deste dia e do cronograma.');
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Desvincular pedido deste dia e cronograma"
                              >
                                <Unlink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Quick Interactive Actions: Fast Status & Reschedule */}
                          <div className="pt-1.5 border-t border-emerald-100 flex items-center justify-between gap-1 text-[11px]">
                            {/* Fast Inline Status */}
                            <InlineStatusSelect
                              currentStatus={ord.status_operacional}
                              onStatusChange={(newSt) => {
                                updateOperationalStatus(ord.id, newSt, currentUser, 'Alteração rápida no painel do dia');
                                showToast('success', `${ord.codigo} atualizado`, `Status: ${newSt}`);
                              }}
                              disabled={currentUser.role === 'VIEWER'}
                            />

                            {/* Reagendar +1 / -1 dia */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleShiftOrderDate(ord, -1)}
                                className="px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-[10px] font-mono cursor-pointer"
                                title="Antecipar 1 dia"
                              >
                                -1d
                              </button>
                              <button
                                onClick={() => handleShiftOrderDate(ord, 1)}
                                className="px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-[10px] font-mono cursor-pointer"
                                title="Postergar 1 dia"
                              >
                                +1d
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Nenhuma entrega agendada para este dia.</p>
                  )}
                </div>

                {/* Section 2: Início de Separação */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-purple-800">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>2. Início de Separação ({selectedDayData.separacoes.length})</span>
                    </span>
                  </div>

                  {selectedDayData.separacoes.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedDayData.separacoes.map(ord => (
                        <div
                          key={ord.id}
                          className="p-2 bg-purple-50/40 rounded-xl border border-purple-200/70 flex items-center justify-between text-xs hover:bg-purple-100/50 hover:shadow-2xs transition-all"
                        >
                          <div 
                            onClick={() => onSelectOrder?.(ord)}
                            className="cursor-pointer"
                          >
                            <span className="font-mono text-[11px] text-purple-950 font-bold">{ord.codigo}</span>
                            <span className="text-slate-600 ml-1">· {ord.unidade}</span>
                            <span className="text-[10px] text-slate-500 font-mono font-semibold block">{ord.quantidade_itens} itens</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {onSelectOrder && (
                              <button
                                onClick={() => onSelectOrder(ord)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-white"
                                title="Ver detalhes"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                await unlinkOrder(ord.id, currentUser, `Desvinculado do dia ${selectedDay}/${monthStr}/2026 no calendário`);
                                showToast('success', `${ord.codigo} desvinculado`, 'Pedido foi desvinculado.');
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Desvincular"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Nenhuma separação iniciada nesta data.</p>
                  )}
                </div>

                {/* Section 3: Expedições */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-cyan-800">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span>3. Expedições ({selectedDayData.expedicoes.length})</span>
                    </span>
                  </div>

                  {selectedDayData.expedicoes.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedDayData.expedicoes.map(ord => (
                        <div
                          key={ord.id}
                          className="p-2 bg-cyan-50/40 rounded-xl border border-cyan-200/70 flex items-center justify-between text-xs hover:bg-cyan-100/50 hover:shadow-2xs transition-all"
                        >
                          <div 
                            onClick={() => onSelectOrder?.(ord)}
                            className="cursor-pointer"
                          >
                            <span className="font-mono text-[11px] text-cyan-950 font-bold">{ord.codigo}</span>
                            <span className="text-slate-600 ml-1">· {ord.unidade}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">{ord.status_operacional}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {onSelectOrder && (
                              <button
                                onClick={() => onSelectOrder(ord)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-white"
                                title="Ver detalhes"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                await unlinkOrder(ord.id, currentUser, `Desvinculado do dia ${selectedDay}/${monthStr}/2026 no calendário`);
                                showToast('success', `${ord.codigo} desvinculado`, 'Pedido foi desvinculado.');
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Desvincular"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Nenhuma expedição nesta data.</p>
                  )}
                </div>

                {/* Section 4: Aprovações & Solicitações */}
                {(selectedDayData.aprovacoes.length > 0 || selectedDayData.solicitacoes.length > 0) && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="font-bold text-slate-700 block text-[11px]">
                      4. Aprovações & Solicitações:
                    </span>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      {selectedDayData.aprovacoes.length > 0 && (
                        <p className="flex items-center justify-between bg-amber-50/60 p-2 rounded-xl border border-amber-200/70 font-semibold text-amber-900">
                          <span>🟡 {selectedDayData.aprovacoes.length} aprovações realizadas</span>
                        </p>
                      )}
                      {selectedDayData.solicitacoes.length > 0 && (
                        <p className="flex items-center justify-between bg-blue-50/60 p-2 rounded-xl border border-blue-200/70 font-semibold text-blue-900">
                          <span>🔵 {selectedDayData.solicitacoes.length} solicitações emitidas</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 5: Marcos Oficiais do Cronograma */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span>5. Marcos Oficiais ({selectedDayData.marcos.length})</span>
                    </span>
                  </div>

                  {selectedDayData.marcos.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedDayData.marcos.map((ev, idx) => {
                        const unitsList = ev.sch.unidades && ev.sch.unidades.length > 0
                          ? ev.sch.unidades
                          : ev.sch.unidade.includes(',')
                          ? ev.sch.unidade.split(',').map(s => s.trim())
                          : [ev.sch.unidade];

                        return (
                          <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                {unitsList.map(u => (
                                  <span key={u} className="font-bold text-blue-900 bg-blue-100/90 px-1.5 py-0.2 rounded-md text-[10px]">
                                    {u}
                                  </span>
                                ))}
                                <span className="font-mono text-[9px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                                  {ev.sch.competencia}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-[11px] text-blue-700 font-bold">{ev.stage}</p>
                              {onOpenScheduleOrders && (
                                <button
                                  type="button"
                                  onClick={() => onOpenScheduleOrders(ev.sch)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                  title="Auditar prazos, progresso e pedidos deste cronograma"
                                >
                                  <TrendingUp className="w-3 h-3 text-blue-600" />
                                  <span>Auditar SLA</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Nenhum marco cadastrado para este dia.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Selecione um dia no calendário ao lado para ver o mapeamento completo das etapas.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link Order Modal */}
      <LinkOrderModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        targetDate={`2026-${monthStr}-${String(selectedDay || 1).padStart(2, '0')}`}
        dayNumber={selectedDay || 1}
        monthNumber={currentMonth}
        availableSchedules={filteredSchedules}
      />

      {/* Day Full Orders View Modal */}
      <DayOrdersModal
        isOpen={isDayOrdersModalOpen}
        onClose={() => setIsDayOrdersModalOpen(false)}
        dayNumber={selectedDay || 24}
        monthNumber={currentMonth}
        onNavigateDay={(newDay) => setSelectedDay(newDay)}
        onSelectOrder={onSelectOrder}
        onOpenLinkModal={() => setIsLinkModalOpen(true)}
        onOpenNewSchedule={onOpenNewSchedule}
        initialOrderType={filterOrderType}
        onOpenScheduleOrders={onOpenScheduleOrders}
      />

      {/* Confirmation Modal to Unlink All Orders of the Day */}
      {isUnlinkConfirmOpen && selectedDay && (
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
                  Desvincular Pedidos do Dia {selectedDay}/{monthStr}/2026?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação irá desvincular os pedidos atualmente agendados ou vinculados a este dia no calendário e cronograma.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span>Opções de Desvinculação:</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={unlinkOptions.clearDeliveryDate}
                  onChange={e => setUnlinkOptions(prev => ({ ...prev, clearDeliveryDate: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-600">Remover data prevista de entrega / agendamento</span>
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
              <strong>Aviso:</strong> Os pedidos <strong>não</strong> serão excluídos. Eles continuarão registrados no banco de dados, livres para novos agendamentos no calendário.
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
                onClick={handleUnlinkCurrentDay}
                disabled={isUnlinking}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
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
