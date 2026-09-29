import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Schedule, Order, OrderStatus } from '../../types';
import { calculateDeadlineSituation, formatDate, formatShortDate } from '../../utils/dateUtils';
import { DeadlineBadge, TypeTag, PriorityBadge, InlineStatusSelect } from '../common/StatusBadge';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { showToast } from '../common/Toast';
import { 
  X, 
  Calendar, 
  Search, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  ExternalLink,
  Zap,
  TrendingUp,
  Filter,
  Check
} from 'lucide-react';

interface ScheduleOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule;
  initialFilter?: 'ALL' | 'NO_PRAZO' | 'ATENCAO' | 'FORA_DO_PRAZO';
  onSelectOrder?: (order: Order) => void;
}

export const ScheduleOrdersModal: React.FC<ScheduleOrdersModalProps> = ({
  isOpen,
  onClose,
  schedule,
  initialFilter = 'ALL',
  onSelectOrder,
}) => {
  const { orders, updateOrder, updateOperationalStatus, currentUser, settings } = useStore();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NO_PRAZO' | 'ATENCAO' | 'FORA_DO_PRAZO'>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDateOrderId, setEditingDateOrderId] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState<string>('');

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter, isOpen]);

  const unitsList = useMemo(() => {
    if (!schedule) return [];
    return schedule.unidades && schedule.unidades.length > 0
      ? schedule.unidades
      : schedule.unidade.includes(',')
      ? schedule.unidade.split(',').map(s => s.trim())
      : [schedule.unidade];
  }, [schedule]);

  // All orders linked to this schedule
  const linkedOrders = useMemo(() => {
    if (!schedule) return [];
    return orders.filter(o => o.cronograma_id === schedule.id);
  }, [orders, schedule]);

  // SLA Assessment for each order
  const ordersWithSLA = useMemo(() => {
    if (!schedule) return [];
    return linkedOrders.map(order => {
      const sla = calculateDeadlineSituation(order, schedule, settings.horas_alerta_atencao);
      const isDelivered = order.status_operacional === 'Entregue' || order.status_operacional === 'Entregue Parcialmente';
      const isNoPrazo = sla.situation === 'Dentro do prazo' || sla.situation === 'Concluído no prazo';
      const isAtencao = sla.situation === 'Atenção';
      const isForaDoPrazo = sla.situation === 'Atrasado' || sla.situation === 'Concluído com atraso';

      return {
        order,
        sla,
        isDelivered,
        isNoPrazo,
        isAtencao,
        isForaDoPrazo,
      };
    });
  }, [linkedOrders, schedule, settings.horas_alerta_atencao]);

  // Counts
  const counts = useMemo(() => {
    let noPrazo = 0;
    let atencao = 0;
    let foraDoPrazo = 0;
    let delivered = 0;

    ordersWithSLA.forEach(item => {
      if (item.isNoPrazo) noPrazo++;
      if (item.isAtencao) atencao++;
      if (item.isForaDoPrazo) foraDoPrazo++;
      if (item.isDelivered) delivered++;
    });

    const total = ordersWithSLA.length;
    const taxaNoPrazo = total > 0 ? Math.round((noPrazo / total) * 100) : 100;
    const progressPercent = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return {
      total,
      noPrazo,
      atencao,
      foraDoPrazo,
      delivered,
      taxaNoPrazo,
      progressPercent,
    };
  }, [ordersWithSLA]);

  // Filtered orders list
  const filteredList = useMemo(() => {
    return ordersWithSLA.filter(item => {
      if (activeFilter === 'NO_PRAZO' && !item.isNoPrazo) return false;
      if (activeFilter === 'ATENCAO' && !item.isAtencao) return false;
      if (activeFilter === 'FORA_DO_PRAZO' && !item.isForaDoPrazo) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const o = item.order;
        const matchesCode = o.codigo.toLowerCase().includes(q);
        const matchesUnit = o.unidade.toLowerCase().includes(q);
        const matchesRequester = o.solicitante.toLowerCase().includes(q);
        if (!matchesCode && !matchesUnit && !matchesRequester) return false;
      }
      return true;
    });
  }, [ordersWithSLA, activeFilter, searchTerm]);

  if (!isOpen || !schedule) return null;

  const handleExport = () => {
    const listToExport = filteredList.map(item => item.order);
    exportOrdersToSpreadsheet(listToExport, 'xlsx', `pedidos_cronograma_${schedule.nome.replace(/\s+/g, '_')}`);
    showToast('success', 'Planilha exportada', `${listToExport.length} pedidos exportados com sucesso.`);
  };

  const handleQuickSetInitialDate = (order: Order, dateStr: string) => {
    if (!dateStr) return;
    updateOrder(order.id, { 
      data_inicio: dateStr,
      data_solicitacao: order.data_solicitacao || dateStr,
    }, currentUser, 'Data de inicialização definida');
    showToast('success', `${order.codigo} atualizado`, `Data de inicialização definida para ${formatShortDate(dateStr)}`);
    setEditingDateOrderId(null);
  };

  const handleBatchSetInitialDates = () => {
    const uninitialized = linkedOrders.filter(o => !o.data_inicio);
    if (uninitialized.length === 0) {
      showToast('info', 'Todos já possuem data', 'Todos os pedidos deste cronograma já contam com data de inicialização.');
      return;
    }

    const defaultDate = schedule.data_limite_solicitacao || new Date().toISOString().split('T')[0];
    uninitialized.forEach(o => {
      updateOrder(o.id, { 
        data_inicio: defaultDate,
        data_solicitacao: o.data_solicitacao || defaultDate,
      }, currentUser, 'Data de inicialização em lote');
    });

    showToast('success', 'Datas de Inicialização Definidas', `${uninitialized.length} pedidos inicializados com a data ${formatShortDate(defaultDate)}.`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Auditoria de Prazos & Progresso do Cronograma
                </h3>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {schedule.competencia}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {schedule.nome} · <strong>{schedule.programa}</strong> ({schedule.tipo_pedido})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight Metrics & Progress Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200/80 space-y-3">
          {/* Progress Bar & Rate */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Progresso Operacional do Ciclo: <strong>{counts.delivered} de {counts.total} pedidos entregues</strong>
              </span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {counts.progressPercent}% Concluído
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${counts.progressPercent}%` }}
              />
            </div>
          </div>

          {/* 4 Clickable Metric Cards for Fast SLA Toggling */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total */}
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`text-[10px] uppercase font-bold block ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
                Total de Pedidos
              </span>
              <div className="text-xl font-mono font-bold mt-0.5">
                {counts.total}
              </div>
              <span className={`text-[10px] ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                Vinculados ao ciclo
              </span>
            </button>

            {/* No Prazo */}
            <button
              type="button"
              onClick={() => setActiveFilter('NO_PRAZO')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'NO_PRAZO'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs scale-[1.02]'
                  : 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:bg-emerald-100/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold flex items-center gap-1 ${activeFilter === 'NO_PRAZO' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  No Prazo
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${activeFilter === 'NO_PRAZO' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-800'}`}>
                  {counts.taxaNoPrazo}%
                </span>
              </div>
              <div className="text-xl font-mono font-bold mt-0.5">
                {counts.noPrazo}
              </div>
              <span className={`text-[10px] ${activeFilter === 'NO_PRAZO' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Cumprindo o SLA
              </span>
            </button>

            {/* Atenção */}
            <button
              type="button"
              onClick={() => setActiveFilter('ATENCAO')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'ATENCAO'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-[1.02]'
                  : 'bg-amber-50/70 text-amber-950 border-amber-200 hover:bg-amber-100/70'
              }`}
            >
              <span className={`text-[10px] uppercase font-bold flex items-center gap-1 ${activeFilter === 'ATENCAO' ? 'text-amber-100' : 'text-amber-700'}`}>
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Em Atenção
              </span>
              <div className="text-xl font-mono font-bold mt-0.5">
                {counts.atencao}
              </div>
              <span className={`text-[10px] ${activeFilter === 'ATENCAO' ? 'text-amber-100' : 'text-amber-700'}`}>
                Próximos do limite
              </span>
            </button>

            {/* Fora do Prazo */}
            <button
              type="button"
              onClick={() => setActiveFilter('FORA_DO_PRAZO')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'FORA_DO_PRAZO'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs scale-[1.02]'
                  : 'bg-rose-50/70 text-rose-950 border-rose-200 hover:bg-rose-100/70'
              }`}
            >
              <span className={`text-[10px] uppercase font-bold flex items-center gap-1 ${activeFilter === 'FORA_DO_PRAZO' ? 'text-rose-100' : 'text-rose-700'}`}>
                <AlertCircle className="w-3 h-3 text-rose-500" />
                Fora do Prazo
              </span>
              <div className="text-xl font-mono font-bold mt-0.5">
                {counts.foraDoPrazo}
              </div>
              <span className={`text-[10px] ${activeFilter === 'FORA_DO_PRAZO' ? 'text-rose-100' : 'text-rose-700'}`}>
                Atrasados / Estourados
              </span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Quick SLA Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-full border border-slate-200/60 overflow-x-auto w-full md:w-auto">
            {[
              { id: 'ALL', label: 'Todos os Pedidos', count: counts.total },
              { id: 'NO_PRAZO', label: '🟢 No Prazo', count: counts.noPrazo },
              { id: 'ATENCAO', label: '🟡 Em Atenção', count: counts.atencao },
              { id: 'FORA_DO_PRAZO', label: '🔴 Fora do Prazo', count: counts.foraDoPrazo },
            ].map(tab => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
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

          {/* Search & Batch Action */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar código ou solicitante..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {currentUser.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={handleBatchSetInitialDates}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full cursor-pointer shadow-2xs whitespace-nowrap"
                title="Preencher data de inicialização padrão para todos os pedidos sem data neste cronograma"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Inicializar em Lote</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body: Table of Orders with Data de Inicialização & SLA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredList.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3.5">Código / Origem</th>
                      <th className="py-3 px-3">Unidade Hospitalar</th>
                      <th className="py-3 px-3">
                        <span className="flex items-center gap-1 text-blue-800 font-bold">
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          Data de Inicialização
                        </span>
                      </th>
                      <th className="py-3 px-3 text-center">Previsão Entrega</th>
                      <th className="py-3 px-3">Situação SLA</th>
                      <th className="py-3 px-3">
                        <span className="flex items-center gap-1 text-slate-800 font-bold">
                          <Zap className="w-3 h-3 text-blue-600" />
                          Status (1-Clique)
                        </span>
                      </th>
                      <th className="py-3 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredList.map(({ order, sla }) => {
                      const isEditingDate = editingDateOrderId === order.id;
                      const initialDateVal = order.data_inicio || order.data_solicitacao || order.criado_em?.split(' ')[0] || '';

                      return (
                        <tr 
                          key={order.id} 
                          className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                          onClick={() => {
                            onClose();
                            onSelectOrder?.(order);
                          }}
                        >
                          {/* Código & Tipo */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-700 group-hover:underline">
                                {order.codigo}
                              </span>
                              <TypeTag type={order.tipo} />
                            </div>
                          </td>

                          {/* Unidade */}
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            <div>
                              <span>{order.unidade}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {order.solicitante}
                              </span>
                            </div>
                          </td>

                          {/* Data de Inicialização (Interactive / Editable) */}
                          <td 
                            className="py-2.5 px-3 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isEditingDate ? (
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
                                  className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                  title="Salvar Data de Inicialização"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDateOrderId(null)}
                                  className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {initialDateVal ? (
                                  <span className="font-mono font-bold text-slate-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    {formatShortDate(initialDateVal)}
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
                                      setTempDateValue(initialDateVal || new Date().toISOString().split('T')[0]);
                                    }}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline px-1 py-0.5 rounded-md hover:bg-blue-100/60"
                                    title="Definir ou alterar data de inicialização do pedido"
                                  >
                                    {initialDateVal ? 'Alterar' : '+ Definir'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Data Prevista de Entrega */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono font-bold text-emerald-800">
                            {formatShortDate(order.data_prevista_entrega || schedule.data_entrega)}
                          </td>

                          {/* Situação SLA */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <DeadlineBadge situation={sla.situation} label={sla.label} />
                          </td>

                          {/* Status Operacional */}
                          <td 
                            className="py-1.5 px-3 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineStatusSelect
                              currentStatus={order.status_operacional}
                              onStatusChange={(newSt) => {
                                updateOperationalStatus(order.id, newSt, currentUser, 'Alteração via auditoria do cronograma');
                                showToast('success', `${order.codigo} atualizado`, `Status: ${newSt}`);
                              }}
                              disabled={currentUser.role === 'VIEWER'}
                            />
                          </td>

                          {/* Ações */}
                          <td 
                            className="py-2.5 px-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectOrder?.(order);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-700 hover:bg-blue-100/70 border border-blue-200 transition-all cursor-pointer"
                              title="Abrir detalhes completos do pedido"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Ver</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
              <p>Nenhum pedido encontrado com o filtro selecionado ({activeFilter}).</p>
              {counts.total === 0 && (
                <p className="text-slate-500 font-normal">
                  Ainda não há pedidos vinculados a este cronograma. Os pedidos serão associados automaticamente com base nas unidades, programa e modalidade.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Exibindo <span className="font-mono font-bold text-slate-800">{filteredList.length}</span> de <span className="font-mono font-bold text-slate-800">{counts.total}</span> pedido(s) vinculados
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            Fechar Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
