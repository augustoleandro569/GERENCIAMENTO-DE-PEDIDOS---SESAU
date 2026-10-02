import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, OrderStatus, Priority, RequestType, DeadlineSituation } from '../../types';
import { calculateDeadlineSituation, formatDate, formatShortDate } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge, PriorityBadge, InlineStatusSelect, ALL_STATUSES } from '../common/StatusBadge';
import { showToast } from '../common/Toast';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { UnifiedCalendar } from '../schedules/UnifiedCalendar';
import { MultiSelect } from '../common/MultiSelect';
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
  ArrowLeft,
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
  AlertCircle,
  Building2,
  Package,
  Calendar,
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

  // Search & Multi-Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>(initialFilter?.unidade ? [initialFilter.unidade] : []);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialFilter?.tipo ? [initialFilter.tipo] : []);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('criado_em');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination & Display limit
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(100);

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

  // Filtered orders with Multi-Select support
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);

      // Multi-quick-filter check: order must match at least one selected chip if any are selected
      if (selectedQuickFilters.length > 0) {
        const matchesAnyQuickFilter = selectedQuickFilters.some(qf => {
          if (qf === 'NO_PRAZO') return situation === 'Dentro do prazo' || situation === 'Concluído no prazo';
          if (qf === 'FORA_DO_PRAZO') return situation === 'Atrasado' || situation === 'Concluído com atraso';
          if (qf === 'EMERGENCIAL') return order.tipo === 'Emergencial' || order.tipo === 'Falta';
          if (qf === 'ATRASADO') return situation === 'Atrasado';

          if (viewMode !== 'kanban') {
            if (qf === 'AGUARDANDO') return order.status_operacional === 'Aguardando Aprovação' || order.status_operacional === 'Rascunho';
            if (qf === 'SEPARACAO') return order.status_operacional === 'Em Separação' || order.status_operacional === 'Aguardando Separação';
            if (qf === 'TRANSPORTE') return order.status_operacional === 'Em Transporte' || order.status_operacional === 'Expedida';
            if (qf === 'ENTREGUE') return order.status_operacional === 'Entregue' || order.status_operacional === 'Entregue Parcialmente';
          }
          return false;
        });

        if (!matchesAnyQuickFilter) return false;
      }

      // Search text
      if (searchTerm) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCode = order.codigo.toLowerCase().includes(query);
        const matchesUnit = order.unidade.toLowerCase().includes(query);
        const matchesRequester = order.solicitante.toLowerCase().includes(query);
        const matchesCpf = order.cpf ? order.cpf.toLowerCase().includes(query) : false;
        if (!matchesCode && !matchesUnit && !matchesRequester && !matchesCpf) return false;
      }

      // Multi-select Units
      if (selectedUnits.length > 0 && !selectedUnits.includes(order.unidade)) return false;

      // Multi-select Programs
      if (selectedPrograms.length > 0 && !selectedPrograms.includes(order.programa)) return false;

      // Multi-select Types
      if (selectedTypes.length > 0 && !selectedTypes.includes(order.tipo)) return false;

      return true;
    });
  }, [orders, selectedQuickFilters, searchTerm, selectedUnits, selectedPrograms, selectedTypes, schedulesMap, settings.horas_alerta_atencao, viewMode]);

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
    if (pageSize === 'ALL') return sortedOrders;
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const totalPages = pageSize === 'ALL' ? 1 : (Math.ceil(sortedOrders.length / pageSize) || 1);

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
    setSelectedUnits([]);
    setSelectedPrograms([]);
    setSelectedTypes([]);
    setSelectedQuickFilters([]);
    setCurrentPage(1);
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    exportOrdersToSpreadsheet(sortedOrders, format, `pedidos_sesau_${new Date().toISOString().slice(0, 10)}`);
    showToast('success', 'Planilha exportada', `${sortedOrders.length} registros exportados.`);
  };

  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  interface KanbanColumnConfig {
    id: string;
    title: string;
    statuses: OrderStatus[];
    advanceTo?: OrderStatus;
    retroactTo?: OrderStatus;
    headerBorder: string;
    badgeBg: string;
    badgeText: string;
    dotColor: string;
  }

  const kanbanPipeline: KanbanColumnConfig[] = [
    {
      id: 'col-aguardando',
      title: 'Aguardando Aprovação',
      statuses: ['Aguardando Aprovação', 'Rascunho'],
      advanceTo: 'Aguardando Separação',
      headerBorder: 'border-amber-300',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      dotColor: 'bg-amber-500',
    },
    {
      id: 'col-aprovada',
      title: 'Aguardando Separação',
      statuses: ['Aguardando Separação', 'Aprovada'],
      advanceTo: 'Em Separação',
      retroactTo: 'Aguardando Aprovação',
      headerBorder: 'border-purple-300',
      badgeBg: 'bg-purple-100 border-purple-300',
      badgeText: 'text-purple-800',
      dotColor: 'bg-purple-500',
    },
    {
      id: 'col-separacao',
      title: 'Em Separação',
      statuses: ['Em Separação'],
      advanceTo: 'Aguardando Conferência',
      retroactTo: 'Aguardando Separação',
      headerBorder: 'border-indigo-300',
      badgeBg: 'bg-indigo-100 border-indigo-300',
      badgeText: 'text-indigo-800',
      dotColor: 'bg-indigo-500',
    },
    {
      id: 'col-aguardando-conf',
      title: 'Aguardando Conferência',
      statuses: ['Aguardando Conferência'],
      advanceTo: 'Em Conferência',
      retroactTo: 'Em Separação',
      headerBorder: 'border-sky-300',
      badgeBg: 'bg-sky-100 border-sky-300',
      badgeText: 'text-sky-800',
      dotColor: 'bg-sky-500',
    },
    {
      id: 'col-conferencia',
      title: 'Em Conferência',
      statuses: ['Em Conferência'],
      advanceTo: 'Expedida',
      retroactTo: 'Aguardando Conferência',
      headerBorder: 'border-teal-300',
      badgeBg: 'bg-teal-100 border-teal-300',
      badgeText: 'text-teal-800',
      dotColor: 'bg-teal-500',
    },
    {
      id: 'col-expedida',
      title: 'Expedida',
      statuses: ['Expedida'],
      advanceTo: 'Em Transporte',
      retroactTo: 'Em Conferência',
      headerBorder: 'border-cyan-300',
      badgeBg: 'bg-cyan-100 border-cyan-300',
      badgeText: 'text-cyan-800',
      dotColor: 'bg-cyan-500',
    },
    {
      id: 'col-transporte',
      title: 'Em Transporte',
      statuses: ['Em Transporte'],
      advanceTo: 'Entregue',
      retroactTo: 'Expedida',
      headerBorder: 'border-orange-300',
      badgeBg: 'bg-orange-100 border-orange-300',
      badgeText: 'text-orange-800',
      dotColor: 'bg-orange-500',
    },
    {
      id: 'col-entregue',
      title: 'Entregue',
      statuses: ['Entregue', 'Entregue Parcialmente'],
      retroactTo: 'Em Transporte',
      headerBorder: 'border-emerald-300',
      badgeBg: 'bg-emerald-100 border-emerald-300',
      badgeText: 'text-emerald-800',
      dotColor: 'bg-emerald-500',
    },
    {
      id: 'col-cancelada',
      title: 'Cancelada / Rejeitada',
      statuses: ['Rejeitada', 'Cancelada'],
      retroactTo: 'Aguardando Aprovação',
      headerBorder: 'border-rose-300',
      badgeBg: 'bg-rose-100 border-rose-300',
      badgeText: 'text-rose-800',
      dotColor: 'bg-rose-500',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Consolidated Top Control & Filtering Center */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
        {/* Tier 1: View Header, Mode Switcher & Export */}
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  Solicitações & Pedidos
                </h2>
                <span className="text-[11px] font-mono text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-bold shrink-0">
                  {filteredOrders.length === orders.length 
                    ? `${orders.length} linhas de pedido`
                    : `${filteredOrders.length} de ${orders.length} linhas`}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-xl">
                Altere status com 1 clique ou clique na linha para abrir a linha do tempo e auditoria
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            {/* Segmented View Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shadow-2xs">
              <button
                onClick={() => setViewMode('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold whitespace-nowrap ${
                  viewMode === 'tabela'
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Tabela</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold whitespace-nowrap ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <Kanban className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('calendario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold whitespace-nowrap ${
                  viewMode === 'calendario'
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Calendário</span>
              </button>
            </div>

            {/* Export Action */}
            <button
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 hover:shadow-xs active:scale-95 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              title="Exportar pedidos para Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Search Input & Multi-Select Dropdowns */}
        <div className="p-3.5 bg-slate-50/50 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por código (ex: SOL-2026-03074), unidade, solicitante ou CPF..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-400 font-medium shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] hover:bg-slate-300 transition-colors cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {/* Multi-Select Unidades */}
            <MultiSelect
              options={units.map(u => ({ id: u.sigla, label: u.sigla, subLabel: u.nome }))}
              selected={selectedUnits}
              onChange={(next) => { setSelectedUnits(next); setCurrentPage(1); }}
              placeholder="Todas as Unidades"
              className="flex-1 sm:flex-initial sm:w-48"
              showSearch={true}
            />

            {/* Multi-Select Programas */}
            <MultiSelect
              options={programs.map(p => ({ id: p.nome, label: p.nome }))}
              selected={selectedPrograms}
              onChange={(next) => { setSelectedPrograms(next); setCurrentPage(1); }}
              placeholder="Todos os Programas"
              className="flex-1 sm:flex-initial sm:w-44"
            />

            {/* Multi-Select Tipos */}
            <MultiSelect
              options={orderTypes.map(t => ({ id: t.nome, label: t.nome, color: t.cor }))}
              selected={selectedTypes}
              onChange={(next) => { setSelectedTypes(next); setCurrentPage(1); }}
              placeholder="Todos os Tipos"
              className="flex-1 sm:flex-initial sm:w-40"
            />

            {(selectedUnits.length > 0 || selectedPrograms.length > 0 || selectedTypes.length > 0 || selectedQuickFilters.length > 0 || searchTerm) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-rose-700 hover:text-rose-900 font-bold px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 3: Directed Status & SLA Filter Ribbon */}
        <div className="px-4 py-2.5 bg-white flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 hidden sm:inline">
            Status & SLA:
          </span>

          <button
            onClick={() => { setSelectedQuickFilters([]); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs ${
              selectedQuickFilters.length === 0
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>Todos</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              selectedQuickFilters.length === 0 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {quickFilterCounts.todos}
            </span>
          </button>

          {[
            { id: 'NO_PRAZO', label: '🟢 No Prazo', count: quickFilterCounts.noPrazo },
            { id: 'FORA_DO_PRAZO', label: '🔴 Fora do Prazo', count: quickFilterCounts.foraDoPrazo, isAlert: true },
            { id: 'AGUARDANDO', label: 'Aguardando Aprovação', count: quickFilterCounts.aguardando },
            { id: 'SEPARACAO', label: 'Em Separação', count: quickFilterCounts.separacao },
            { id: 'TRANSPORTE', label: 'Em Transporte', count: quickFilterCounts.transporte },
            { id: 'ENTREGUE', label: 'Entregues', count: quickFilterCounts.entregue },
            { id: 'EMERGENCIAL', label: 'Emergenciais / Falta', count: quickFilterCounts.emergencial, isUrgent: true },
          ].map(chip => {
            const isSelected = selectedQuickFilters.includes(chip.id);
            const handleToggleChip = () => {
              if (isSelected) {
                setSelectedQuickFilters(prev => prev.filter(c => c !== chip.id));
              } else {
                setSelectedQuickFilters(prev => [...prev, chip.id]);
              }
              setCurrentPage(1);
            };

            return (
              <button
                key={chip.id}
                onClick={handleToggleChip}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {chip.isUrgent && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping mr-0.5" />
                )}
                {chip.isAlert && (
                  <AlertCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-red-500'}`} />
                )}
                <span>{chip.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
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
                  paginatedOrders.map((order, idx) => {
                    const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                    const { situation, label, targetDate } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);
                    return (
                      <tr
                        key={`${order.id}-${idx}`}
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

          {/* Crisp, Sharp Pagination & Display Bar */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-slate-700">
                {pageSize === 'ALL' ? (
                  <>Apresentando <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">todas as {sortedOrders.length}</span> linhas de pedido</>
                ) : (
                  <>
                    Mostrando <span className="font-mono font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> a{' '}
                    <span className="font-mono font-bold text-slate-900">{Math.min(sortedOrders.length, currentPage * pageSize)}</span> de{' '}
                    <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{sortedOrders.length}</span> linhas de pedido
                  </>
                )}
              </span>

              {/* Toggle Quick All Button */}
              <button
                onClick={() => {
                  if (pageSize === 'ALL') {
                    setPageSize(100);
                    setCurrentPage(1);
                  } else {
                    setPageSize('ALL');
                    setCurrentPage(1);
                  }
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer shadow-2xs ${
                  pageSize === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-950'
                }`}
                title={pageSize === 'ALL' ? 'Ativar paginação' : 'Apresentar todas as linhas de pedido na mesma página'}
              >
                {pageSize === 'ALL' ? 'Paginar (100/pág)' : `Ver Todas as ${sortedOrders.length} Linhas`}
              </button>
            </div>

            {/* Page Size & Navigation Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-medium">Linhas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1.000</option>
                  <option value="ALL">Todas ({sortedOrders.length})</option>
                </select>
              </div>

              {/* Navigation arrows (if not displaying ALL) */}
              {pageSize !== 'ALL' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition-all font-medium cursor-pointer shadow-2xs text-[11px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>

                  <span className="font-mono text-[11px] px-2.5 py-1 bg-white rounded-lg border border-slate-300 text-slate-800 font-bold shadow-2xs">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition-all font-medium cursor-pointer shadow-2xs text-[11px]"
                  >
                    <span className="hidden sm:inline">Próximo</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN - Rounded Columns and Cards with Advance, Retroact and Drag-and-Drop */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1600px]">
            {kanbanPipeline.map((col) => {
              const colOrders = sortedOrders.filter(o => col.statuses.includes(o.status_operacional));
              const isDragOver = dragOverColId === col.id;

              return (
                <div 
                  key={col.id} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColId !== col.id) setDragOverColId(col.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverColId === col.id) setDragOverColId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColId(null);
                    const droppedOrderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
                    if (!droppedOrderId) return;
                    const order = orders.find(o => o.id === droppedOrderId);
                    if (!order) return;
                    if (col.statuses.includes(order.status_operacional)) return;

                    const targetStatus = col.statuses[0];
                    const currentIdx = kanbanPipeline.findIndex(c => c.statuses.includes(order.status_operacional));
                    const targetIdx = kanbanPipeline.findIndex(c => c.id === col.id);
                    const isBackwards = targetIdx < currentIdx;

                    updateOperationalStatus(
                      order.id, 
                      targetStatus, 
                      currentUser, 
                      isBackwards ? `Retrocesso Kanban para ${targetStatus}` : `Avanço Kanban para ${targetStatus}`
                    );
                    showToast(
                      isBackwards ? 'info' : 'success', 
                      `${order.codigo} ${isBackwards ? 'retroagido' : 'avançado'}`, 
                      `Movido para a coluna: ${col.title}`
                    );
                    setDraggedOrderId(null);
                  }}
                  className={`w-80 shrink-0 rounded-3xl p-3 border flex flex-col max-h-[78vh] transition-all duration-150 ${
                    isDragOver 
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-300 shadow-md' 
                      : 'bg-slate-100/75 border-slate-200/90'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotColor}`} />
                      <span className="text-xs font-bold text-slate-800 truncate" title={col.title}>
                        {col.title}
                      </span>
                    </div>
                    <span className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full font-bold border shadow-2xs shrink-0 ${col.badgeBg} ${col.badgeText}`}>
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards Scroll Container */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {colOrders.map((order, idx) => {
                      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
                      const { situation, label, targetDate } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);
                      const isBeingDragged = draggedOrderId === order.id;

                      return (
                        <div
                          key={`${order.id}-${idx}`}
                          draggable={currentUser.role !== 'VIEWER'}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', order.id);
                            setDraggedOrderId(order.id);
                          }}
                          onDragEnd={() => {
                            setDraggedOrderId(null);
                            setDragOverColId(null);
                          }}
                          className={`bg-white p-3.5 rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all duration-150 cursor-pointer group ${
                            isBeingDragged ? 'opacity-40 scale-95 border-dashed border-blue-500' : ''
                          }`}
                          onClick={() => onSelectOrder(order)}
                        >
                          {/* Top Row: Code + Origin + Type Tag */}
                          <div className="flex items-center justify-between gap-1.5 mb-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-xs font-bold text-blue-700 group-hover:underline truncate">
                                {order.codigo}
                              </span>
                              {order.origem === 'MANUAL' && (
                                <span className="text-[9px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200 shrink-0">
                                  MANUAL
                                </span>
                              )}
                            </div>
                            <TypeTag type={order.tipo} />
                          </div>

                          {/* Unit & Program Row */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {order.unidade}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 truncate max-w-[125px] font-medium bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                              {order.programa}
                            </span>
                          </div>

                          {/* Metrics Sub-Card: Itens and Date */}
                          <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/80 rounded-xl border border-slate-100 mb-2.5 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono font-bold text-slate-800">{order.quantidade_itens}</span>
                              <span className="text-slate-400 text-[10px]">itens</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 text-slate-500 font-mono text-[10px]">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{formatShortDate(order.data_inicio || order.data_solicitacao || order.criado_em)}</span>
                            </div>
                          </div>

                          {/* SLA / Deadline Row */}
                          <div className="flex items-center justify-between text-[11px] mb-3">
                            <DeadlineBadge situation={situation} label={label} />
                            {targetDate && situation !== 'Fora do cronograma' && (
                              <span className="text-[10px] font-mono text-slate-400">
                                Prazo: {formatShortDate(targetDate)}
                              </span>
                            )}
                          </div>

                          {/* Card Footer: Balanced Action Buttons Bar */}
                          {currentUser.role !== 'VIEWER' && (col.retroactTo || col.advanceTo) && (
                            <div 
                              className="pt-2.5 border-t border-slate-100 flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Botão Retroagir / Voltar */}
                              {col.retroactTo && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prevSt = col.retroactTo!;
                                    updateOperationalStatus(
                                      order.id, 
                                      prevSt, 
                                      currentUser, 
                                      `Retrocesso Kanban para ${prevSt}`
                                    );
                                    showToast('info', `${order.codigo} retroagido`, `Retornado para: ${prevSt}`);
                                  }}
                                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-600 bg-slate-100/90 hover:bg-amber-50 hover:text-amber-800 border border-slate-200/90 hover:border-amber-300 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                    col.advanceTo ? 'flex-1' : 'w-full'
                                  }`}
                                  title={`Retroagir para: ${col.retroactTo}`}
                                >
                                  <ArrowLeft className="w-3 h-3 text-slate-400" />
                                  <span>Voltar</span>
                                </button>
                              )}

                              {/* Botão Avançar */}
                              {col.advanceTo && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextSt = col.advanceTo!;
                                    updateOperationalStatus(
                                      order.id, 
                                      nextSt, 
                                      currentUser, 
                                      `Avanço Kanban para ${nextSt}`
                                    );
                                    showToast('success', `${order.codigo} avançado`, `Avançou para: ${nextSt}`);
                                  }}
                                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                    col.retroactTo ? 'flex-1' : 'w-full'
                                  }`}
                                  title={`Avançar para: ${col.advanceTo}`}
                                >
                                  <span>Avançar</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {colOrders.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-400 italic bg-white/40 rounded-2xl border border-dashed border-slate-200">
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
          ordersProp={filteredOrders}
          selectedUnitsProp={selectedUnits}
          selectedOrderTypesProp={selectedTypes}
          searchTermProp={searchTerm}
        />
      )}
    </div>
  );
};
