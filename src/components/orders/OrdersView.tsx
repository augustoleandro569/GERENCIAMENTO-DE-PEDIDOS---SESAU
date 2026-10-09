import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, OrderStatus, Priority, RequestType, DeadlineSituation } from '../../types';
import { calculateDeadlineSituation, formatDate, formatShortDate, getSeparationAlertInfo } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge, PriorityBadge, InlineStatusSelect, ALL_STATUSES } from '../common/StatusBadge';
import { showToast } from '../common/Toast';
import { exportOrdersToSpreadsheet } from '../../utils/spreadsheet';
import { MultiSelect } from '../common/MultiSelect';
import { 
  Table, 
  Kanban, 
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
  CalendarDays,
  AlertTriangle,
  Flame,
  CheckCircle2
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
  const { orders, schedules, units, programs, orderTypes, currentUser, updateOperationalStatus, updateOrders, settings } = useStore();

  // View mode
  const [viewMode, setViewMode] = useState<'tabela' | 'kanban'>('tabela');

  // Search & Multi-Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>(initialFilter?.unidade ? [initialFilter.unidade] : []);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialFilter?.tipo ? [initialFilter.tipo] : []);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialFilter?.status ? [initialFilter.status] : []);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState<string>('ALL');

  // Synchronize when initialFilter changes from parent
  React.useEffect(() => {
    if (initialFilter?.status) {
      setSelectedStatuses([initialFilter.status]);
      setCurrentPage(1);
    }
  }, [initialFilter?.status]);

  React.useEffect(() => {
    if (initialFilter?.unidade) {
      setSelectedUnits([initialFilter.unidade]);
      setCurrentPage(1);
    }
  }, [initialFilter?.unidade]);

  React.useEffect(() => {
    if (initialFilter?.tipo) {
      setSelectedTypes([initialFilter.tipo]);
      setCurrentPage(1);
    }
  }, [initialFilter?.tipo]);

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

  // ALL 14 OPERATIONAL STATUSES - COMPLETE SEPARATION, NO UNIFICATION (Não unifique!)
  const ALL_OPERATIONAL_STATUSES = useMemo(() => [
    { status: 'Rascunho' as OrderStatus, label: 'Rascunho', dotColor: 'bg-slate-400', badgeBg: 'bg-slate-50', badgeText: 'text-slate-700', borderColor: 'border-slate-300' },
    { status: 'Aguardando Validação' as OrderStatus, label: 'Aguardando Validação', dotColor: 'bg-amber-400', badgeBg: 'bg-amber-50', badgeText: 'text-amber-800', borderColor: 'border-amber-300' },
    { status: 'Aguardando Aprovação' as OrderStatus, label: 'Aguardando Aprovação', dotColor: 'bg-amber-500', badgeBg: 'bg-amber-50', badgeText: 'text-amber-900', borderColor: 'border-amber-400' },
    { status: 'Aprovada' as OrderStatus, label: 'Aprovados', dotColor: 'bg-blue-500', badgeBg: 'bg-blue-50', badgeText: 'text-blue-800', borderColor: 'border-blue-300' },
    { status: 'Aguardando Separação' as OrderStatus, label: 'Aguardando Separação', dotColor: 'bg-indigo-500', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-800', borderColor: 'border-indigo-300' },
    { status: 'Em Separação' as OrderStatus, label: 'Em Separação', dotColor: 'bg-purple-500', badgeBg: 'bg-purple-50', badgeText: 'text-purple-800', borderColor: 'border-purple-300' },
    { status: 'Aguardando Conferência' as OrderStatus, label: 'Aguardando Conferência', dotColor: 'bg-violet-500', badgeBg: 'bg-violet-50', badgeText: 'text-violet-800', borderColor: 'border-violet-300' },
    { status: 'Em Conferência' as OrderStatus, label: 'Em Conferência', dotColor: 'bg-teal-500', badgeBg: 'bg-teal-50', badgeText: 'text-teal-800', borderColor: 'border-teal-300' },
    { status: 'Expedida' as OrderStatus, label: 'Expedida', dotColor: 'bg-cyan-500', badgeBg: 'bg-cyan-50', badgeText: 'text-cyan-800', borderColor: 'border-cyan-300' },
    { status: 'Em Transporte' as OrderStatus, label: 'Em Transporte', dotColor: 'bg-orange-500', badgeBg: 'bg-orange-50', badgeText: 'text-orange-800', borderColor: 'border-orange-300' },
    { status: 'Entregue Parcialmente' as OrderStatus, label: 'Entrega Parcial', dotColor: 'bg-lime-500', badgeBg: 'bg-lime-50', badgeText: 'text-lime-800', borderColor: 'border-lime-300' },
    { status: 'Entregue' as OrderStatus, label: 'Entregue', dotColor: 'bg-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-800', borderColor: 'border-emerald-300' },
    { status: 'Rejeitada' as OrderStatus, label: 'Rejeitada', dotColor: 'bg-rose-500', badgeBg: 'bg-rose-50', badgeText: 'text-rose-800', borderColor: 'border-rose-300' },
    { status: 'Cancelada' as OrderStatus, label: 'Cancelada', dotColor: 'bg-neutral-500', badgeBg: 'bg-neutral-100', badgeText: 'text-neutral-700', borderColor: 'border-neutral-300' },
  ], []);

  // Individual non-unified counts for every state
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_OPERATIONAL_STATUSES.forEach(s => {
      counts[s.status] = 0;
    });

    orders.forEach(o => {
      const st = o.status_operacional;
      if (st === 'Aprovado') {
        counts['Aprovada'] = (counts['Aprovada'] || 0) + 1;
      } else if (st === 'Cancelado') {
        counts['Cancelada'] = (counts['Cancelada'] || 0) + 1;
      } else if (counts[st] !== undefined) {
        counts[st]++;
      } else {
        counts[st] = 1;
      }
    });

    return counts;
  }, [orders, ALL_OPERATIONAL_STATUSES]);

  // SLA & urgency counts
  const slaCounts = useMemo(() => {
    let noPrazo = 0;
    let foraDoPrazo = 0;
    let emergencial = 0;

    orders.forEach(o => {
      if (o.tipo === 'Emergencial' || o.tipo === 'Falta') emergencial++;

      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(o, sch, settings.horas_alerta_atencao);
      if (situation === 'Dentro do prazo' || situation === 'Concluído no prazo') noPrazo++;
      if (situation === 'Atrasado' || situation === 'Concluído com atraso') foraDoPrazo++;
    });

    return {
      todos: orders.length,
      noPrazo,
      foraDoPrazo,
      emergencial,
    };
  }, [orders, schedulesMap, settings.horas_alerta_atencao]);

  const [isAlertBannerVisible, setIsAlertBannerVisible] = useState(true);

  // Separation alert map (calculates 5-business-day picking deadline for every order)
  const separationAlertsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSeparationAlertInfo>>();
    orders.forEach(o => {
      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      map.set(o.id, getSeparationAlertInfo(o, sch));
    });
    return map;
  }, [orders, schedulesMap]);

  // Orders in Critical or Alert state (separation not started within 5 business days of delivery)
  const separationAlertOrders = useMemo(() => {
    return orders.filter(o => {
      const alert = separationAlertsMap.get(o.id);
      return alert && (alert.severity === 'CRITICO' || alert.severity === 'ALERTA');
    });
  }, [orders, separationAlertsMap]);

  // Filtered orders with Multi-Select support & Non-Unified Statuses
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(order, sch, settings.horas_alerta_atencao);
      const separationAlert = separationAlertsMap.get(order.id);

      // Multi-quick-filter check: exact non-unified match
      if (selectedQuickFilters.length > 0) {
        const matchesAnyQuickFilter = selectedQuickFilters.some(qf => {
          if (qf === 'NO_PRAZO') return situation === 'Dentro do prazo' || situation === 'Concluído no prazo';
          if (qf === 'FORA_DO_PRAZO') return situation === 'Atrasado' || situation === 'Concluído com atraso';
          if (qf === 'EMERGENCIAL') return order.tipo === 'Emergencial' || order.tipo === 'Falta';
          if (qf === 'ALERTA_SEPARACAO') return separationAlert && (separationAlert.severity === 'CRITICO' || separationAlert.severity === 'ALERTA');
          if (qf.startsWith('STATUS:')) {
            const targetStatus = qf.replace('STATUS:', '');
            if (targetStatus === 'Aprovada') {
              return order.status_operacional === 'Aprovada' || order.status_operacional === 'Aprovado';
            }
            if (targetStatus === 'Cancelada') {
              return order.status_operacional === 'Cancelada' || order.status_operacional === 'Cancelado';
            }
            return order.status_operacional === targetStatus;
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

      // Multi-select Statuses: support both exact and gender aliases (Aprovada/Aprovado, Cancelada/Cancelado)
      if (selectedStatuses.length > 0) {
        const matchesStatus = selectedStatuses.some(st => {
          if (st === 'Aprovada') return order.status_operacional === 'Aprovada' || order.status_operacional === 'Aprovado';
          if (st === 'Cancelada') return order.status_operacional === 'Cancelada' || order.status_operacional === 'Cancelado';
          return order.status_operacional === st;
        });
        if (!matchesStatus) return false;
      }

      // Filter by Schedule / Vínculo
      if (selectedScheduleFilter !== 'ALL') {
        if (selectedScheduleFilter === 'SEM_CRONOGRAMA') {
          if (order.cronograma_id) return false;
        } else if (selectedScheduleFilter === 'COM_CRONOGRAMA') {
          if (!order.cronograma_id) return false;
        } else {
          if (order.cronograma_id !== selectedScheduleFilter) return false;
        }
      }

      return true;
    });
  }, [orders, selectedQuickFilters, searchTerm, selectedUnits, selectedPrograms, selectedTypes, selectedStatuses, selectedScheduleFilter, schedulesMap, settings.horas_alerta_atencao]);

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
    setSelectedStatuses([]);
    setSelectedQuickFilters([]);
    setSelectedScheduleFilter('ALL');
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
      id: 'col-rascunho',
      title: 'Rascunho',
      statuses: ['Rascunho'],
      advanceTo: 'Aguardando Validação',
      headerBorder: 'border-slate-300',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-800',
      dotColor: 'bg-slate-500',
    },
    {
      id: 'col-validacao',
      title: 'Aguardando Validação',
      statuses: ['Aguardando Validação'],
      advanceTo: 'Aguardando Aprovação',
      retroactTo: 'Rascunho',
      headerBorder: 'border-amber-300',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-800',
      dotColor: 'bg-amber-400',
    },
    {
      id: 'col-aprovacao',
      title: 'Aguardando Aprovação',
      statuses: ['Aguardando Aprovação'],
      advanceTo: 'Aprovada',
      retroactTo: 'Aguardando Validação',
      headerBorder: 'border-amber-400',
      badgeBg: 'bg-amber-100 border-amber-400',
      badgeText: 'text-amber-900',
      dotColor: 'bg-amber-500',
    },
    {
      id: 'col-aprovada',
      title: 'Aprovados',
      statuses: ['Aprovada', 'Aprovado'],
      advanceTo: 'Aguardando Separação',
      retroactTo: 'Aguardando Aprovação',
      headerBorder: 'border-blue-300',
      badgeBg: 'bg-blue-100 border-blue-300',
      badgeText: 'text-blue-800',
      dotColor: 'bg-blue-500',
    },
    {
      id: 'col-aguardando-separacao',
      title: 'Aguardando Separação',
      statuses: ['Aguardando Separação'],
      advanceTo: 'Em Separação',
      retroactTo: 'Aprovada',
      headerBorder: 'border-indigo-300',
      badgeBg: 'bg-indigo-100 border-indigo-300',
      badgeText: 'text-indigo-800',
      dotColor: 'bg-indigo-500',
    },
    {
      id: 'col-separacao',
      title: 'Em Separação',
      statuses: ['Em Separação'],
      advanceTo: 'Aguardando Conferência',
      retroactTo: 'Aguardando Separação',
      headerBorder: 'border-purple-300',
      badgeBg: 'bg-purple-100 border-purple-300',
      badgeText: 'text-purple-800',
      dotColor: 'bg-purple-500',
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
      id: 'col-parcial',
      title: 'Entrega Parcial',
      statuses: ['Entregue Parcialmente'],
      advanceTo: 'Entregue',
      retroactTo: 'Em Transporte',
      headerBorder: 'border-lime-300',
      badgeBg: 'bg-lime-100 border-lime-300',
      badgeText: 'text-lime-800',
      dotColor: 'bg-lime-500',
    },
    {
      id: 'col-entregue',
      title: 'Entregue',
      statuses: ['Entregue'],
      retroactTo: 'Em Transporte',
      headerBorder: 'border-emerald-300',
      badgeBg: 'bg-emerald-100 border-emerald-300',
      badgeText: 'text-emerald-800',
      dotColor: 'bg-emerald-500',
    },
    {
      id: 'col-rejeitada',
      title: 'Rejeitada',
      statuses: ['Rejeitada'],
      retroactTo: 'Aguardando Validação',
      headerBorder: 'border-rose-300',
      badgeBg: 'bg-rose-100 border-rose-300',
      badgeText: 'text-rose-800',
      dotColor: 'bg-rose-500',
    },
    {
      id: 'col-cancelada',
      title: 'Cancelada',
      statuses: ['Cancelada', 'Cancelado'],
      retroactTo: 'Rascunho',
      headerBorder: 'border-red-400',
      badgeBg: 'bg-red-100 border-red-300',
      badgeText: 'text-red-900',
      dotColor: 'bg-red-700',
    },
  ];

  return (
    <div className="space-y-4">
      {/* INTERACTIVE SEPARATION ALERT BANNER (5 DIAS ÚTEIS ANTES DA ENTREGA) */}
      {isAlertBannerVisible && separationAlertOrders.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-xl shadow-inner">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  Controle de Alerta de Separação: {separationAlertOrders.length} pedido{separationAlertOrders.length > 1 ? 's' : ''} em risco
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-white/25 text-white border border-white/40">
                  Prazo de 5 Dias Úteis
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5 max-w-2xl leading-relaxed">
                Estes pedidos estão a 5 dias úteis ou menos da data prevista de entrega e a separação ainda <strong>não foi iniciada</strong>. Inicie agora para evitar atrasos na expedição.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => {
                setSelectedQuickFilters(prev => prev.includes('ALERTA_SEPARACAO') ? prev : [...prev, 'ALERTA_SEPARACAO']);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-white text-rose-700 hover:bg-rose-50 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Filtrar {separationAlertOrders.length} em Risco
            </button>
            {currentUser.role !== 'VIEWER' && (
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  separationAlertOrders.forEach(ord => {
                    updateOperationalStatus(ord.id, 'Em Separação', currentUser, 'Separação iniciada em lote via Alerta de 5 dias úteis');
                    updateOrder(ord.id, {
                      separador: currentUser.nome,
                      separado_em: `${today} ${timeNow}`,
                      data_inicio_separacao: ord.data_inicio_separacao || today,
                    }, currentUser, 'Início de separação em lote');
                  });
                  showToast('success', 'Separação Iniciada em Lote', `${separationAlertOrders.length} pedidos colocados em separação.`);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-rose-950/40 hover:bg-rose-950/60 text-white border border-white/30 rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                title="Iniciar separação de todos os pedidos com alerta pendente"
              >
                ⚡ Iniciar Todos
              </button>
            )}
            <button
              onClick={() => setIsAlertBannerVisible(false)}
              className="p-1.5 text-rose-200 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              title="Ocultar banner de alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Consolidated Top Control & Filtering Center - relative z-30 and overflow-visible so dropdowns overlay the table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs relative z-30 divide-y divide-slate-100">
        {/* Tier 1: View Header, Mode Switcher & Export */}
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-t-2xl">
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
            {/* Segmented View Switcher: Tabela & Kanban */}
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

            {/* Novo Pedido Action Button */}
            <button
              onClick={onOpenNewOrder}
              disabled={currentUser.role === 'VIEWER'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer whitespace-nowrap border border-blue-700 disabled:opacity-50 disabled:pointer-events-none"
              title="Registrar Novo Pedido Manual (Falta / Emergencial / Extraordinário)"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span>Novo Pedido</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Search Input & Multi-Select Dropdowns - Balanced Grid Distribution */}
        <div className="p-3.5 bg-slate-50/70 space-y-3 relative z-30 overflow-visible border-b border-slate-200/60">
          {/* Row 1: Search, Cronograma Scope Selector & Global Actions */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
            {/* Search Input */}
            <div className="col-span-1 md:col-span-6 lg:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por código (ex: SOL-2026-03074), unidade, solicitante ou CPF..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-400 font-medium shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Cronograma Scope Filter */}
            <div className="col-span-1 md:col-span-4 lg:col-span-4">
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <select
                  value={selectedScheduleFilter}
                  onChange={(e) => { setSelectedScheduleFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer truncate"
                  title="Filtrar por cronograma ou pedidos pendentes de vínculo"
                >
                  <option value="ALL">🌐 Todos os Cronogramas</option>
                  <option value="SEM_CRONOGRAMA">⚠️ Pedidos Sem Cronograma (Pendentes)</option>
                  <option value="COM_CRONOGRAMA">🔗 Pedidos Vinculados a Cronogramas</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.competencia} · Entrega {formatShortDate(s.data_entrega)})
                    </option>
                  ))}
                </select>
                {selectedScheduleFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => { setSelectedScheduleFilter('ALL'); setCurrentPage(1); }}
                    className="text-[10px] text-blue-700 hover:text-rose-600 font-bold px-1"
                    title="Limpar filtro de cronograma"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions & Filter Counters */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 flex items-center justify-between md:justify-end gap-2">
              {(selectedUnits.length > 0 || selectedPrograms.length > 0 || selectedTypes.length > 0 || selectedStatuses.length > 0 || selectedQuickFilters.length > 0 || selectedScheduleFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-rose-700 hover:text-rose-900 font-bold px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap"
                  title="Limpar todos os filtros ativos"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
              <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-2 rounded-xl border border-blue-200 shadow-2xs whitespace-nowrap text-center">
                {filteredOrders.length} de {orders.length}
              </span>
            </div>
          </div>

          {/* Row 2: 4 Evenly Distributed MultiSelect Dropdowns (Each 25% on desktop, 50% on mobile) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 relative z-30">
            {/* Multi-Select Unidades */}
            <div className="col-span-1">
              <MultiSelect
                options={units.map(u => ({ id: u.sigla, label: u.sigla, subLabel: u.nome }))}
                selected={selectedUnits}
                onChange={(next) => { setSelectedUnits(next); setCurrentPage(1); }}
                placeholder="Todas as Unidades"
                className="w-full"
                showSearch={true}
                align="left"
              />
            </div>

            {/* Multi-Select Programas */}
            <div className="col-span-1">
              <MultiSelect
                options={programs.map(p => ({ id: p.nome, label: p.nome }))}
                selected={selectedPrograms}
                onChange={(next) => { setSelectedPrograms(next); setCurrentPage(1); }}
                placeholder="Todos os Programas"
                className="w-full"
                align="left"
              />
            </div>

            {/* Multi-Select Tipos */}
            <div className="col-span-1">
              <MultiSelect
                options={orderTypes.map(t => ({ id: t.nome, label: t.nome, color: t.cor }))}
                selected={selectedTypes}
                onChange={(next) => { setSelectedTypes(next); setCurrentPage(1); }}
                placeholder="Todos os Tipos"
                className="w-full"
                align="right"
              />
            </div>

            {/* Multi-Select Status Operacional: All 14 states */}
            <div className="col-span-1">
              <MultiSelect
                options={ALL_OPERATIONAL_STATUSES.map(s => ({
                  id: s.status,
                  label: s.label,
                  count: statusCounts[s.status] || 0,
                }))}
                selected={selectedStatuses}
                onChange={(next) => { setSelectedStatuses(next); setCurrentPage(1); }}
                placeholder="Todos os Status"
                className="w-full"
                align="right"
              />
            </div>
          </div>
        </div>

        {/* Tier 3: Directed Status Ribbon with ALL 14 states divided individually (Não unifique!) */}
        <div className="px-4 py-2.5 bg-white flex items-center gap-2 overflow-x-auto text-xs scrollbar-thin rounded-b-2xl">
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
              {slaCounts.todos}
            </span>
          </button>

          {/* SLA Filters */}
          <button
            onClick={() => {
              setSelectedQuickFilters(prev => prev.includes('NO_PRAZO') ? prev.filter(c => c !== 'NO_PRAZO') : [...prev, 'NO_PRAZO']);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs ${
              selectedQuickFilters.includes('NO_PRAZO')
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>🟢 No Prazo</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              selectedQuickFilters.includes('NO_PRAZO') ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {slaCounts.noPrazo}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedQuickFilters(prev => prev.includes('FORA_DO_PRAZO') ? prev.filter(c => c !== 'FORA_DO_PRAZO') : [...prev, 'FORA_DO_PRAZO']);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs ${
              selectedQuickFilters.includes('FORA_DO_PRAZO')
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <AlertCircle className={`w-3.5 h-3.5 ${selectedQuickFilters.includes('FORA_DO_PRAZO') ? 'text-white' : 'text-red-500'}`} />
            <span>Fora do Prazo</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              selectedQuickFilters.includes('FORA_DO_PRAZO') ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {slaCounts.foraDoPrazo}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedQuickFilters(prev => prev.includes('EMERGENCIAL') ? prev.filter(c => c !== 'EMERGENCIAL') : [...prev, 'EMERGENCIAL']);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs ${
              selectedQuickFilters.includes('EMERGENCIAL')
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping mr-0.5" />
            <span>Emergenciais / Falta</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              selectedQuickFilters.includes('EMERGENCIAL') ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {slaCounts.emergencial}
            </span>
          </button>

          {/* Interactive 5-Business-Day Separation Alert Pill */}
          <button
            onClick={() => {
              setSelectedQuickFilters(prev => prev.includes('ALERTA_SEPARACAO') ? prev.filter(c => c !== 'ALERTA_SEPARACAO') : [...prev, 'ALERTA_SEPARACAO']);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs border ${
              selectedQuickFilters.includes('ALERTA_SEPARACAO')
                ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                : separationAlertOrders.length > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 shadow-2xs'
                : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200 hover:text-slate-900'
            }`}
            title="Filtrar pedidos a 5 dias úteis ou menos da entrega cuja separação ainda não foi iniciada"
          >
            <span className={separationAlertOrders.length > 0 ? 'text-xs' : ''}>🚨</span>
            <span>Alerta Separação (5d úteis)</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              selectedQuickFilters.includes('ALERTA_SEPARACAO')
                ? 'bg-white/20 text-white'
                : separationAlertOrders.length > 0
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {separationAlertOrders.length}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-200 shrink-0 mx-1" />

          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Estados:
          </span>

          {/* ALL 14 OPERATIONAL STATUSES - EACH ONE INDIVIDUALLY (NÃO UNIFIQUE!) */}
          {ALL_OPERATIONAL_STATUSES.map(item => {
            const chipId = `STATUS:${item.status}`;
            const isSelected = selectedQuickFilters.includes(chipId);
            const count = statusCounts[item.status] || 0;

            const handleToggle = () => {
              if (isSelected) {
                setSelectedQuickFilters(prev => prev.filter(c => c !== chipId));
              } else {
                setSelectedQuickFilters(prev => [...prev, chipId]);
              }
              setCurrentPage(1);
            };

            return (
              <button
                key={item.status}
                onClick={handleToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 text-xs border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/90'
                }`}
                title={`Filtrar somente pedidos com status: ${item.label}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white' : item.dotColor}`} />
                <span>{item.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INTERACTIVE TOP SEPARATION ALERT BANNER (5 DIAS ÚTEIS) */}
      {separationAlertOrders.length > 0 && isAlertBannerVisible && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-300 rounded-2xl p-4 shadow-xs relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs animate-pulse">
                🚨
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                    Alerta de Expedição: {separationAlertOrders.length} {separationAlertOrders.length === 1 ? 'Demanda com Separação Pendente' : 'Demandas com Separação Pendente'}
                  </h4>
                  <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full border border-rose-300">
                    Regra: 5 Dias Úteis
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-snug">
                  Pedidos que atingiram ou ultrapassaram o prazo de 5 dias úteis antes da data de entrega e <strong>ainda não foram iniciados</strong> no almoxarifado. Inicie a separação para prevenir atrasos na expedição hospitalar!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
              <button
                onClick={() => {
                  setSelectedQuickFilters(['ALERTA_SEPARACAO']);
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <span>Ver {separationAlertOrders.length} Pedidos Críticos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {currentUser.role !== 'VIEWER' && (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const alertIds = separationAlertOrders.map(o => o.id);
                    updateOrders(
                      alertIds,
                      {
                        status_operacional: 'Em Separação',
                        separador: currentUser.nome,
                        separado_em: `${today} ${timeNow}`,
                      },
                      currentUser,
                      `Início de separação em lote via alerta de 5 dias úteis por ${currentUser.nome}`
                    );
                    showToast('success', `${alertIds.length} Pedidos em Separação`, 'Status operacional atualizado com sucesso.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-900 border border-rose-300 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  title="Colocar todos os pedidos pendentes em 'Em Separação' com 1 clique"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Iniciar Todas em Separação</span>
                </button>
              )}

              <button
                onClick={() => setIsAlertBannerVisible(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-rose-100 flex items-center justify-center text-xs transition-colors cursor-pointer"
                title="Dispensar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: REFINED INTERACTIVE TABELA - relative z-10 so filters above overlay it */}
      {viewMode === 'tabela' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs relative z-10">
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
                    const separationAlert = separationAlertsMap.get(order.id);
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
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-500 font-medium">
                                {formatShortDate(targetDate)}
                              </span>
                              <DeadlineBadge situation={situation} label={label} />
                            </div>
                            {separationAlert && (separationAlert.severity === 'CRITICO' || separationAlert.severity === 'ALERTA') && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
                                  separationAlert.severity === 'CRITICO' 
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}>
                                  {separationAlert.severity === 'CRITICO' ? '🚨' : '⚠️'} {separationAlert.badgeLabel}
                                </span>
                                {currentUser.role !== 'VIEWER' && !separationAlert.isStarted && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const today = new Date().toISOString().split('T')[0];
                                      const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                      updateOperationalStatus(order.id, 'Em Separação', currentUser, 'Separação iniciada via alerta rápido da tabela');
                                      updateOrder(order.id, {
                                        separador: currentUser.nome,
                                        separado_em: `${today} ${timeNow}`,
                                        data_inicio_separacao: order.data_inicio_separacao || today,
                                      }, currentUser, 'Registro de início de separação');
                                      showToast('success', `${order.codigo} em separação`, 'Demanda iniciada.');
                                    }}
                                    className="text-[9px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                                    title="Iniciar separação agora"
                                  >
                                    ⚡ Iniciar
                                  </button>
                                )}
                              </div>
                            )}
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
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
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
          <div className="flex gap-4 min-w-[4200px]">
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
                          <div className="flex items-center justify-between text-[11px] mb-2.5">
                            <DeadlineBadge situation={situation} label={label} />
                            {targetDate && situation !== 'Fora do cronograma' && (
                              <span className="text-[10px] font-mono text-slate-400">
                                Prazo: {formatShortDate(targetDate)}
                              </span>
                            )}
                          </div>

                          {/* Separation Alert Warning if critical or alert */}
                          {(() => {
                            const sepAlert = separationAlertsMap.get(order.id);
                            if (!sepAlert || (sepAlert.severity !== 'CRITICO' && sepAlert.severity !== 'ALERTA')) return null;
                            return (
                              <div className="mb-2.5 p-1.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-rose-800 flex items-center gap-1">
                                  <span>🚨</span>
                                  <span>{sepAlert.badgeLabel}</span>
                                </span>
                                <span className="text-[9px] text-rose-600 font-semibold font-mono">
                                  {sepAlert.businessDaysRemaining}d úteis p/ entrega
                                </span>
                              </div>
                            );
                          })()}

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

    </div>
  );
};
