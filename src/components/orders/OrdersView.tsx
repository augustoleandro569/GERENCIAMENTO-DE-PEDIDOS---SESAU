import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, OrderStatus, Priority, RequestType, DeadlineSituation } from '../../types';
import { calculateDeadlineSituation, formatDate, formatShortDate } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge, PriorityBadge, InlineStatusSelect, ALL_STATUSES } from '../common/StatusBadge';
import { showToast } from '../common/Toast';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { UnifiedCalendar } from '../schedules/UnifiedCalendar';
import { 
  Table, 
  Kanban, 
  Calendar as CalendarIcon, 
  Download, 
  Search, 
  Plus, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  Truck,
  Boxes,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Clock,
  AlertCircle
} from 'lucide-react';

interface OrdersViewProps {
  onSelectOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  onOpenImport: () => void;
  initialFilter?: { status?: string; tipo?: string; unidade?: string };
}

type SortField = 'codigo' | 'unidade' | 'itens' | 'criado_em' | 'prazo' | 'status';

export const OrdersView: React.FC<OrdersViewProps> = ({
  onSelectOrder,
  onOpenNewOrder,
  onOpenImport,
  initialFilter,
}) => {
  const { orders, schedules, units, programs, orderTypes, currentUser, updateOperationalStatus, settings } = useStore();

  // View mode
  const [viewMode, setViewMode] = useState<'tabela' | 'kanban' | 'calendario'>('tabela');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>(initialFilter?.unidade || 'ALL');
  const [filterProgram, setFilterProgram] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>(initialFilter?.tipo || 'ALL');
  const [quickFilter, setQuickFilter] = useState<'TODOS' | 'NO_PRAZO' | 'FORA_DO_PRAZO' | 'AGUARDANDO' | 'SEPARACAO' | 'TRANSPORTE' | 'ENTREGUE' | 'EMERGENCIAL' | 'ATRASADO'>('TODOS');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('criado_em');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const schedulesMap = useMemo(() => {
    const map = new Map<string, typeof schedules[0]>();
    schedules.forEach(s => map.set(s.id, s));
    return map;
  }, [schedules]);

  // Dynamic counts for quick filter chips
  const quickFilterCounts = useMemo(() => {
    let noPrazo = 0;
    let foraDoPrazo = 0;
    let aguardando = 0;
    let separacao = 0;
    let transporte = 0;
    let entregue = 0;
    let emergencial = 0;
    let atrasado = 0;

    orders.forEach(o => {
      if (o.status_operacional === 'Aguardando Aprovação' || o.status_operacional === 'Rascunho') aguardando++;
      if (o.status_operacional === 'Em Separação' || o.status_operacional === 'Aguardando Separação') separacao++;
      if (o.status_operacional === 'Em Transporte' || o.status_operacional === 'Expedida') transporte++;
      if (o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente') entregue++;
      if (o.tipo === 'Emergencial' || o.tipo === 'Falta') emergencial++;

      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(o, sch, settings.horas_alerta_atencao);
      if (situation === 'Dentro do prazo' || situation === 'Concluído no prazo') noPrazo++;
      if (situation === 'Atrasado' || situation === 'Concluído com atraso') foraDoPrazo++;
      if (situation === 'Atrasado') atrasado++;
    });

    return {
      todos: orders.length,
      noPrazo,
      foraDoPrazo,
      aguardando,
      separacao,
      transporte,
      entregue,
      emergencial,
      atrasado,
    };
  }, [orders, schedulesMap, settings.horas_alerta_atencao]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);

      // Quick Chip Filter
      if (quickFilter === 'NO_PRAZO' && (situation !== 'Dentro do prazo' && situation !== 'Concluído no prazo')) return false;
      if (quickFilter === 'FORA_DO_PRAZO' && (situation !== 'Atrasado' && situation !== 'Concluído com atraso')) return false;
      if (quickFilter === 'AGUARDANDO' && order.status_operacional !== 'Aguardando Aprovação' && order.status_operacional !== 'Rascunho') return false;
      if (quickFilter === 'SEPARACAO' && order.status_operacional !== 'Em Separação' && order.status_operacional !== 'Aguardando Separação') return false;
      if (quickFilter === 'TRANSPORTE' && order.status_operacional !== 'Em Transporte' && order.status_operacional !== 'Expedida') return false;
      if (quickFilter === 'ENTREGUE' && order.status_operacional !== 'Entregue' && order.status_operacional !== 'Entregue Parcialmente') return false;
      if (quickFilter === 'EMERGENCIAL' && order.tipo !== 'Emergencial' && order.tipo !== 'Falta') return false;
      if (quickFilter === 'ATRASADO' && situation !== 'Atrasado') return false;

      // Search text
      if (searchTerm) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCode = order.codigo.toLowerCase().includes(query);
        const matchesUnit = order.unidade.toLowerCase().includes(query);
        const matchesRequester = order.solicitante.toLowerCase().includes(query);
        const matchesCpf = order.cpf.toLowerCase().includes(query);
        if (!matchesCode && !matchesUnit && !matchesRequester && !matchesCpf) return false;
      }

      if (filterUnit !== 'ALL' && order.unidade !== filterUnit) return false;
      if (filterProgram !== 'ALL' && order.programa !== filterProgram) return false;
      if (filterType !== 'ALL' && order.tipo !== filterType) return false;

      return true;
    });
  }, [orders, quickFilter, searchTerm, filterUnit, filterProgram, filterType, schedulesMap, settings.horas_alerta_atencao]);

  // Sorted orders
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'codigo':
          valA = a.codigo;
          valB = b.codigo;
          break;
        case 'unidade':
          valA = a.unidade;
          valB = b.unidade;
          break;
        case 'itens':
          valA = a.quantidade_itens || 0;
          valB = b.quantidade_itens || 0;
          break;
        case 'criado_em':
          valA = a.criado_em || '';
          valB = b.criado_em || '';
          break;
        case 'prazo': {
          const schA = a.cronograma_id ? schedulesMap.get(a.cronograma_id) : null;
          const targetA = a.data_prevista_entrega || schA?.data_entrega || '';
          const schB = b.cronograma_id ? schedulesMap.get(b.cronograma_id) : null;
          const targetB = b.data_prevista_entrega || schB?.data_entrega || '';
          valA = targetA;
          valB = targetB;
          break;
        }
        case 'status':
          valA = a.status_operacional;
          valB = b.status_operacional;
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOrders, sortField, sortDirection, schedulesMap]);

  // Paginated items
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedOrders.length / pageSize) || 1;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setQuickFilter('TODOS');
    setFilterUnit('ALL');
    setFilterProgram('ALL');
    setFilterType('ALL');
    setCurrentPage(1);
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportOrdersToSpreadsheet(sortedOrders, format, `pedidos_sesau_${new Date().toISOString().slice(0, 10)}`);
    showToast('success', 'Planilha exportada', `${sortedOrders.length} registros exportados.`);
  };

  const kanbanColumns: OrderStatus[] = [
    'Aguardando Aprovação',
    'Aprovada',
    'Aguardando Separação',
    'Em Separação',
    'Aguardando Conferência',
    'Em Conferência',
    'Expedida',
    'Em Transporte',
    'Entregue',
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls Bar - Rounded 3xl Header Container */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Solicitações & Pedidos
              </h2>
              <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/70 font-bold">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Clique no status para alterar em 1 clique ou clique na linha para abrir a linha do tempo completa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented View Switcher - Rounded Full */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/50 shadow-inner text-xs">
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                viewMode === 'tabela'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-blue-600" />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Kanban className="w-3.5 h-3.5 text-purple-600" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                viewMode === 'calendario'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Calendário</span>
            </button>
          </div>

          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:shadow-xs active:scale-95 border border-slate-200/90 rounded-full transition-all cursor-pointer"
            title="Exportar para Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Slender Rounded Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por código, unidade, solicitante ou CPF..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 hover:bg-slate-50 border border-slate-200/90 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] hover:bg-slate-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
          <select
            value={filterUnit}
            onChange={(e) => { setFilterUnit(e.target.value); setCurrentPage(1); }}
            className="text-xs bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-full px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all cursor-pointer"
          >
            <option value="ALL">Todas as Unidades ({units.length})</option>
            {units.map(u => (
              <option key={u.id} value={u.sigla}>{u.sigla} - {u.nome.slice(0, 24)}</option>
            ))}
          </select>

          <select
            value={filterProgram}
            onChange={(e) => { setFilterProgram(e.target.value); setCurrentPage(1); }}
            className="text-xs bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-full px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all cursor-pointer"
          >
            <option value="ALL">Todos os Programas</option>
            {programs.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="text-xs bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-full px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all cursor-pointer"
          >
            <option value="ALL">Todos os Tipos</option>
            {orderTypes.map(t => (
              <option key={t.id} value={t.nome}>{t.nome}</option>
            ))}
          </select>

          {(filterUnit !== 'ALL' || filterProgram !== 'ALL' || filterType !== 'ALL' || quickFilter !== 'TODOS' || searchTerm) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Rounded Quick Access Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[
          { id: 'TODOS', label: 'Todos', count: quickFilterCounts.todos, color: 'border-slate-300' },
          { id: 'NO_PRAZO', label: '🟢 No Prazo', count: quickFilterCounts.noPrazo, color: 'border-emerald-300' },
          { id: 'FORA_DO_PRAZO', label: '🔴 Fora do Prazo', count: quickFilterCounts.foraDoPrazo, color: 'border-rose-400', isAlert: true },
          { id: 'AGUARDANDO', label: 'Aguardando Aprovação', count: quickFilterCounts.aguardando, color: 'border-amber-300' },
          { id: 'SEPARACAO', label: 'Em Separação', count: quickFilterCounts.separacao, color: 'border-purple-300' },
          { id: 'TRANSPORTE', label: 'Em Transporte', count: quickFilterCounts.transporte, color: 'border-orange-300' },
          { id: 'ENTREGUE', label: 'Entregues', count: quickFilterCounts.entregue, color: 'border-emerald-300' },
          { id: 'EMERGENCIAL', label: 'Emergenciais / Falta', count: quickFilterCounts.emergencial, color: 'border-rose-300', isUrgent: true },
        ].map(chip => {
          const isSelected = quickFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => { setQuickFilter(chip.id as typeof quickFilter); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-slate-900 text-white font-semibold shadow-xs scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200/90 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {chip.isUrgent && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-0.5" />
              )}
              {chip.isAlert && (
                <AlertCircle className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-red-500'}`} />
              )}
              <span>{chip.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: REFINED INTERACTIVE TABELA */}
      {viewMode === 'tabela' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th 
                    onClick={() => handleSort('codigo')} 
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Código</span>
                      {sortField === 'codigo' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('unidade')} 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Unidade</span>
                      {sortField === 'unidade' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-3">Tipo & Programa</th>
                  <th 
                    onClick={() => handleSort('itens')} 
                    className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Itens</span>
                      {sortField === 'itens' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('criado_em')} 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Inicialização</span>
                      {sortField === 'criado_em' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('prazo')} 
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Prazo / SLA</span>
                      {sortField === 'prazo' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-3">
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      <Zap className="w-3.5 h-3.5 text-blue-600" />
                      Status Operacional (1-Clique)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => {
                    const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                    const { situation, label, targetDate } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => onSelectOrder(order)}
                      >
                        <td className="py-2.5 px-3.5 font-mono font-medium text-blue-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="hover:underline font-bold">{order.codigo}</span>
                            {order.origem === 'MANUAL' && (
                              <span className="text-[9px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-full border border-purple-200">
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
                            <span className="text-slate-400 text-[11px]">
                              · {order.programa}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums font-semibold">
                          {order.quantidade_itens}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {formatShortDate(order.data_inicio || order.data_solicitacao || order.criado_em)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500 font-medium">
                              {formatShortDate(targetDate)}
                            </span>
                            <DeadlineBadge situation={situation} label={label} />
                          </div>
                        </td>
                        
                        {/* REFINED FAST INLINE STATUS SELECTOR */}
                        <td 
                          className="py-1.5 px-3 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <InlineStatusSelect
                            currentStatus={order.status_operacional}
                            onStatusChange={(newSt) => {
                              updateOperationalStatus(order.id, newSt, currentUser, 'Alteração rápida via tabela');
                              showToast('success', `${order.codigo} atualizado`, `Status alterado para: ${newSt}`);
                            }}
                            disabled={currentUser.role === 'VIEWER'}
                          />
                        </td>

                        <td 
                          className="py-2.5 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onSelectOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-100/70 border border-slate-200/60 transition-all cursor-pointer"
                            title="Abrir linha do tempo e detalhes completos"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      Nenhum pedido encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Slender Rounded Pagination Bar */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="text-[11px]">
              Mostrando <span className="font-mono font-bold text-slate-800">{Math.min(sortedOrders.length, (currentPage - 1) * pageSize + 1)}</span> a <span className="font-mono font-bold text-slate-800">{Math.min(sortedOrders.length, currentPage * pageSize)}</span> de <span className="font-mono font-bold text-slate-800">{sortedOrders.length}</span> registros
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-100 disabled:opacity-40 transition-all font-medium cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="font-mono text-[11px] px-3 py-1 bg-white rounded-full border border-slate-200/90 text-slate-700 font-bold shadow-2xs">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-100 disabled:opacity-40 transition-all font-medium cursor-pointer shadow-2xs"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN - Rounded Columns and Cards */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-[1350px]">
            {kanbanColumns.map((colStatus) => {
              const colOrders = sortedOrders.filter(o => o.status_operacional === colStatus);
              return (
                <div key={colStatus} className="w-72 shrink-0 bg-slate-100/70 rounded-3xl p-3 border border-slate-200/80 flex flex-col max-h-[75vh]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                    <span className="text-xs font-bold text-slate-800 truncate" title={colStatus}>
                      {colStatus}
                    </span>
                    <span className="font-mono text-[11px] bg-white text-slate-700 px-2.5 py-0.5 rounded-full font-bold border border-slate-200/80 shadow-2xs">
                      {colOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {colOrders.slice(0, 45).map((order) => {
                      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                      const { situation, label } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);
                      return (
                        <div
                          key={order.id}
                          className="bg-white p-3 rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150 cursor-pointer group"
                          onClick={() => onSelectOrder(order)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-xs font-bold text-blue-700 group-hover:underline">
                              {order.codigo}
                            </span>
                            <TypeTag type={order.tipo} />
                          </div>

                          <div className="text-xs font-semibold text-slate-800 mb-1">
                            {order.unidade} · <span className="text-slate-400 font-normal">{order.programa}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                            <span>{order.quantidade_itens} itens</span>
                            <span>{formatShortDate(order.criado_em)}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <DeadlineBadge situation={situation} label={label} />
                            
                            {currentUser.role !== 'VIEWER' && colStatus !== 'Entregue' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextIdx = kanbanColumns.indexOf(colStatus) + 1;
                                  if (nextIdx < kanbanColumns.length) {
                                    const nextSt = kanbanColumns[nextIdx];
                                    updateOperationalStatus(order.id, nextSt, currentUser, 'Avanço Kanban');
                                    showToast('success', `${order.codigo} avançado`, `Novo status: ${nextSt}`);
                                  }
                                }}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-blue-50 transition-colors"
                                title="Avançar para próxima etapa"
                              >
                                <span>Avançar</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {colOrders.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        Nenhum pedido nesta etapa.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: CALENDÁRIO UNIFICADO */}
      {viewMode === 'calendario' && (
        <UnifiedCalendar 
          onSelectOrder={onSelectOrder} 
          filterUnitProp={filterUnit !== 'ALL' ? filterUnit : undefined} 
        />
      )}
    </div>
  );
};
