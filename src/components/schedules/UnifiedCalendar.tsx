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
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { DayOrdersModal } from './DayOrdersModal';
import { MultiSelect } from '../common/MultiSelect';

export type StageDateFilter = 'TODOS' | 'ENTREGA' | 'SEPARACAO';

interface UnifiedCalendarProps {
  onSelectOrder?: (order: Order) => void;
  ordersProp?: Order[];
  filterUnitProp?: string;
  filterTypeProp?: string;
  filterProgramProp?: string;
  searchTermProp?: string;
  quickFilterProp?: string;
  selectedUnitsProp?: string[];
  selectedOrderTypesProp?: string[];
  selectedStagesProp?: string[];
  selectedScheduleProp?: string;
  onSelectSchedule?: (scheduleId: string) => void;
  onOpenNewSchedule?: (targetDate: string) => void;
  onOpenScheduleOrders?: (schedule: Schedule, filter?: 'ALL' | 'NO_PRAZO' | 'FORA_DO_PRAZO') => void;
}

export const UnifiedCalendar: React.FC<UnifiedCalendarProps> = ({
  onSelectOrder,
  ordersProp,
  filterUnitProp,
  filterTypeProp,
  filterProgramProp,
  searchTermProp,
  quickFilterProp,
  selectedUnitsProp,
  selectedOrderTypesProp,
  selectedStagesProp,
  selectedScheduleProp,
  onSelectSchedule,
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

  // Dynamic reference to today's date (e.g. 02/10/2026)
  const todayRef = useMemo(() => {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1, // 1-12 (10 for Outubro)
      day: d.getDate(), // 1-31 (02)
      formatted: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    };
  }, []);

  const defaultMonth = todayRef.month === 9 || todayRef.month === 10 ? todayRef.month : 10;
  const defaultDay = todayRef.month === defaultMonth ? todayRef.day : 1;

  const [currentMonth, setCurrentMonth] = useState<number>(defaultMonth);
  const [selectedDay, setSelectedDay] = useState<number | null>(defaultDay);
  const [selectedStages, setSelectedStages] = useState<string[]>(selectedStagesProp || []);
  const [selectedOrderTypes, setSelectedOrderTypes] = useState<string[]>(
    selectedOrderTypesProp && selectedOrderTypesProp.length > 0
      ? selectedOrderTypesProp
      : (filterTypeProp && filterTypeProp !== 'ALL' ? [filterTypeProp] : [])
  );
  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    selectedUnitsProp && selectedUnitsProp.length > 0
      ? selectedUnitsProp
      : (filterUnitProp && filterUnitProp !== 'ALL' ? [filterUnitProp] : [])
  );
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDayOrdersModalOpen, setIsDayOrdersModalOpen] = useState(false);
  const [returnToDayOrdersModal, setReturnToDayOrdersModal] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkOptions, setUnlinkOptions] = useState({
    clearSchedule: true,
    clearDeliveryDate: true,
    clearStageDates: true,
  });

  const monthStr = currentMonth === 9 ? '09' : '10';
  const totalDaysInMonth = currentMonth === 9 ? 30 : 31;

  const isStageActive = (stage: StageDateFilter) => {
    if (selectedStages.length === 0 || selectedStages.includes('TODOS')) return true;
    return selectedStages.includes(stage);
  };

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

  const currentScheduleFilter = selectedScheduleProp || 'ALL';

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Pedidos desvinculados sem qualquer cronograma ou data ativa nunca pertencem ao calendário
      if (o.cronograma_vinculo === 'NENHUM' && !o.cronograma_id && !o.data_prevista_entrega && !o.data_inicio_separacao && !o.data_expedicao) {
        return false;
      }
      // Deve possuir vínculo operacional ativo (cronograma ou data de entrega/etapa agendada)
      const hasCalendarPresence = Boolean(
        o.cronograma_id || 
        o.cronograma_vinculo === 'MANUAL' ||
        o.data_prevista_entrega || 
        o.data_inicio_separacao || 
        o.data_expedicao
      );
      if (!hasCalendarPresence) return false;

      // Filtro de cronograma sincronizado
      if (currentScheduleFilter !== 'ALL' && o.cronograma_id !== currentScheduleFilter) {
        return false;
      }

      // Multi-seleção de Unidades
      if (selectedUnits.length > 0) {
        const uLow = (o.unidade || '').toLowerCase();
        const matchesUnit = selectedUnits.some(su => {
          const suLow = su.toLowerCase();
          return uLow === suLow || uLow.includes(suLow) || suLow.includes(uLow);
        });
        if (!matchesUnit) return false;
      }

      // Multi-seleção de Tipos
      if (selectedOrderTypes.length > 0 && !selectedOrderTypes.includes(o.tipo)) return false;

      return true;
    });
  }, [orders, selectedUnits, selectedOrderTypes, currentScheduleFilter]);

  const filteredSchedules = useMemo(() => {
    let list = schedules;
    if (currentScheduleFilter !== 'ALL') {
      list = list.filter(s => s.id === currentScheduleFilter);
    }
    if (selectedUnits.length > 0) {
      list = list.filter(s => {
        const schUnits = s.unidades && s.unidades.length > 0
          ? s.unidades
          : s.unidade.includes(',')
          ? s.unidade.split(',').map(u => u.trim())
          : [s.unidade];
        return schUnits.some(u => selectedUnits.includes(u));
      });
    }
    if (selectedOrderTypes.length > 0) {
      list = list.filter(s => selectedOrderTypes.includes(s.tipo_pedido));
    }
    return list;
  }, [schedules, selectedUnits, selectedOrderTypes, currentScheduleFilter]);

  // Unified Day Mapping Structure (Exclusively real order operations):
  interface DayMapping {
    entregas: Order[];
    separacoes: Order[];
  }

  const calendarDayMap = useMemo(() => {
    const map = new Map<number, DayMapping>();

    for (let d = 1; d <= totalDaysInMonth; d++) {
      map.set(d, {
        entregas: [],
        separacoes: [],
      });
    }

    // Map Orders to their respective dates (explicit or schedule-linked)
    filteredOrders.forEach(ord => {
      // Ignora pedidos sem vínculo ativo
      if (ord.cronograma_vinculo === 'NENHUM' && !ord.cronograma_id && !ord.data_prevista_entrega && !ord.data_expedicao && !ord.data_inicio_separacao) {
        return;
      }

      const sch = ord.cronograma_id ? schedulesMap.get(ord.cronograma_id) : null;

      // Data de Entrega / Expedição: data de expedição é a mesma que entregue, unificada em 1 só etapa
      const dEntrega = extractDayForMonth(ord.data_prevista_entrega || ord.data_expedicao || sch?.data_entrega || sch?.data_expedicao);
      if (dEntrega && map.has(dEntrega)) {
        map.get(dEntrega)!.entregas.push(ord);
      }

      // Início de Separação
      const dSep = extractDayForMonth(ord.data_inicio_separacao || sch?.data_separacao);
      if (dSep && map.has(dSep)) {
        map.get(dSep)!.separacoes.push(ord);
      }
    });

    return map;
  }, [filteredOrders, schedulesMap, currentMonth, monthStr, totalDaysInMonth]);

  // Selected Day Data
  const selectedDayData: DayMapping = selectedDay
    ? (calendarDayMap.get(selectedDay) || {
        entregas: [],
        separacoes: [],
      })
    : {
        entregas: [],
        separacoes: [],
      };

  const totalDayOrders = Array.from(new Set([
    ...selectedDayData.entregas.map(o => o.id),
    ...selectedDayData.separacoes.map(o => o.id),
  ])).length;

  const totalDayEvents = totalDayOrders;

  // Quick reschedule helper for orders on the selected day
  const handleShiftOrderDate = (order: Order, deltaDays: number) => {
    const curDay = selectedDay || todayRef.day;
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
      {/* Top Filter and Month Bar - Crisp Solid Container */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-300 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full">
        {/* Month Picker - Crisp Segmented Control */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-300 text-xs font-semibold shadow-2xs">
            <button
              onClick={() => { setCurrentMonth(9); setSelectedDay(todayRef.month === 9 ? todayRef.day : 1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                currentMonth === 9
                  ? 'bg-white text-blue-900 border border-slate-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/70'
              }`}
            >
              Setembro 2026 (SET/26)
            </button>
            <button
              onClick={() => { setCurrentMonth(10); setSelectedDay(todayRef.month === 10 ? todayRef.day : 1); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                currentMonth === 10
                  ? 'bg-white text-blue-900 border border-slate-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/70'
              }`}
            >
              Outubro 2026 (OUT/26)
            </button>
          </div>

          <button
            onClick={() => {
              if (todayRef.month === 9 || todayRef.month === 10) {
                setCurrentMonth(todayRef.month);
              }
              setSelectedDay(todayRef.day);
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
              currentMonth === todayRef.month && selectedDay === todayRef.day
                ? 'text-blue-950 bg-blue-100 border-blue-400 font-extrabold ring-1 ring-blue-300'
                : 'text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-300'
            }`}
            title="Navegar diretamente para a data de hoje"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Ir para Hoje ({todayRef.formatted})
          </button>
        </div>

        {/* Multi-Select Filters & Schedule Selector */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Sincronização: Filtro de Cronograma */}
          {onSelectSchedule && (
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs flex-1 sm:flex-initial sm:w-52 transition-all">
              <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={currentScheduleFilter}
                onChange={(e) => onSelectSchedule(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer w-full truncate"
                title="Filtrar calendário por cronograma específico (sincronizado com Por Progresso e Tabela)"
              >
                <option value="ALL">🌐 Todos os Cronogramas ({schedules.length})</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.competencia})
                  </option>
                ))}
              </select>
              {currentScheduleFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => onSelectSchedule('ALL')}
                  className="text-[10px] text-blue-700 hover:text-rose-600 font-bold px-1 cursor-pointer"
                  title="Limpar filtro de cronograma"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Multi-Select Etapas: Somente Entregas */}
          <MultiSelect
            options={[
              { id: 'ENTREGA', label: '🟢 Entregas Agendadas' },
            ]}
            selected={selectedStages}
            onChange={(next) => setSelectedStages(next)}
            placeholder="Etapa: Entregas"
            className="flex-1 sm:flex-initial sm:w-44"
          />

          {/* Multi-Select Tipos de Pedido */}
          <MultiSelect
            options={orderTypes.map(t => ({ id: t.nome, label: t.nome, color: t.cor }))}
            selected={selectedOrderTypes}
            onChange={(next) => setSelectedOrderTypes(next)}
            placeholder="Todos os Tipos"
            className="flex-1 sm:flex-initial sm:w-36"
          />

          {/* Multi-Select Unidades Hospitalares */}
          <MultiSelect
            options={units.map(u => ({ id: u.sigla, label: u.sigla, subLabel: u.nome }))}
            selected={selectedUnits}
            onChange={(next) => setSelectedUnits(next)}
            placeholder="Todas as Unidades"
            className="flex-1 sm:flex-initial sm:w-40"
            showSearch={true}
          />

          {(selectedStages.length > 0 || selectedOrderTypes.length > 0 || selectedUnits.length > 0 || currentScheduleFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedStages([]);
                setSelectedOrderTypes([]);
                setSelectedUnits([]);
                if (onSelectSchedule) onSelectSchedule('ALL');
              }}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0"
              title="Limpar todos os filtros do calendário"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar ({selectedStages.length + selectedOrderTypes.length + selectedUnits.length + (currentScheduleFilter !== 'ALL' ? 1 : 0)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Sincronização Banner: quando um cronograma específico está filtrado */}
      {currentScheduleFilter !== 'ALL' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <CalendarDays className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              Filtrado pelo cronograma: <strong>{schedules.find(s => s.id === currentScheduleFilter)?.nome || currentScheduleFilter}</strong>
            </span>
            <span className="font-mono text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              {filteredOrders.length} pedido(s) no calendário
            </span>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              (Filtro sincronizado com as abas <strong>Por Progresso</strong> e <strong>Tabela</strong>)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectSchedule?.('ALL')}
            className="text-xs font-bold text-blue-700 hover:text-blue-950 underline cursor-pointer ml-3 whitespace-nowrap"
          >
            ✕ Ver Todos os Cronogramas
          </button>
        </div>
      )}

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
              };

              const isSelected = selectedDay === day;
              const isToday = currentMonth === todayRef.month && day === todayRef.day;

              const hasEntregas = data.entregas.length > 0 && isStageActive('ENTREGA');

              // Only actual deliveries count for cell active state and tags
              const hasAny = hasEntregas;

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

                      {currentUser.role !== 'VIEWER' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                            setIsLinkModalOpen(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                          title={`Vincular pedidos ao dia ${day}`}
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                          setIsDayOrdersModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                        title="Visualização completa dos pedidos"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Tag Somente de Entrega (expedição unificada em 1 só etapa de entrega) */}
                  <div className="space-y-1 overflow-hidden mt-1">
                    {hasEntregas && (
                      <div className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 truncate flex items-center gap-1 font-bold shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{data.entregas.length} entrega{data.entregas.length > 1 ? 's' : ''}</span>
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
                    Dia {selectedDay || todayRef.day}/{monthStr}/2026
                  </h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  totalDayOrders > 0 
                    ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {totalDayOrders} {totalDayOrders === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>

              {/* Day Jumper Buttons: Anterior & Próximo */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <button
                  onClick={() => setSelectedDay(prev => Math.max(1, (prev || todayRef.day) - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/70 rounded-full transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Dia Anterior</span>
                </button>

                <button
                  onClick={() => setSelectedDay(prev => Math.min(totalDaysInMonth, (prev || todayRef.day) + 1))}
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
                  <span>Visualização Completa ({totalDayOrders} pedidos)</span>
                </button>

                {/* Button to Link / Schedule Order to this day - Rounded Full */}
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  disabled={currentUser.role === 'VIEWER'}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
                  title="Vincular um ou múltiplos pedidos a este dia do calendário"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>+ Vincular Pedidos a este Dia</span>
                </button>

                {/* Button to Unlink Orders of this day - Only shown when there are real orders */}
                {totalDayOrders > 0 && currentUser.role !== 'VIEWER' && (
                  <button
                    onClick={() => setIsUnlinkConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer"
                    title="Desvincular todos os pedidos agendados para este dia"
                  >
                    <Unlink className="w-3.5 h-3.5 text-rose-600" />
                    <span>Desvincular Pedidos do Dia ({totalDayOrders})</span>
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

                {/* Section: Entregas Agendadas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Entregas Agendadas ({selectedDayData.entregas.length})</span>
                    </span>
                  </div>

                  {selectedDayData.entregas.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedDayData.entregas.map((ord, idx) => (
                        <div
                          key={`${ord.id}-${idx}`}
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

                {/* Início de Separação (Acompanhamento interno) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1">
                    <span className="flex items-center gap-1.5 text-purple-800">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>Separações no Dia ({selectedDayData.separacoes.length})</span>
                    </span>
                  </div>

                  {selectedDayData.separacoes.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedDayData.separacoes.map((ord, idx) => (
                        <div
                          key={`${ord.id}-${idx}`}
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

                {/* Empty State when no orders are scheduled on this day */}
                {totalDayOrders === 0 && (
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-center space-y-1.5 my-2">
                    <p className="text-xs font-semibold text-slate-700">Nenhum pedido agendado para este dia</p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Não há entregas ou separações programadas nesta data.
                    </p>
                  </div>
                )}
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
      {isLinkModalOpen && (
        <LinkOrderModal
          isOpen={isLinkModalOpen}
          onClose={() => {
            setIsLinkModalOpen(false);
            if (returnToDayOrdersModal) {
              setIsDayOrdersModalOpen(true);
              setReturnToDayOrdersModal(false);
            }
          }}
          targetDate={`2026-${monthStr}-${String(selectedDay || todayRef.day).padStart(2, '0')}`}
          dayNumber={selectedDay || todayRef.day}
          monthNumber={currentMonth}
          availableSchedules={filteredSchedules}
        />
      )}

      {/* Day Full Orders View Modal */}
      {isDayOrdersModalOpen && (
        <DayOrdersModal
          isOpen={isDayOrdersModalOpen}
          onClose={() => setIsDayOrdersModalOpen(false)}
          dayNumber={selectedDay || todayRef.day}
          monthNumber={currentMonth}
          onNavigateDay={(newDay) => setSelectedDay(newDay)}
          onSelectOrder={onSelectOrder}
          onOpenLinkModal={() => {
            setReturnToDayOrdersModal(true);
            setIsLinkModalOpen(true);
          }}
          onOpenNewSchedule={onOpenNewSchedule}
          externalFilterUnits={selectedUnits}
          externalFilterOrderTypes={selectedOrderTypes}
          externalStageFilters={selectedStages}
          onOpenScheduleOrders={onOpenScheduleOrders}
        />
      )}

      {/* Confirmation Modal to Unlink All Orders of the Day */}
      {isUnlinkConfirmOpen && selectedDay && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 animate-in fade-in duration-150"
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
