import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule, OrderStatus } from '../../types';
import { showToast } from '../common/Toast';
import { TypeTag, StatusBadge } from '../common/StatusBadge';
import { formatShortDate, formatDate } from '../../utils/dateUtils';
import { getCanonicalUnit } from '../../utils/unitNormalizer';
import {
  X,
  Search,
  Calendar,
  Link2,
  Check,
  Building2,
  Tag,
  CheckSquare,
  Square,
  ListChecks,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Boxes,
  Layers,
  Clock,
  AlertCircle
} from 'lucide-react';

interface BatchLinkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedOrderIds?: string[];
  preselectedScheduleId?: string;
  initialDeliveryDate?: string;
  onSuccess?: (linkedCount: number) => void;
}

export const BatchLinkOrdersModal: React.FC<BatchLinkOrdersModalProps> = ({
  isOpen,
  onClose,
  preselectedOrderIds = [],
  preselectedScheduleId,
  initialDeliveryDate,
  onSuccess,
}) => {
  const { orders, schedules, units, currentUser, updateOrders, addSchedule } = useStore();

  // Selected schedule state
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    preselectedScheduleId || (schedules[0]?.id ?? 'NONE')
  );

  // Selected orders state (defaults to preselectedOrderIds)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(preselectedOrderIds);

  // Filter & search states for orders picker
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);

  // Pagination for order list
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Sync state when props change
  useEffect(() => {
    if (isOpen) {
      if (preselectedScheduleId) {
        setSelectedScheduleId(preselectedScheduleId);
      } else if (!selectedScheduleId || selectedScheduleId === 'NONE') {
        setSelectedScheduleId(schedules[0]?.id || 'NONE');
      }

      if (preselectedOrderIds && preselectedOrderIds.length > 0) {
        setSelectedOrderIds(preselectedOrderIds);
        setOnlyUnlinked(false); // If opened with preselected orders, show all
      } else {
        setSelectedOrderIds([]);
        setOnlyUnlinked(true); // Default to showing unlinked
      }
      setCurrentPage(1);
    }
  }, [isOpen, preselectedScheduleId, preselectedOrderIds, schedules]);

  // Target schedule info
  const targetSchedule = useMemo(() => {
    return schedules.find(s => s.id === selectedScheduleId) || null;
  }, [schedules, selectedScheduleId]);

  // If a schedule was preselected with specific unit, optionally filter orders by that unit
  useEffect(() => {
    if (targetSchedule && preselectedOrderIds.length === 0) {
      // Suggest schedule's unit if simple
      const u = targetSchedule.unidade;
      if (u && !u.includes(',')) {
        setFilterUnit(u);
      }
    }
  }, [targetSchedule, preselectedOrderIds.length]);

  // Unique list of units for filter dropdown
  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.unidade) set.add(o.unidade);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [orders]);

  // Unique order types
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.tipo) set.add(o.tipo);
    });
    ['Mensal', 'Emergencial', 'Falta', 'Semanal', 'Quinzenal'].forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (onlyUnlinked && order.cronograma_id) return false;
      if (filterType !== 'ALL' && order.tipo !== filterType) return false;

      if (filterUnit !== 'ALL') {
        const u = filterUnit.toLowerCase();
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
  }, [orders, onlyUnlinked, filterType, filterUnit, searchTerm]);

  // Pagination
  const totalCount = filteredOrders.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Selection toggles
  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredOrders.map(o => o.id);
    setSelectedOrderIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const selectCurrentPage = () => {
    const ids = paginatedOrders.map(o => o.id);
    setSelectedOrderIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const deselectCurrentPage = () => {
    const pageSet = new Set(paginatedOrders.map(o => o.id));
    setSelectedOrderIds(prev => prev.filter(id => !pageSet.has(id)));
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const isAllPageSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.includes(o.id));

  // Perform Batch Link Action
  const handleConfirmLink = () => {
    if (selectedOrderIds.length === 0) {
      showToast('error', 'Nenhum pedido selecionado', 'Selecione ao menos um pedido para vincular.');
      return;
    }

    if (!selectedScheduleId || selectedScheduleId === 'NONE') {
      showToast('error', 'Nenhum cronograma selecionado', 'Selecione o cronograma de destino.');
      return;
    }

    const sch = schedules.find(s => s.id === selectedScheduleId);
    if (!sch) {
      showToast('error', 'Cronograma inválido', 'O cronograma selecionado não foi encontrado.');
      return;
    }

    // Apply batch updates
    updateOrders(
      selectedOrderIds,
      (ord) => {
        return {
          cronograma_id: sch.id,
          cronograma_vinculo: 'MANUAL',
          data_prevista_entrega: sch.data_entrega,
          data_solicitacao: sch.data_limite_solicitacao || ord.data_solicitacao,
          data_aprovacao: sch.data_limite_aprovacao || ord.data_aprovacao,
          data_inicio_separacao: sch.data_separacao || ord.data_inicio_separacao,
          data_expedicao: sch.data_expedicao || ord.data_expedicao,
          validada_em: sch.data_limite_aprovacao ? `${sch.data_limite_aprovacao} 10:00` : ord.validada_em,
          separado_em: sch.data_separacao ? `${sch.data_separacao} 14:00` : ord.separado_em,
          expedido_em: sch.data_expedicao ? `${sch.data_expedicao} 16:00` : ord.expedido_em,
        };
      },
      currentUser,
      `Vinculação em lote de ${selectedOrderIds.length} pedido(s) ao cronograma "${sch.nome}"`
    );

    showToast(
      'success',
      `${selectedOrderIds.length} ${selectedOrderIds.length === 1 ? 'pedido vinculado' : 'pedidos vinculados'} com sucesso!`,
      `Vinculados ao cronograma "${sch.nome}" (Entrega: ${formatShortDate(sch.data_entrega)}) em uma única ação.`
    );

    if (onSuccess) {
      onSuccess(selectedOrderIds.length);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Vincular Múltiplos Pedidos em Uma Única Ação
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Em Lote
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Selecione os pedidos e o cronograma de destino para sincronizar prazos e etapas
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Target Schedule Selector Card */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Cronograma de Destino:</span>
              </label>
              {targetSchedule && (
                <span className="text-[11px] font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                  Competência: {targetSchedule.competencia} · Entrega: {formatShortDate(targetSchedule.data_entrega)}
                </span>
              )}
            </div>

            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="w-full text-xs bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
            >
              {schedules.map(sch => (
                <option key={sch.id} value={sch.id}>
                  {sch.nome} — {sch.unidade} ({sch.competencia}) [Entrega: {formatShortDate(sch.data_entrega)}]
                </option>
              ))}
            </select>

            {/* Schedule Stage Dates Summary */}
            {targetSchedule && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                <div className="p-2 bg-white/80 rounded-xl border border-blue-100 text-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">1. Solicitação</span>
                  <span className="font-mono font-bold text-slate-800">{formatShortDate(targetSchedule.data_limite_solicitacao) || '—'}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-xl border border-blue-100 text-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">2. Aprovação</span>
                  <span className="font-mono font-bold text-slate-800">{formatShortDate(targetSchedule.data_limite_aprovacao) || '—'}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-xl border border-blue-100 text-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">3. Separação</span>
                  <span className="font-mono font-bold text-slate-800">{formatShortDate(targetSchedule.data_separacao) || '—'}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-xl border border-blue-100 text-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">4. Expedição</span>
                  <span className="font-mono font-bold text-slate-800">{formatShortDate(targetSchedule.data_expedicao) || '—'}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-emerald-700 block font-semibold">5. Entrega</span>
                  <span className="font-mono font-bold">{formatShortDate(targetSchedule.data_entrega)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Orders Filter & Search Toolbar */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar pedidos por código, hospital, solicitante ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Unit Dropdown */}
              <div className="w-full sm:w-48">
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todas as Unidades</option>
                  {availableUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Type Dropdown */}
              <div className="w-full sm:w-36">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos os Tipos</option>
                  {availableTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Action Bar for Selection */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyUnlinked}
                    onChange={(e) => setOnlyUnlinked(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Apenas sem cronograma</span>
                </label>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <button
                  type="button"
                  onClick={isAllPageSelected ? deselectCurrentPage : selectCurrentPage}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  {isAllPageSelected ? <CheckSquare className="w-3 h-3 text-blue-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                  <span>{isAllPageSelected ? 'Desmarcar Página' : 'Marcar Página'}</span>
                </button>

                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <ListChecks className="w-3 h-3 text-blue-600" />
                  <span>Marcar Todos ({totalCount})</span>
                </button>

                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 cursor-pointer shadow-2xs"
                  >
                    Limpar Seleção ({selectedOrderIds.length})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {totalCount} pedidos listados
                </span>
                {selectedOrderIds.length > 0 && (
                  <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 animate-in fade-in">
                    {selectedOrderIds.length} selecionado(s)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Orders Table with Checkboxes */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isLinkedToAnother = order.cronograma_id && order.cronograma_id !== selectedScheduleId;
                  const isAlreadyLinkedToThis = order.cronograma_id === selectedScheduleId;

                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleOrder(order.id)}
                      className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white hover:border-blue-400'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">
                              {order.codigo}
                            </span>
                            <span className="font-bold text-slate-800 truncate">
                              · {order.unidade}
                            </span>
                            <TypeTag type={order.tipo} />
                            {isAlreadyLinkedToThis && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Já neste cronograma
                              </span>
                            )}
                            {isLinkedToAnother && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Em outro cronograma
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            {order.solicitante} · <strong className="font-mono text-slate-700">{order.quantidade_itens} itens</strong> · {order.programa}
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
                    Nenhum pedido encontrado para os filtros selecionados.
                  </p>
                </div>
              )}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="text-[11px]">
                  Página {currentPage} de {totalPages} ({totalCount} pedidos)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer font-medium"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="font-semibold">
              {selectedOrderIds.length === 0 ? (
                'Nenhum pedido selecionado'
              ) : (
                <>
                  <strong className="text-blue-700 font-mono font-bold text-sm">{selectedOrderIds.length}</strong> {selectedOrderIds.length === 1 ? 'pedido pronto para vincular' : 'pedidos prontos para vincular'}
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-full border border-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={selectedOrderIds.length === 0 || !selectedScheduleId || selectedScheduleId === 'NONE'}
              onClick={handleConfirmLink}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>
                {selectedOrderIds.length === 0 
                  ? 'Selecione Pedidos' 
                  : `Vincular ${selectedOrderIds.length} ${selectedOrderIds.length === 1 ? 'Pedido' : 'Pedidos'} em Uma Única Ação`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
