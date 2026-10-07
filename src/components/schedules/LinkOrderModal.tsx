import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule, OrderStatus } from '../../types';
import { showToast } from '../common/Toast';
import { TypeTag, StatusBadge } from '../common/StatusBadge';
import { getCanonicalUnit } from '../../utils/unitNormalizer';
import { 
  X, 
  Search, 
  Calendar, 
  Link2, 
  Check, 
  Clock, 
  Boxes,
  CheckCircle2,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Tag,
  Activity,
  Layers,
  CheckSquare,
  Square,
  MinusSquare,
  Sparkles,
  ListChecks
} from 'lucide-react';

interface LinkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string; // YYYY-MM-DD
  dayNumber: number;
  monthNumber: number;
  availableSchedules: Schedule[];
}

export const LinkOrderModal: React.FC<LinkOrderModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  dayNumber,
  monthNumber,
  availableSchedules,
}) => {
  const { orders, schedules, units, currentUser, updateOrders, addSchedule } = useStore();

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);

  // Multi-Selection State (permite selecionar múltiplos pedidos em uma única ação)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('AUTO_BY_UNIT');

  // Phase dates for the linked orders
  const [dataSolicitacao, setDataSolicitacao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [dataInicioSeparacao, setDataInicioSeparacao] = useState('');
  const [dataExpedicao, setDataExpedicao] = useState('');
  const [dataEntrega, setDataEntrega] = useState(targetDate);

  useEffect(() => {
    setDataEntrega(targetDate);
  }, [targetDate]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, selectedStatus, selectedUnit, onlyUnlinked]);

  // Unique lists for filter dropdowns
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.tipo) set.add(o.tipo);
    });
    ['Mensal', 'Emergencial', 'Falta', 'Semanal', 'Quinzenal'].forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [orders]);

  const availableStatuses: OrderStatus[] = useMemo(() => [
    'Aguardando Aprovação',
    'Aprovada',
    'Aguardando Separação',
    'Em Separação',
    'Aguardando Conferência',
    'Em Conferência',
    'Expedida',
    'Em Transporte',
    'Entregue',
    'Entregue Parcialmente',
    'Rascunho',
    'Rejeitada',
    'Cancelada'
  ], []);

  const availableUnitNames = useMemo(() => {
    const set = new Set<string>();
    units.forEach(u => {
      if (u.sigla) set.add(u.sigla);
      if (u.nome) set.add(u.nome);
    });
    orders.forEach(o => {
      if (o.unidade) set.add(o.unidade);
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [orders, units]);

  // Filter orders without arbitrary limits
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (onlyUnlinked && order.cronograma_id) return false;
      if (selectedType !== 'ALL' && order.tipo !== selectedType) return false;
      if (selectedStatus !== 'ALL' && order.status_operacional !== selectedStatus) return false;

      if (selectedUnit !== 'ALL') {
        const u = selectedUnit.toLowerCase();
        const ordU = (order.unidade || '').toLowerCase();
        if (ordU !== u && !ordU.includes(u)) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCode = order.codigo?.toLowerCase().includes(q);
        const matchesUnit = order.unidade?.toLowerCase().includes(q);
        const matchesRequester = order.solicitante?.toLowerCase().includes(q);
        const matchesProgram = order.programa?.toLowerCase().includes(q);
        const matchesCpf = order.cpf ? order.cpf.toLowerCase().includes(q) : false;
        if (!matchesCode && !matchesUnit && !matchesRequester && !matchesProgram && !matchesCpf) {
          return false;
        }
      }
      return true;
    });
  }, [orders, searchTerm, onlyUnlinked, selectedType, selectedStatus, selectedUnit]);

  // Paginated items
  const totalCount = filteredOrders.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalCount / pageSize) || 1;

  const paginatedOrders = useMemo(() => {
    if (pageSize === 'ALL') return filteredOrders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Selected orders collection
  const selectedOrdersList = useMemo(() => {
    return orders.filter(o => selectedOrderIds.includes(o.id));
  }, [orders, selectedOrderIds]);

  // Distinct units in selected orders
  const selectedUnitsList = useMemo(() => {
    const set = new Set<string>();
    selectedOrdersList.forEach(o => {
      if (o.unidade) set.add(o.unidade);
    });
    return Array.from(set);
  }, [selectedOrdersList]);

  // Selection state helpers
  const isAllCurrentPageSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.includes(o.id));
  const isSomeCurrentPageSelected = paginatedOrders.some(o => selectedOrderIds.includes(o.id)) && !isAllCurrentPageSelected;

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllCurrentPage = () => {
    const pageIds = paginatedOrders.map(o => o.id);
    setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pageIds])));
  };

  const deselectCurrentPage = () => {
    const pageIds = new Set(paginatedOrders.map(o => o.id));
    setSelectedOrderIds(prev => prev.filter(id => !pageIds.has(id)));
  };

  const selectAllFiltered = () => {
    setSelectedOrderIds(filteredOrders.map(o => o.id));
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const hasActiveFilters = Boolean(
    searchTerm || 
    selectedType !== 'ALL' || 
    selectedStatus !== 'ALL' || 
    selectedUnit !== 'ALL' || 
    onlyUnlinked
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setSelectedUnit('ALL');
    setOnlyUnlinked(false);
    setCurrentPage(1);
  };

  const extractDateOnly = (val?: string) => {
    if (!val) return '';
    if (val.includes('T')) return val.split('T')[0];
    if (val.includes(' ')) return val.split(' ')[0];
    return val;
  };

  // Pre-fill dates from selected orders if only 1 is selected
  useEffect(() => {
    if (isOpen && selectedOrdersList.length === 1) {
      const order = selectedOrdersList[0];
      if (!dataSolicitacao) setDataSolicitacao(extractDateOnly(order.data_solicitacao || order.criado_em));
      if (!dataAprovacao) setDataAprovacao(extractDateOnly(order.data_aprovacao || order.validada_em));
      if (!dataInicioSeparacao) setDataInicioSeparacao(extractDateOnly(order.data_inicio_separacao || order.separado_em));
      if (!dataExpedicao) setDataExpedicao(extractDateOnly(order.data_expedicao || order.expedido_em));
    }
  }, [isOpen, selectedOrdersList.length, dataSolicitacao, dataAprovacao, dataInicioSeparacao, dataExpedicao]);

  if (!isOpen) return null;

  const handleLink = () => {
    if (selectedOrderIds.length === 0) return;

    const targetDeliveryDate = dataEntrega || targetDate;
    const monthStr = monthNumber === 9 ? '09' : '10';
    const monthCycle = monthNumber === 9 ? 'SET/26' : 'OUT/26';

    // Cache de unidade -> scheduleId para reaproveitar ou agrupar cronogramas por unidade
    const unitScheduleMap = new Map<string, string>();

    const getOrCreateScheduleForUnit = (unitName: string, programName?: string, orderTypeName?: string): string => {
      const canonical = getCanonicalUnit(unitName);
      const sigla = (canonical.sigla || '').toUpperCase().trim();
      const ordUnit = (unitName || '').toUpperCase().trim();
      const cacheKey = sigla || ordUnit;

      if (unitScheduleMap.has(cacheKey)) {
        return unitScheduleMap.get(cacheKey)!;
      }

      // 1. Procura cronograma existente nesta data de entrega para esta unidade
      const existing = schedules.find(s => {
        if (s.data_entrega !== targetDeliveryDate) return false;
        const sUnit = (s.unidade || '').toUpperCase().trim();
        return sUnit === ordUnit || sUnit === sigla || sUnit.includes(sigla) || ordUnit.includes(sUnit) ||
               (s.unidades && s.unidades.some(u => {
                 const uUp = u.toUpperCase().trim();
                 return uUp === sigla || uUp === ordUnit;
               }));
      });

      if (existing) {
        unitScheduleMap.set(cacheKey, existing.id);
        return existing.id;
      }

      // 2. Se não existir, gera automaticamente o cronograma para esta unidade no dia
      const createdSch = addSchedule({
        nome: `${sigla || unitName} — ${programName || 'Hospitalar'} ${orderTypeName || 'Mensal'} — ${monthCycle}`,
        competencia: monthCycle,
        unidade: unitName,
        unidades: [unitName],
        programa: programName || 'Hospitalar',
        tipo_pedido: orderTypeName || 'Mensal',
        data_limite_solicitacao: dataSolicitacao || targetDeliveryDate,
        data_limite_aprovacao: dataAprovacao || targetDeliveryDate,
        data_separacao: dataInicioSeparacao || targetDeliveryDate,
        data_expedicao: dataExpedicao || targetDeliveryDate,
        data_entrega: targetDeliveryDate,
        observacao: 'Vinculado em lote pelo calendário',
        ativo: true,
      });

      unitScheduleMap.set(cacheKey, createdSch.id);
      return createdSch.id;
    };

    // Atualização em lote com uma única notificação
    updateOrders(
      selectedOrderIds,
      (ord) => {
        let scheduleIdToAssign: string | null = null;

        if (selectedScheduleId === 'AUTO_BY_UNIT' || selectedScheduleId === 'AUTO_CREATE') {
          scheduleIdToAssign = getOrCreateScheduleForUnit(ord.unidade, ord.programa, ord.tipo);
        } else if (selectedScheduleId !== 'NONE') {
          scheduleIdToAssign = selectedScheduleId;
        }

        return {
          cronograma_id: scheduleIdToAssign,
          cronograma_vinculo: 'MANUAL',
          data_prevista_entrega: targetDeliveryDate,
          data_solicitacao: dataSolicitacao || ord.data_solicitacao || undefined,
          data_aprovacao: dataAprovacao || ord.data_aprovacao || undefined,
          data_inicio_separacao: dataInicioSeparacao || ord.data_inicio_separacao || undefined,
          data_expedicao: dataExpedicao || ord.data_expedicao || undefined,
          validada_em: dataAprovacao ? `${dataAprovacao} 10:00` : ord.validada_em,
          separado_em: dataInicioSeparacao ? `${dataInicioSeparacao} 14:00` : ord.separado_em,
          expedido_em: dataExpedicao ? `${dataExpedicao} 16:00` : ord.expedido_em,
        };
      },
      currentUser,
      `Vinculação em lote de ${selectedOrderIds.length} pedido(s) ao dia ${dayNumber}/${monthStr}/2026 no calendário`
    );

    showToast(
      'success',
      `${selectedOrderIds.length} ${selectedOrderIds.length === 1 ? 'pedido vinculado' : 'pedidos vinculados'} com sucesso!`,
      `Agendados para o dia ${dayNumber}/${monthStr}/2026 com cronograma e datas atualizados em uma única ação.`
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Vincular Pedidos ao Dia {dayNumber} de {monthNumber === 9 ? 'Setembro' : 'Outubro'}
                </h3>
                <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full border border-blue-200">
                  {targetDate}
                </span>
                {selectedOrderIds.length > 0 && (
                  <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 animate-in fade-in">
                    {selectedOrderIds.length} selecionado(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Selecione um ou múltiplos pedidos para agendar e vincular ao cronograma de uma só vez
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto">
          {/* Main Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: SOL-2026-03074), hospital, solicitante, programa ou CPF..."
              className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-medium transition-all"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters Row: Tipo, Status, Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Filter Tipo */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>Tipo de Pedido:</span>
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
              >
                <option value="ALL">Todos os Tipos ({orders.length})</option>
                {availableTypes.map(t => {
                  const count = orders.filter(o => o.tipo === t).length;
                  return (
                    <option key={t} value={t}>
                      {t} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3 text-slate-400" />
                <span>Status Operacional:</span>
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
              >
                <option value="ALL">Todos os Status</option>
                {availableStatuses.map(s => {
                  const count = orders.filter(o => o.status_operacional === s).length;
                  if (count === 0) return null;
                  return (
                    <option key={s} value={s}>
                      {s} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filter Unidade */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>Unidade Hospitalar:</span>
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
              >
                <option value="ALL">Todas as Unidades</option>
                {availableUnitNames.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subheader Toolbar: Checkbox + Batch Action Buttons + Counters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer font-medium select-none text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={onlyUnlinked}
                  onChange={(e) => setOnlyUnlinked(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Apenas sem cronograma</span>
              </label>

              {/* Botões de Seleção em Lote */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={isAllCurrentPageSelected ? deselectCurrentPage : selectAllCurrentPage}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Marcar/desmarcar todos os pedidos visíveis nesta página"
                >
                  {isAllCurrentPageSelected ? <CheckSquare className="w-3 h-3 text-blue-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                  <span>{isAllCurrentPageSelected ? 'Desmarcar Página' : 'Marcar Página'}</span>
                </button>

                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Selecionar todos os pedidos filtrados"
                >
                  <ListChecks className="w-3 h-3 text-blue-600" />
                  <span>Selecionar Todos ({totalCount})</span>
                </button>

                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Desmarcar todos os pedidos selecionados"
                  >
                    <span>Limpar ({selectedOrderIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar Filtros</span>
                </button>
              )}

              <span className="font-mono text-[11px] text-slate-600 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {totalCount} encontrado(s)
              </span>
            </div>
          </div>

          {/* List of Orders with full multi-selection view */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-60 sm:max-h-64 overflow-y-auto bg-white shadow-2xs">
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order, idx) => {
                const isSelected = selectedOrderIds.includes(order.id);
                const isAlreadyLinked = Boolean(order.cronograma_id);

                return (
                  <div
                    key={`${order.id}-${idx}`}
                    onClick={() => toggleOrderSelection(order.id)}
                    className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Custom Checkbox */}
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white hover:border-blue-400'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {order.codigo}
                          </span>
                          <span className="font-bold text-slate-800 text-xs truncate">
                            · {order.unidade}
                          </span>
                          <TypeTag type={order.tipo} />
                          {isAlreadyLinked && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              Vinculado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {order.solicitante} · <strong className="font-mono text-slate-700">{order.quantidade_itens} itens</strong> · {order.programa}
                          {order.data_prevista_entrega && (
                            <span className="text-slate-400"> · Entrega atual: {extractDateOnly(order.data_prevista_entrega)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <StatusBadge status={order.status_operacional} size="sm" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-2">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  Nenhum pedido encontrado com os filtros selecionados.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls Bar */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 py-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Itens por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="ALL">Todos ({totalCount})</option>
                </select>

                {pageSize !== 'ALL' && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalCount)}–{Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                  </span>
                )}
              </div>

              {pageSize !== 'ALL' && totalPages > 1 && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>

                  <span className="font-mono font-bold text-xs px-2 text-slate-700">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>Próximo</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Association & Phase Dates for the selected orders */}
          {selectedOrderIds.length > 0 && (
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200/90 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-900 block text-xs">
                  Configuração de Vínculo em Lote ({selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedUnitsList.map(u => (
                    <span key={u} className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-300">
                      {u}
                    </span>
                  ))}
                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Total: {selectedOrdersList.reduce((acc, o) => acc + (o.quantidade_itens || 0), 0)} itens
                  </span>
                </div>
              </div>

              {/* Badges preview dos pedidos selecionados */}
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto p-1.5 bg-white/80 rounded-xl border border-blue-200/60">
                {selectedOrdersList.map(o => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-mono text-[11px] font-semibold"
                  >
                    <span>{o.codigo}</span>
                    <span className="text-slate-400 font-normal">({o.unidade})</span>
                    <button
                      type="button"
                      onClick={() => toggleOrderSelection(o.id)}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                      title="Remover da seleção"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                  Vincular ao Cronograma da Unidade:
                </label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => {
                    const newSchId = e.target.value;
                    setSelectedScheduleId(newSchId);
                    if (newSchId !== 'NONE' && newSchId !== 'AUTO_CREATE' && newSchId !== 'AUTO_BY_UNIT') {
                      const found = availableSchedules.find(s => s.id === newSchId);
                      if (found) {
                        if (found.data_limite_solicitacao) setDataSolicitacao(found.data_limite_solicitacao);
                        if (found.data_limite_aprovacao) setDataAprovacao(found.data_limite_aprovacao);
                        if (found.data_separacao) setDataInicioSeparacao(found.data_separacao);
                        if (found.data_expedicao) setDataExpedicao(found.data_expedicao);
                        if (found.data_entrega) setDataEntrega(found.data_entrega);
                      }
                    }
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="AUTO_BY_UNIT">✨ Vincular automaticamente por Hospital / Unidade de cada pedido no dia {dayNumber}/{monthNumber === 9 ? '09' : '10'}</option>
                  <option value="AUTO_CREATE">✨ Gerar novo cronograma unificado para os pedidos selecionados</option>
                  <option value="NONE">Vincular diretamente ao dia {dayNumber}/{monthNumber === 9 ? '09' : '10'} no Calendário</option>
                  {availableSchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.unidade} — {s.programa} ({s.competencia}) [Entrega: {s.data_entrega}]
                    </option>
                  ))}
                </select>
              </div>

              {/* 5 Operational Phase Dates */}
              <div className="pt-2.5 border-t border-blue-200/80 space-y-2.5">
                <span className="font-bold text-slate-800 block text-xs">
                  Datas das Etapas Operacionais dos Pedidos Selecionados:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5 font-medium">
                      1. Solicitação:
                    </label>
                    <input
                      type="date"
                      value={dataSolicitacao}
                      onChange={(e) => setDataSolicitacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5 font-medium">
                      2. Aprovação:
                    </label>
                    <input
                      type="date"
                      value={dataAprovacao}
                      onChange={(e) => setDataAprovacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5 font-medium">
                      3. Separação:
                    </label>
                    <input
                      type="date"
                      value={dataInicioSeparacao}
                      onChange={(e) => setDataInicioSeparacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5 font-medium">
                      4. Expedição:
                    </label>
                    <input
                      type="date"
                      value={dataExpedicao}
                      onChange={(e) => setDataExpedicao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-blue-900 block mb-0.5">
                      5. Entrega:
                    </label>
                    <input
                      type="date"
                      value={dataEntrega}
                      onChange={(e) => setDataEntrega(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-blue-100 border border-blue-400 text-blue-950 font-bold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {selectedOrderIds.length > 0 ? (
              <span className="flex items-center gap-1.5 text-blue-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido pronto para vincular' : 'pedidos prontos para vincular'}</span>
              </span>
            ) : (
              <span className="italic text-slate-400">
                Selecione um ou mais pedidos na lista para habilitar a vinculação em lote
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors rounded-xl cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleLink}
              disabled={selectedOrderIds.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-xl shadow-xs hover:shadow transition-all cursor-pointer active:scale-95"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Confirmar Vínculo ({selectedOrderIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
