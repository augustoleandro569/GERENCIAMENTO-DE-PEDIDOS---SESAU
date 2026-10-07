import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Schedule, Order } from '../../types';
import { formatDate, formatShortDate, parseDateSafe, calculateDeadlineSituation } from '../../utils/dateUtils';
import { UnifiedCalendar } from './UnifiedCalendar';
import { DayOrdersModal } from './DayOrdersModal';
import { ScheduleOrdersModal } from './ScheduleOrdersModal';
import { ScheduleReportTab } from './ScheduleReportTab';
import { BatchLinkOrdersModal } from './BatchLinkOrdersModal';
import { MultiSelect } from '../common/MultiSelect';
import { showToast } from '../common/Toast';
import { 
  Calendar as CalendarIcon, 
  BarChart2, 
  List, 
  Plus, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Truck, 
  Boxes, 
  Building2, 
  X, 
  Edit2, 
  Trash2,
  CalendarCheck,
  TrendingUp,
  Filter,
  Check,
  Search,
  Layers,
  CalendarPlus,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Send,
  CalendarDays,
  SlidersHorizontal,
  Link2
} from 'lucide-react';

export type ScheduleDateSortField = 'data_entrega' | 'data_expedicao' | 'data_separacao' | 'data_limite_aprovacao' | 'data_limite_solicitacao';

export const DATE_SORT_OPTIONS: { id: ScheduleDateSortField; label: string; shortLabel: string }[] = [
  { id: 'data_entrega', label: '🚚 5. Entrega no Hospital (Padrão)', shortLabel: 'Entrega' },
  { id: 'data_expedicao', label: '🚛 4. Expedição / Trânsito', shortLabel: 'Expedição' },
  { id: 'data_separacao', label: '📦 3. Início da Separação', shortLabel: 'Separação' },
  { id: 'data_limite_aprovacao', label: '✅ 2. Limite de Aprovação', shortLabel: 'Aprovação' },
  { id: 'data_limite_solicitacao', label: '📝 1. Limite de Solicitação', shortLabel: 'Solicitação' },
];

export type ScheduleDateFilterPreset = 'TODOS' | 'HOJE' | 'PROXIMOS_7' | 'PROXIMOS_15' | 'ESTE_MES' | 'PROXIMO_MES';

export const DATE_FILTER_PRESET_OPTIONS: { id: ScheduleDateFilterPreset; label: string }[] = [
  { id: 'TODOS', label: '🌐 Todas as Datas' },
  { id: 'HOJE', label: '⚡ Hoje' },
  { id: 'PROXIMOS_7', label: '📅 Próximos 7 Dias' },
  { id: 'PROXIMOS_15', label: '📅 Próximos 15 Dias' },
  { id: 'ESTE_MES', label: '🗓️ Este Mês (OUT/26)' },
  { id: 'PROXIMO_MES', label: '🗓️ Próximo Mês (NOV/26)' },
];

interface ScheduleViewProps {
  onSelectOrder?: (order: Order) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onSelectOrder }) => {
  const { schedules, units, programs, orderTypes, orders, addSchedule, addSchedules, updateSchedule, deleteSchedule, runAutoLinking, currentUser, settings } = useStore();

  // Mode: Calendário | Progresso | Lista | Relatório
  const [activeTab, setActiveTab] = useState<'calendario' | 'progresso' | 'lista' | 'relatorio'>('calendario');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [linkingResult, setLinkingResult] = useState<{ linkedCount: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Schedule Orders Modal for SLA & Progress auditing
  const [scheduleOrdersModalConfig, setScheduleOrdersModalConfig] = useState<{
    schedule: Schedule;
    initialFilter?: 'ALL' | 'NO_PRAZO' | 'ATENCAO' | 'FORA_DO_PRAZO';
  } | null>(null);

  // Batch Link Modal state (Permite vincular múltiplos pedidos em uma única ação)
  const [batchLinkScheduleId, setBatchLinkScheduleId] = useState<string | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [competencia, setCompetencia] = useState('OUT/26');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([units[0]?.sigla || 'HGE']);
  const [unitSearch, setUnitSearch] = useState('');
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>('TODOS');
  const [creationMode, setCreationMode] = useState<'UNIFICADO' | 'INDIVIDUAL'>('UNIFICADO');
  const [isTitleManual, setIsTitleManual] = useState(false);
  const [programa, setPrograma] = useState(programs[0]?.nome || 'Hospitalar');
  const [tipoPedido, setTipoPedido] = useState('Mensal');
  const [limiteSolicitacao, setLimiteSolicitacao] = useState('2026-10-05');
  const [limiteAprovacao, setLimiteAprovacao] = useState('2026-10-07');
  const [separacaoPrevista, setSeparacaoPrevista] = useState('2026-10-08');
  const [expedicaoPrevista, setExpedicaoPrevista] = useState('2026-10-09');
  const [entregaPrevista, setEntregaPrevista] = useState('2026-10-10');
  const [observacao, setObservacao] = useState('');

  // Day Orders Modal for direct date clicks in Progresso/Tabela tabs
  const [dayOrdersModalConfig, setDayOrdersModalConfig] = useState<{ day: number; month: number; type?: string } | null>(null);

  // Multi-filtros sincronizados para abas de Progresso e Tabela
  const [filterUnits, setFilterUnits] = useState<string[]>([]);
  const [filterPrograms, setFilterPrograms] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState<string>('ALL');
  const [selectedCompetenciaFilter, setSelectedCompetenciaFilter] = useState<string>('ALL');
  const [searchScheduleTerm, setSearchScheduleTerm] = useState<string>('');
  const [dateSortField, setDateSortField] = useState<ScheduleDateSortField>('data_entrega');
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dateFilterPreset, setDateFilterPreset] = useState<ScheduleDateFilterPreset>('TODOS');

  const handleOpenDayFromDate = (dateStr?: string | null, type?: string) => {
    if (!dateStr) return;
    const clean = dateStr.trim();
    let day = 1;
    let month = 10;
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split(' ')[0].split('-');
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (clean.includes('/')) {
      const parts = clean.split(' ')[0].split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!isNaN(day) && !isNaN(month)) {
      setDayOrdersModalConfig({ day, month, type });
    }
  };

  // Filtered Available Units in Modal
  const filteredAvailableUnits = useMemo(() => {
    return units.filter(u => {
      if (unitTypeFilter !== 'TODOS' && u.tipo !== unitTypeFilter) return false;
      if (unitSearch) {
        const q = unitSearch.toLowerCase().trim();
        const matchesSigla = u.sigla.toLowerCase().includes(q);
        const matchesNome = u.nome.toLowerCase().includes(q);
        const matchesMun = u.municipio?.toLowerCase().includes(q);
        if (!matchesSigla && !matchesNome && !matchesMun) return false;
      }
      return true;
    });
  }, [units, unitTypeFilter, unitSearch]);

  // Helper to calculate prior cycle dates from delivery date
  const calculateCycleDatesForDelivery = (deliveryDateStr: string) => {
    try {
      const parts = deliveryDateStr.split('-');
      if (parts.length !== 3) return null;
      const delivery = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      if (isNaN(delivery.getTime())) return null;

      const subDays = (d: Date, days: number) => {
        const copy = new Date(d);
        copy.setDate(copy.getDate() - days);
        const yr = copy.getFullYear();
        const mo = String(copy.getMonth() + 1).padStart(2, '0');
        const day = String(copy.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${day}`;
      };

      return {
        expedicao: subDays(delivery, 1),
        separacao: subDays(delivery, 2),
        limiteAprovacao: subDays(delivery, 3),
        limiteSolicitacao: subDays(delivery, 5),
      };
    } catch {
      return null;
    }
  };

  // Progress & SLA Calculations for each schedule
  const scheduleProgressList = useMemo(() => {
    const now = new Date();

    return schedules.map(sch => {
      const linkedOrders = orders.filter(o => o.cronograma_id === sch.id);

      const total = linkedOrders.length;
      const delivered = linkedOrders.filter(o => o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente').length;
      const inTransport = linkedOrders.filter(o => o.status_operacional === 'Em Transporte').length;
      const inSeparation = linkedOrders.filter(o => o.status_operacional === 'Em Separação' || o.status_operacional === 'Aguardando Conferência' || o.status_operacional === 'Expedida').length;
      const awaiting = linkedOrders.filter(o => o.status_operacional === 'Aguardando Aprovação' || o.status_operacional === 'Aguardando Validação' || o.status_operacional === 'Rascunho' || o.status_operacional === 'Aprovada' || o.status_operacional === 'Aprovado').length;

      // Calculate SLA: No Prazo, Atenção, Fora do Prazo
      let noPrazo = 0;
      let atencao = 0;
      let foraDoPrazo = 0;

      linkedOrders.forEach(o => {
        const sla = calculateDeadlineSituation(o, sch, settings?.horas_alerta_atencao || 48);
        if (sla.situation === 'Dentro do prazo' || sla.situation === 'Concluído no prazo') {
          noPrazo++;
        } else if (sla.situation === 'Atenção') {
          atencao++;
        } else if (sla.situation === 'Atrasado' || sla.situation === 'Concluído com atraso') {
          foraDoPrazo++;
        }
      });

      // Progress percentage
      let progressPercent = 0;
      if (total > 0) {
        progressPercent = Math.round(((delivered * 1.0 + inTransport * 0.75 + inSeparation * 0.5 + awaiting * 0.2) / total) * 100);
      } else {
        // Milestone/date-based progress if no orders are linked
        const entrega = parseDateSafe(sch.data_entrega);
        const expedicao = parseDateSafe(sch.data_expedicao);
        const separacao = parseDateSafe(sch.data_separacao);
        const aprovacao = parseDateSafe(sch.data_limite_aprovacao);
        const solicitacao = parseDateSafe(sch.data_limite_solicitacao);

        if (entrega && now.getTime() >= entrega.getTime()) progressPercent = 100;
        else if (expedicao && now.getTime() >= expedicao.getTime()) progressPercent = 75;
        else if (separacao && now.getTime() >= separacao.getTime()) progressPercent = 50;
        else if (aprovacao && now.getTime() >= aprovacao.getTime()) progressPercent = 25;
        else if (solicitacao && now.getTime() >= solicitacao.getTime()) progressPercent = 10;
        else progressPercent = 0;
      }

      // Check current stage based on dates
      const entrega = parseDateSafe(sch.data_entrega) || new Date();
      const expedicao = parseDateSafe(sch.data_expedicao) || new Date();
      const separacao = parseDateSafe(sch.data_separacao) || new Date();
      const aprovacao = parseDateSafe(sch.data_limite_aprovacao) || new Date();

      let currentMilestone = 'Solicitação';
      if (now.getTime() > entrega.getTime()) currentMilestone = 'Concluído';
      else if (now.getTime() > expedicao.getTime()) currentMilestone = 'Em Transporte';
      else if (now.getTime() > separacao.getTime()) currentMilestone = 'Em Expedição';
      else if (now.getTime() > aprovacao.getTime()) currentMilestone = 'Em Separação';
      else currentMilestone = 'Aguardando Aprovação';

      return {
        sch,
        total,
        delivered,
        inTransport,
        inSeparation,
        awaiting,
        noPrazo,
        atencao,
        foraDoPrazo,
        taxaNoPrazo: total > 0 ? Math.round((noPrazo / total) * 100) : 100,
        progressPercent: Math.min(100, Math.max(0, progressPercent)),
        currentMilestone,
      };
    });
  }, [schedules, orders, settings]);

  // Competências disponíveis dinâmicas
  const availableCompetencias = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => {
      if (s.competencia) set.add(s.competencia.trim());
    });
    return Array.from(set).sort();
  }, [schedules]);

  // Função comparadora para organização por data
  const compareSchedulesByDate = (a: Schedule, b: Schedule, field: ScheduleDateSortField, order: 'asc' | 'desc') => {
    const parseTime = (dateStr?: string) => {
      if (!dateStr) return 0;
      const parsed = parseDateSafe(dateStr);
      if (parsed) return parsed.getTime();
      const direct = new Date(dateStr).getTime();
      return isNaN(direct) ? 0 : direct;
    };

    const timeA = parseTime(a[field]);
    const timeB = parseTime(b[field]);
    if (timeA === timeB) {
      return a.nome.localeCompare(b.nome);
    }
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  };

  const handleToggleDateSort = (field: ScheduleDateSortField) => {
    if (dateSortField === field) {
      setDateSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDateSortField(field);
      setDateSortOrder('asc');
    }
  };

  // Verificador de período/data para a organização por data
  const matchesDatePreset = (sch: Schedule): boolean => {
    if (dateFilterPreset === 'TODOS') return true;
    const val = sch[dateSortField] || sch.data_entrega;
    if (!val) return false;
    const d = parseDateSafe(val);
    if (!d) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tTime = d.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (dateFilterPreset === 'HOJE') {
      return tTime >= startOfToday && tTime < startOfToday + oneDay;
    }
    if (dateFilterPreset === 'PROXIMOS_7') {
      return tTime >= startOfToday && tTime <= startOfToday + 7 * oneDay;
    }
    if (dateFilterPreset === 'PROXIMOS_15') {
      return tTime >= startOfToday && tTime <= startOfToday + 15 * oneDay;
    }
    if (dateFilterPreset === 'ESTE_MES') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (dateFilterPreset === 'PROXIMO_MES') {
      const nextMonth = (now.getMonth() + 1) % 12;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      return d.getMonth() === nextMonth && d.getFullYear() === nextYear;
    }
    return true;
  };

  // Lista filtrada e organizada por data para a aba "Por Progresso"
  const filteredScheduleProgressList = useMemo(() => {
    const list = scheduleProgressList.filter(({ sch }) => {
      if (selectedScheduleFilter !== 'ALL' && sch.id !== selectedScheduleFilter) return false;
      if (selectedCompetenciaFilter !== 'ALL' && sch.competencia !== selectedCompetenciaFilter) return false;
      if (searchScheduleTerm.trim()) {
        const q = searchScheduleTerm.toLowerCase().trim();
        const matchesNome = sch.nome.toLowerCase().includes(q);
        const matchesUnidade = sch.unidade.toLowerCase().includes(q);
        const matchesProg = sch.programa.toLowerCase().includes(q);
        if (!matchesNome && !matchesUnidade && !matchesProg) return false;
      }
      if (filterUnits.length > 0) {
        const schUnits = sch.unidades && sch.unidades.length > 0
          ? sch.unidades
          : sch.unidade.includes(',')
          ? sch.unidade.split(',').map((s: string) => s.trim())
          : [sch.unidade];
        if (!schUnits.some((u: string) => filterUnits.includes(u))) return false;
      }
      if (filterPrograms.length > 0 && !filterPrograms.includes(sch.programa)) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(sch.tipo_pedido)) return false;
      if (!matchesDatePreset(sch)) return false;
      return true;
    });

    list.sort((a, b) => compareSchedulesByDate(a.sch, b.sch, dateSortField, dateSortOrder));
    return list;
  }, [
    scheduleProgressList,
    selectedScheduleFilter,
    selectedCompetenciaFilter,
    searchScheduleTerm,
    filterUnits,
    filterPrograms,
    filterTypes,
    dateSortField,
    dateSortOrder,
    dateFilterPreset
  ]);

  // Lista filtrada e organizada por data para a aba "Tabela"
  const filteredSchedulesList = useMemo(() => {
    const list = schedules.filter(sch => {
      if (selectedScheduleFilter !== 'ALL' && sch.id !== selectedScheduleFilter) return false;
      if (selectedCompetenciaFilter !== 'ALL' && sch.competencia !== selectedCompetenciaFilter) return false;
      if (searchScheduleTerm.trim()) {
        const q = searchScheduleTerm.toLowerCase().trim();
        const matchesNome = sch.nome.toLowerCase().includes(q);
        const matchesUnidade = sch.unidade.toLowerCase().includes(q);
        const matchesProg = sch.programa.toLowerCase().includes(q);
        if (!matchesNome && !matchesUnidade && !matchesProg) return false;
      }
      if (filterUnits.length > 0) {
        const schUnits = sch.unidades && sch.unidades.length > 0
          ? sch.unidades
          : sch.unidade.includes(',')
          ? sch.unidade.split(',').map((s: string) => s.trim())
          : [sch.unidade];
        if (!schUnits.some((u: string) => filterUnits.includes(u))) return false;
      }
      if (filterPrograms.length > 0 && !filterPrograms.includes(sch.programa)) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(sch.tipo_pedido)) return false;
      if (!matchesDatePreset(sch)) return false;
      return true;
    });

    list.sort((a, b) => compareSchedulesByDate(a, b, dateSortField, dateSortOrder));
    return list;
  }, [
    schedules,
    selectedScheduleFilter,
    selectedCompetenciaFilter,
    searchScheduleTerm,
    filterUnits,
    filterPrograms,
    filterTypes,
    dateSortField,
    dateSortOrder,
    dateFilterPreset
  ]);

  const handleOpenNew = () => {
    setEditingSchedule(null);
    setValidationError(null);
    setCreationMode('UNIFICADO');
    setIsTitleManual(false);
    const initialUnits = selectedUnits.length > 0 ? selectedUnits : [units[0]?.sigla || 'HGE'];
    setSelectedUnits(initialUnits);
    const label = initialUnits.length > 0 ? initialUnits.join(', ') : 'Unidades';
    setNome(`${label} — ${programa} ${tipoPedido} — ${competencia}`);
    setIsModalOpen(true);
  };

  const handleOpenNewForDay = (targetDate: string) => {
    setEditingSchedule(null);
    setValidationError(null);
    setCreationMode('UNIFICADO');
    setIsTitleManual(false);

    setEntregaPrevista(targetDate);
    const cycle = calculateCycleDatesForDelivery(targetDate);
    if (cycle) {
      setExpedicaoPrevista(cycle.expedicao);
      setSeparacaoPrevista(cycle.separacao);
      setLimiteAprovacao(cycle.limiteAprovacao);
      setLimiteSolicitacao(cycle.limiteSolicitacao);
    }

    const parts = targetDate.split('-');
    const month = parts[1];
    const comp = month === '09' ? 'SET/26' : month === '10' ? 'OUT/26' : 'NOV/26';
    setCompetencia(comp);

    const initialUnits = selectedUnits.length > 0 ? selectedUnits : [units[0]?.sigla || 'HGE'];
    setSelectedUnits(initialUnits);
    const label = initialUnits.length > 0 ? initialUnits.join(', ') : 'Unidades';
    setNome(`${label} — ${programa} ${tipoPedido} — ${comp}`);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sch: Schedule) => {
    setEditingSchedule(sch);
    setValidationError(null);
    setIsTitleManual(true);
    setNome(sch.nome);
    setCompetencia(sch.competencia);
    const uList = sch.unidades && sch.unidades.length > 0
      ? sch.unidades
      : sch.unidade.includes(',')
      ? sch.unidade.split(',').map(s => s.trim())
      : [sch.unidade];
    setSelectedUnits(uList);
    setPrograma(sch.programa);
    setTipoPedido(sch.tipo_pedido);
    setLimiteSolicitacao(sch.data_limite_solicitacao);
    setLimiteAprovacao(sch.data_limite_aprovacao);
    setSeparacaoPrevista(sch.data_separacao);
    setExpedicaoPrevista(sch.data_expedicao);
    setEntregaPrevista(sch.data_entrega);
    setObservacao(sch.observacao || '');
    setIsModalOpen(true);
  };

  const toggleUnit = (sigla: string) => {
    setSelectedUnits(prev => {
      const next = prev.includes(sigla) ? prev.filter(u => u !== sigla) : [...prev, sigla];
      if (validationError && next.length > 0) {
        setValidationError(null);
      }
      if (!isTitleManual) {
        const label = next.length > 0 ? next.join(', ') : 'Unidades';
        setNome(`${label} — ${programa} ${tipoPedido} — ${competencia}`);
      }
      return next;
    });
  };

  const handleSelectAllUnits = () => {
    const allSiglas = units.map(u => u.sigla);
    setSelectedUnits(allSiglas);
    setValidationError(null);
    if (!isTitleManual) {
      setNome(`Todas as Unidades (${allSiglas.length}) — ${programa} ${tipoPedido} — ${competencia}`);
    }
  };

  const handleClearUnits = () => {
    setSelectedUnits([]);
    if (!isTitleManual) {
      setNome(`Selecione as Unidades — ${programa} ${tipoPedido} — ${competencia}`);
    }
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnits.length === 0) {
      setValidationError('Selecione ao menos uma unidade para o cronograma.');
      return;
    }

    if (editingSchedule) {
      updateSchedule(editingSchedule.id, {
        nome,
        competencia,
        unidade: selectedUnits.join(', '),
        unidades: selectedUnits,
        programa,
        tipo_pedido: tipoPedido,
        data_limite_solicitacao: limiteSolicitacao,
        data_limite_aprovacao: limiteAprovacao,
        data_separacao: separacaoPrevista,
        data_expedicao: expedicaoPrevista,
        data_entrega: entregaPrevista,
        observacao,
      });
      runAutoLinking();
      showToast('success', 'Cronograma atualizado', `${selectedUnits.length} unidade(s) vinculadas.`);
    } else {
      if (creationMode === 'INDIVIDUAL' && selectedUnits.length > 1) {
        const batch = selectedUnits.map(unitSigla => ({
          nome: `${unitSigla} — ${programa} ${tipoPedido} — ${competencia}`,
          competencia,
          unidade: unitSigla,
          unidades: [unitSigla],
          programa,
          tipo_pedido: tipoPedido,
          data_limite_solicitacao: limiteSolicitacao,
          data_limite_aprovacao: limiteAprovacao,
          data_separacao: separacaoPrevista,
          data_expedicao: expedicaoPrevista,
          data_entrega: entregaPrevista,
          observacao,
          ativo: true,
        }));
        const createdBatch = addSchedules(batch);
        runAutoLinking();
        showToast('success', `${batch.length} Cronogramas criados`, `Registrados individualmente para cada unidade no dia ${formatShortDate(entregaPrevista)}.`);
        if (createdBatch.length > 0) {
          setScheduleOrdersModalConfig({ schedule: createdBatch[0], initialFilter: 'ALL' });
        }
      } else {
        const created = addSchedule({
          nome: nome || `${selectedUnits.join(', ')} — ${programa} — ${competencia}`,
          competencia,
          unidade: selectedUnits.join(', '),
          unidades: selectedUnits,
          programa,
          tipo_pedido: tipoPedido,
          data_limite_solicitacao: limiteSolicitacao,
          data_limite_aprovacao: limiteAprovacao,
          data_separacao: separacaoPrevista,
          data_expedicao: expedicaoPrevista,
          data_entrega: entregaPrevista,
          observacao,
          ativo: true,
        });
        runAutoLinking();
        showToast('success', 'Cronograma criado com sucesso', `${selectedUnits.length} unidade(s) vinculada(s) à data ${formatShortDate(entregaPrevista)}.`);
        setScheduleOrdersModalConfig({ schedule: created, initialFilter: 'ALL' });
      }
    }
    setIsModalOpen(false);
  };

  const handleRunAutoLink = () => {
    const res = runAutoLinking();
    setLinkingResult(res);
    setTimeout(() => setLinkingResult(null), 4000);
  };

  // Barra de Filtros Sincronizada para as abas "Por Progresso" e "Tabela"
  const renderSynchronizedFilterBar = () => {
    const hasActiveFilters = 
      selectedScheduleFilter !== 'ALL' || 
      selectedCompetenciaFilter !== 'ALL' || 
      searchScheduleTerm.trim() !== '' || 
      filterUnits.length > 0 || 
      filterPrograms.length > 0 || 
      filterTypes.length > 0 ||
      dateSortField !== 'data_entrega' ||
      dateSortOrder !== 'asc' ||
      dateFilterPreset !== 'TODOS';

    const activeFilterCount = 
      (selectedScheduleFilter !== 'ALL' ? 1 : 0) +
      (selectedCompetenciaFilter !== 'ALL' ? 1 : 0) +
      (searchScheduleTerm.trim() !== '' ? 1 : 0) +
      filterUnits.length +
      filterPrograms.length +
      filterTypes.length +
      (dateSortField !== 'data_entrega' || dateSortOrder !== 'asc' ? 1 : 0) +
      (dateFilterPreset !== 'TODOS' ? 1 : 0);

    const activeCount = activeTab === 'progresso' ? filteredScheduleProgressList.length : filteredSchedulesList.length;

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs space-y-3.5">
        {/* Linha 1: Filtro de Cronograma, Competência, Período e Organização por Data */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* 1. Filtro de Cronograma */}
          <div className="col-span-1 sm:col-span-6 lg:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span>Filtro de Cronograma:</span>
              </span>
              {selectedScheduleFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedScheduleFilter('ALL')}
                  className="text-[10px] text-blue-700 hover:text-rose-600 font-semibold bg-blue-50 hover:bg-rose-50 px-1.5 py-0.2 rounded border border-blue-200 cursor-pointer"
                  title="Limpar seleção de cronograma"
                >
                  Filtrado ✕
                </button>
              )}
            </label>
            <select
              value={selectedScheduleFilter}
              onChange={(e) => setSelectedScheduleFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all cursor-pointer shadow-2xs truncate"
            >
              <option value="ALL">🌐 Todos os Cronogramas ({schedules.length})</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.competencia} · Entrega {formatShortDate(s.data_entrega)})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro de Competência / Ciclo */}
          <div className="col-span-1 sm:col-span-3 lg:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Competência:</span>
            </label>
            <select
              value={selectedCompetenciaFilter}
              onChange={(e) => setSelectedCompetenciaFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-all cursor-pointer shadow-2xs"
            >
              <option value="ALL">Todas ({availableCompetencias.length})</option>
              {availableCompetencias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 3. Filtro de Período / Data */}
          <div className="col-span-1 sm:col-span-3 lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Filtro de Período:</span>
              </span>
              {dateFilterPreset !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setDateFilterPreset('TODOS')}
                  className="text-[10px] text-amber-800 hover:text-rose-600 font-semibold bg-amber-50 hover:bg-rose-50 px-1.5 py-0.2 rounded border border-amber-200 cursor-pointer"
                  title="Limpar filtro de período"
                >
                  Filtrado ✕
                </button>
              )}
            </label>
            <select
              value={dateFilterPreset}
              onChange={(e) => setDateFilterPreset(e.target.value as ScheduleDateFilterPreset)}
              className="w-full text-xs font-semibold bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-all cursor-pointer shadow-2xs truncate"
            >
              {DATE_FILTER_PRESET_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filtro de Organização por Data */}
          <div className="col-span-1 sm:col-span-12 lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Organização por Data:</span>
              </span>
              <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {dateSortOrder === 'asc' ? 'Mais Próximas ↑' : 'Mais Distantes ↓'}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={dateSortField}
                onChange={(e) => setDateSortField(e.target.value as ScheduleDateSortField)}
                className="flex-1 text-xs font-semibold bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition-all cursor-pointer shadow-2xs truncate"
              >
                {DATE_SORT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setDateSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
                title={`Alternar direção: atualmente ${dateSortOrder === 'asc' ? 'Crescente (Mais próximas primeiro)' : 'Decrescente (Mais distantes primeiro)'}`}
              >
                {dateSortOrder === 'asc' ? (
                  <>
                    <ArrowUp className="w-3.5 h-3.5 text-indigo-700" />
                    <span className="hidden sm:inline text-[11px]">Cresc.</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-700" />
                    <span className="hidden sm:inline text-[11px]">Decresc.</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Linha 2: Busca por texto, Multi-selects (Unidades, Programas, Tipos) e Contadores em Grid Alinhado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-3 border-t border-slate-200/80 items-center">
          <div className="col-span-1 sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchScheduleTerm}
              onChange={(e) => setSearchScheduleTerm(e.target.value)}
              placeholder="Buscar por nome, unidade ou programa..."
              className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30 text-slate-900 shadow-2xs font-medium"
            />
            {searchScheduleTerm && (
              <button
                type="button"
                onClick={() => setSearchScheduleTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <MultiSelect
              options={units.map(u => ({ id: u.sigla, label: u.sigla, subLabel: u.nome }))}
              selected={filterUnits}
              onChange={setFilterUnits}
              placeholder="Todas as Unidades"
              className="w-full"
              showSearch={true}
              align="left"
            />
          </div>

          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <MultiSelect
              options={programs.map(p => ({ id: p.nome, label: p.nome }))}
              selected={filterPrograms}
              onChange={setFilterPrograms}
              placeholder="Todos os Programas"
              className="w-full"
              align="left"
            />
          </div>

          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <MultiSelect
              options={orderTypes.map(t => ({ id: t.nome, label: t.nome, color: t.cor }))}
              selected={filterTypes}
              onChange={setFilterTypes}
              placeholder="Todos os Tipos"
              className="w-full"
              align="right"
            />
          </div>

          <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center justify-between sm:justify-end gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedScheduleFilter('ALL');
                  setSelectedCompetenciaFilter('ALL');
                  setSearchScheduleTerm('');
                  setFilterUnits([]);
                  setFilterPrograms([]);
                  setFilterTypes([]);
                  setDateSortField('data_entrega');
                  setDateSortOrder('asc');
                  setDateFilterPreset('TODOS');
                }}
                className="text-xs text-rose-700 hover:text-rose-900 font-bold px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar ({activeFilterCount})</span>
              </button>
            )}

            <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-2 rounded-xl border border-blue-200 shadow-2xs whitespace-nowrap text-center">
              {activeCount} de {schedules.length}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-cyan-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Cronograma & Calendário de Abastecimento
              </h2>
              <span className="text-[11px] font-mono text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold shrink-0">
                {schedules.length} cronogramas ativos
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Mapeamento unificado de datas: Solicitação, Aprovação, Separação, Expedição e Entrega no Hospital
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start xl:self-auto">
          {/* Main Segmented Switcher: Calendário, Progresso, Lista */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setActiveTab('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'calendario'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Calendário</span>
            </button>

            <button
              onClick={() => setActiveTab('progresso')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'progresso'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Por Progresso</span>
            </button>

            <button
              onClick={() => setActiveTab('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'lista'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <List className="w-3.5 h-3.5 text-purple-600" />
              <span>Tabela</span>
            </button>

            <button
              onClick={() => setActiveTab('relatorio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'relatorio'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>Relatório</span>
            </button>
          </div>

          <button
            onClick={handleRunAutoLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            title="Percorrer pedidos sem cronograma e vincular automaticamente"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Vincular Automático</span>
          </button>

          <button
            onClick={() => setBatchLinkScheduleId('ANY')}
            disabled={currentUser.role === 'VIEWER'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            title="Vincular múltiplos pedidos a um cronograma em uma única ação"
          >
            <Link2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Vincular em Lote</span>
          </button>

          <button
            onClick={handleOpenNew}
            disabled={currentUser.role === 'VIEWER'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Novo Cronograma</span>
          </button>
        </div>
      </div>

      {linkingResult && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Processo de vinculação concluído: <strong>{linkingResult.linkedCount}</strong> novos pedidos vinculados aos cronogramas vigentes.
            </span>
          </div>
          <button onClick={() => setLinkingResult(null)} className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5">✕</button>
        </div>
      )}

      {/* VIEW 1: CALENDÁRIO UNIFICADO (PRIMARY VIEW) */}
      {activeTab === 'calendario' && (
        <UnifiedCalendar 
          onSelectOrder={onSelectOrder} 
          onOpenNewSchedule={handleOpenNewForDay}
          onOpenScheduleOrders={(sch, filter) => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: filter || 'ALL' })}
          selectedScheduleProp={selectedScheduleFilter}
          onSelectSchedule={setSelectedScheduleFilter}
        />
      )}

      {/* VIEW 2: VISÃO POR PROGRESSO */}
      {activeTab === 'progresso' && (
        <div className="space-y-4">
          {/* Synchronized Filter Bar */}
          {renderSynchronizedFilterBar()}

          {/* Banner de Sincronização e Organização Ativa */}
          {(selectedScheduleFilter !== 'ALL' || dateFilterPreset !== 'TODOS' || dateSortField !== 'data_entrega' || dateSortOrder !== 'asc') && (
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-800 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="font-bold text-slate-900">Visualização Sincronizada:</span>
                {selectedScheduleFilter !== 'ALL' && (
                  <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg font-bold border border-blue-200">
                    Cronograma: {schedules.find(s => s.id === selectedScheduleFilter)?.nome || selectedScheduleFilter}
                  </span>
                )}
                <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-lg font-bold border border-indigo-200">
                  Organizado por: {DATE_SORT_OPTIONS.find(o => o.id === dateSortField)?.shortLabel} ({dateSortOrder === 'asc' ? 'Crescente ↑' : 'Decrescente ↓'})
                </span>
                {dateFilterPreset !== 'TODOS' && (
                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg font-bold border border-amber-200">
                    Período: {DATE_FILTER_PRESET_OPTIONS.find(p => p.id === dateFilterPreset)?.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedScheduleFilter('ALL');
                  setDateFilterPreset('TODOS');
                  setDateSortField('data_entrega');
                  setDateSortOrder('asc');
                }}
                className="text-xs text-blue-700 hover:text-blue-950 font-bold underline cursor-pointer shrink-0"
              >
                Redefinir
              </button>
            </div>
          )}

          {filteredScheduleProgressList.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum cronograma encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Não existem cronogramas correspondentes aos filtros selecionados. Tente ajustar os parâmetros ou redefinir a busca.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedScheduleFilter('ALL');
                  setSelectedCompetenciaFilter('ALL');
                  setSearchScheduleTerm('');
                  setFilterUnits([]);
                  setFilterPrograms([]);
                  setFilterTypes([]);
                  setDateSortField('data_entrega');
                  setDateSortOrder('asc');
                  setDateFilterPreset('TODOS');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredScheduleProgressList.map(({ sch, total, delivered, inTransport, inSeparation, awaiting, noPrazo, atencao, foraDoPrazo, progressPercent, currentMilestone }) => {
                let barColor = 'bg-blue-600';
                if (progressPercent >= 80) barColor = 'bg-emerald-600';
                else if (progressPercent >= 50) barColor = 'bg-purple-600';
                else if (progressPercent >= 25) barColor = 'bg-amber-500';

                const unitsList = sch.unidades && sch.unidades.length > 0
                  ? sch.unidades
                  : sch.unidade.includes(',')
                  ? sch.unidade.split(',').map(s => s.trim())
                  : [sch.unidade];

                return (
                  <div 
                    key={sch.id} 
                    className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 hover:-translate-y-1 transition-all duration-200 space-y-3.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {unitsList.length > 1 ? (
                            <>
                              {unitsList.map(u => (
                                <span key={u} className="px-2 py-0.5 rounded-full bg-blue-100/90 text-blue-900 border border-blue-200 text-xs font-bold">
                                  {u}
                                </span>
                              ))}
                              <span className="text-[10px] text-slate-500 font-semibold">({unitsList.length} un.)</span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                              {sch.unidade}
                            </span>
                          )}
                          <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {sch.competencia}
                          </span>

                          {/* Dynamic Date Organization Badge */}
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border inline-flex items-center gap-1 ${
                            dateSortField === 'data_entrega'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : dateSortField === 'data_expedicao'
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              : dateSortField === 'data_separacao'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : dateSortField === 'data_limite_aprovacao'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            <span>{DATE_SORT_OPTIONS.find(o => o.id === dateSortField)?.shortLabel}:</span>
                            <span>{formatShortDate(sch[dateSortField])}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{sch.nome} · {sch.programa}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-bold font-mono text-slate-900">{progressPercent}%</span>
                        <span className="text-[10px] text-slate-400 block font-semibold">Progresso</span>
                      </div>
                    </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Etapa atual: <strong className="text-blue-700 font-bold">{currentMilestone}</strong></span>
                      <span className="font-mono font-semibold">{delivered}/{total} entregues</span>
                    </div>
                  </div>

                  {/* Counters - Rounded Pills Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Aguardando</span>
                      <strong className="font-mono text-slate-700 text-sm">{awaiting}</strong>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-2xl border border-purple-200/60">
                      <span className="text-[10px] text-purple-600 block font-medium">Separação</span>
                      <strong className="font-mono text-purple-800 text-sm">{inSeparation}</strong>
                    </div>
                    <div className="p-2 bg-cyan-50 rounded-2xl border border-cyan-200/60">
                      <span className="text-[10px] text-cyan-600 block font-medium">Transporte</span>
                      <strong className="font-mono text-cyan-800 text-sm">{inTransport}</strong>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-2xl border border-emerald-200/60">
                      <span className="text-[10px] text-emerald-600 block font-medium">Entregues</span>
                      <strong className="font-mono text-emerald-800 text-sm">{delivered}</strong>
                    </div>
                  </div>

                  {/* SLA Prazos & Auditoria Section */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'NO_PRAZO' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold transition-colors cursor-pointer"
                        title="Ver pedidos dentro do prazo previsto"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{noPrazo} no prazo</span>
                      </button>

                      {foraDoPrazo > 0 ? (
                        <button
                          type="button"
                          onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'FORA_DO_PRAZO' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold transition-colors cursor-pointer animate-pulse"
                          title="Ver pedidos fora do prazo / atrasados"
                        >
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>{foraDoPrazo} fora do prazo</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-400 text-[10px]">
                          0 atrasos
                        </span>
                      )}

                      {atencao > 0 && (
                        <button
                          type="button"
                          onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'ATENCAO' })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-medium transition-colors cursor-pointer text-[10px]"
                          title="Ver pedidos próximos do limite"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>{atencao} atenção</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => setBatchLinkScheduleId(sch.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        title="Vincular mais pedidos a este cronograma em uma única ação"
                      >
                        <Link2 className="w-3 h-3 text-slate-600" />
                        <span>Vincular</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'ALL' })}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs transition-colors cursor-pointer"
                        title="Auditar progresso, verificar pedidos no prazo/fora do prazo e definir inicialização"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>Auditar Pedidos</span>
                      </button>
                    </div>
                  </div>

                  {/* Dates footer */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                    <button
                      type="button"
                      onClick={() => handleOpenDayFromDate(sch.data_limite_solicitacao, sch.tipo_pedido)}
                      className="hover:text-blue-600 hover:bg-blue-50 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-left"
                      title={`Clique para abrir pedidos vinculados a este dia (${formatShortDate(sch.data_limite_solicitacao)})`}
                    >
                      Limite: {formatShortDate(sch.data_limite_solicitacao)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDayFromDate(sch.data_entrega, sch.tipo_pedido)}
                      className="text-emerald-700 font-bold hover:text-emerald-900 hover:bg-emerald-50 px-1 py-0.5 rounded-md cursor-pointer transition-colors text-right"
                      title={`Clique para abrir pedidos vinculados à entrega (${formatShortDate(sch.data_entrega)})`}
                    >
                      Entrega: {formatShortDate(sch.data_entrega)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* VIEW 3: TABELA DETALHADA DE CRONOGRAMAS */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          {/* Synchronized Filter Bar */}
          {renderSynchronizedFilterBar()}

          {/* Banner de Sincronização e Organização Ativa na Tabela */}
          {(selectedScheduleFilter !== 'ALL' || dateFilterPreset !== 'TODOS' || dateSortField !== 'data_entrega' || dateSortOrder !== 'asc') && (
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-800 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="font-bold text-slate-900">Visualização Sincronizada:</span>
                {selectedScheduleFilter !== 'ALL' && (
                  <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg font-bold border border-blue-200">
                    Cronograma: {schedules.find(s => s.id === selectedScheduleFilter)?.nome || selectedScheduleFilter}
                  </span>
                )}
                <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-lg font-bold border border-indigo-200">
                  Coluna Ativa: {DATE_SORT_OPTIONS.find(o => o.id === dateSortField)?.shortLabel} ({dateSortOrder === 'asc' ? 'Crescente ↑' : 'Decrescente ↓'})
                </span>
                {dateFilterPreset !== 'TODOS' && (
                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg font-bold border border-amber-200">
                    Período: {DATE_FILTER_PRESET_OPTIONS.find(p => p.id === dateFilterPreset)?.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedScheduleFilter('ALL');
                  setDateFilterPreset('TODOS');
                  setDateSortField('data_entrega');
                  setDateSortOrder('asc');
                }}
                className="text-xs text-blue-700 hover:text-blue-950 font-bold underline cursor-pointer shrink-0"
              >
                Redefinir
              </button>
            </div>
          )}

          {filteredSchedulesList.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum cronograma encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Não existem cronogramas correspondentes aos filtros selecionados. Tente ajustar os parâmetros ou redefinir a busca.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedScheduleFilter('ALL');
                  setSelectedCompetenciaFilter('ALL');
                  setSearchScheduleTerm('');
                  setFilterUnits([]);
                  setFilterPrograms([]);
                  setFilterTypes([]);
                  setDateSortField('data_entrega');
                  setDateSortOrder('asc');
                  setDateFilterPreset('TODOS');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Cronograma / Competência</th>
                      <th className="py-3 px-3">Unidade & Programa</th>
                      <th className="py-3 px-3">Tipo</th>
                      <th 
                        onClick={() => handleToggleDateSort('data_limite_solicitacao')}
                        className={`py-3 px-3 text-center cursor-pointer transition-colors select-none group ${
                          dateSortField === 'data_limite_solicitacao' ? 'bg-blue-100/80 text-blue-900 font-extrabold' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title="Clique para organizar por Limite de Solicitação"
                      >
                        <div className="inline-flex items-center justify-center gap-1 w-full">
                          <span>1. Limite Solicitação</span>
                          {dateSortField === 'data_limite_solicitacao' ? (
                            dateSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-700" /> : <ArrowDown className="w-3 h-3 text-blue-700" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleDateSort('data_limite_aprovacao')}
                        className={`py-3 px-3 text-center cursor-pointer transition-colors select-none group ${
                          dateSortField === 'data_limite_aprovacao' ? 'bg-blue-100/80 text-blue-900 font-extrabold' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title="Clique para organizar por Limite de Aprovação"
                      >
                        <div className="inline-flex items-center justify-center gap-1 w-full">
                          <span>2. Limite Aprovação</span>
                          {dateSortField === 'data_limite_aprovacao' ? (
                            dateSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-700" /> : <ArrowDown className="w-3 h-3 text-blue-700" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleDateSort('data_separacao')}
                        className={`py-3 px-3 text-center cursor-pointer transition-colors select-none group ${
                          dateSortField === 'data_separacao' ? 'bg-blue-100/80 text-blue-900 font-extrabold' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title="Clique para organizar por Início da Separação"
                      >
                        <div className="inline-flex items-center justify-center gap-1 w-full">
                          <span>3. Início Separação</span>
                          {dateSortField === 'data_separacao' ? (
                            dateSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-700" /> : <ArrowDown className="w-3 h-3 text-blue-700" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleDateSort('data_expedicao')}
                        className={`py-3 px-3 text-center cursor-pointer transition-colors select-none group ${
                          dateSortField === 'data_expedicao' ? 'bg-blue-100/80 text-blue-900 font-extrabold' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title="Clique para organizar por Expedição / Trânsito"
                      >
                        <div className="inline-flex items-center justify-center gap-1 w-full">
                          <span>4. Expedição</span>
                          {dateSortField === 'data_expedicao' ? (
                            dateSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-700" /> : <ArrowDown className="w-3 h-3 text-blue-700" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleToggleDateSort('data_entrega')}
                        className={`py-3 px-3 text-center cursor-pointer transition-colors select-none group ${
                          dateSortField === 'data_entrega' ? 'bg-emerald-100 text-emerald-950 font-black' : 'hover:bg-slate-100 text-emerald-800 font-bold'
                        }`}
                        title="Clique para organizar por Entrega no Hospital"
                      >
                        <div className="inline-flex items-center justify-center gap-1 w-full">
                          <span>5. Entrega Hospital</span>
                          {dateSortField === 'data_entrega' ? (
                            dateSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-700" /> : <ArrowDown className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3 text-center">Progresso & Prazos (SLA)</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredSchedulesList.map((sch) => {
                    const prog = scheduleProgressList.find(p => p.sch.id === sch.id);
                    return (
                    <tr key={sch.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{sch.nome}</div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                          {sch.competencia}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {sch.unidades && sch.unidades.length > 1 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {sch.unidades.map(u => (
                              <span key={u} className="px-1.5 py-0.2 rounded-md bg-blue-100/90 text-blue-900 font-bold text-[10px]">
                                {u}
                              </span>
                            ))}
                            <span className="text-[10px] text-slate-400 font-semibold">({sch.unidades.length} un.)</span>
                          </div>
                        ) : (
                          <strong className="text-slate-800">{sch.unidade}</strong>
                        )}
                        <div className="text-[11px] text-slate-500">{sch.programa}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200/70">
                          {sch.tipo_pedido}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-medium ${dateSortField === 'data_limite_solicitacao' ? 'bg-blue-50/60 font-bold text-blue-950' : 'text-slate-700'}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenDayFromDate(sch.data_limite_solicitacao, sch.tipo_pedido)}
                          className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                          title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_limite_solicitacao)}`}
                        >
                          {formatShortDate(sch.data_limite_solicitacao)}
                        </button>
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-medium ${dateSortField === 'data_limite_aprovacao' ? 'bg-blue-50/60 font-bold text-blue-950' : 'text-slate-700'}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenDayFromDate(sch.data_limite_aprovacao, sch.tipo_pedido)}
                          className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                          title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_limite_aprovacao)}`}
                        >
                          {formatShortDate(sch.data_limite_aprovacao)}
                        </button>
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-medium ${dateSortField === 'data_separacao' ? 'bg-blue-50/60 font-bold text-blue-950' : 'text-slate-700'}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenDayFromDate(sch.data_separacao, sch.tipo_pedido)}
                          className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                          title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_separacao)}`}
                        >
                          {formatShortDate(sch.data_separacao)}
                        </button>
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-medium ${dateSortField === 'data_expedicao' ? 'bg-blue-50/60 font-bold text-blue-950' : 'text-slate-700'}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenDayFromDate(sch.data_expedicao, sch.tipo_pedido)}
                          className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                          title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_expedicao)}`}
                        >
                          {formatShortDate(sch.data_expedicao)}
                        </button>
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-bold ${dateSortField === 'data_entrega' ? 'bg-emerald-100/60 text-emerald-950 font-black' : 'text-emerald-700'}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenDayFromDate(sch.data_entrega, sch.tipo_pedido)}
                          className="hover:text-emerald-900 hover:bg-emerald-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors font-bold"
                          title={`Clique para abrir pedidos vinculados à entrega em ${formatShortDate(sch.data_entrega)}`}
                        >
                          {formatShortDate(sch.data_entrega)}
                        </button>
                      </td>

                      {/* Progresso & Prazos (SLA) Column */}
                      <td className="py-3 px-3">
                        {prog ? (
                          <div className="space-y-1.5 min-w-36">
                            <div className="flex items-center justify-between text-[11px]">
                              <button
                                type="button"
                                onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'ALL' })}
                                className="font-bold text-slate-800 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                                title="Abrir auditoria do cronograma"
                              >
                                <span>{prog.progressPercent}%</span>
                                <span className="text-slate-400 font-normal">({prog.delivered}/{prog.total})</span>
                              </button>
                              <span className="text-[10px] text-blue-700 font-semibold">{prog.currentMilestone}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${prog.progressPercent >= 80 ? 'bg-emerald-600' : prog.progressPercent >= 50 ? 'bg-purple-600' : 'bg-blue-600'} rounded-full transition-all`}
                                style={{ width: `${prog.progressPercent}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'NO_PRAZO' })}
                                className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold cursor-pointer"
                                title={`${prog.noPrazo} pedidos no prazo`}
                              >
                                🟢 {prog.noPrazo}
                              </button>
                              {prog.foraDoPrazo > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'FORA_DO_PRAZO' })}
                                  className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300 font-bold cursor-pointer animate-pulse"
                                  title={`${prog.foraDoPrazo} pedidos fora do prazo / atrasados`}
                                >
                                  🔴 {prog.foraDoPrazo}
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">0 atrasos</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'ALL' })}
                            className="p-1.5 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Auditar progresso, verificar pedidos no prazo/fora do prazo e definir inicialização"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                          {currentUser.role !== 'VIEWER' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setBatchLinkScheduleId(sch.id)}
                                className="p-1.5 rounded-full text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Vincular pedidos a este cronograma em uma única ação"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(sch)}
                                className="p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Editar datas e prazos"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Excluir cronograma ${sch.nome}?`)) {
                                    deleteSchedule(sch.id);
                                  }
                                }}
                                className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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
          )}
        </div>
      )}

      {/* VIEW 4: RELATÓRIO VINCULADO AO CRONOGRAMA */}
      {activeTab === 'relatorio' && (
        <ScheduleReportTab onSelectOrder={onSelectOrder} />
      )}

      {/* Modal: Novo / Editar Cronograma - Rounded 3xl */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSchedule ? 'Editar Cronograma de Abastecimento' : 'Novo Cronograma de Abastecimento'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {validationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2 font-semibold animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* 1. MÚLTIPLAS UNIDADES SOLICITANTES */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="font-bold text-slate-900 text-xs">
                        Unidades Vinculadas ao Cronograma
                      </label>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold border transition-colors ${
                        selectedUnits.length > 0 
                          ? 'bg-blue-100 text-blue-900 border-blue-300' 
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {selectedUnits.length} selecionada(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Vincule uma ou mais unidades ao ciclo de abastecimento desta data
                    </p>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllUnits}
                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-full border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      Todas ({units.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleClearUnits}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-full border border-slate-200 transition-all cursor-pointer active:scale-95"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por sigla, nome ou município..."
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {unitSearch && (
                      <button
                        type="button"
                        onClick={() => setUnitSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-[10px]">
                    {(['TODOS', 'Hospital', 'UPA', 'Maternidade'] as const).map(tp => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => setUnitTypeFilter(tp)}
                        className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                          unitTypeFilter === tp
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tp === 'TODOS' ? 'Todas' : tp + 's'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Units Interactive Grid */}
                <div className="max-h-40 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200/80">
                  {filteredAvailableUnits.map(u => {
                    const isSelected = selectedUnits.includes(u.sigla);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUnit(u.sigla)}
                        className={`p-2 rounded-xl text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50/60 hover:bg-blue-50/50 text-slate-700 border-slate-200/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className={`font-mono text-xs font-bold block truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {u.sigla}
                          </span>
                          <span className={`text-[10px] block truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {u.nome}
                          </span>
                        </div>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'border border-slate-300 text-transparent'
                        }`}>
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredAvailableUnits.length === 0 && (
                    <div className="col-span-full py-4 text-center text-slate-400 italic text-[11px]">
                      Nenhuma unidade encontrada para os filtros aplicados.
                    </div>
                  )}
                </div>

                {/* Selected Units Badges Row */}
                {selectedUnits.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Unidades Vinculadas ({selectedUnits.length}):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-blue-50/50 rounded-xl border border-blue-200/60">
                      {selectedUnits.map(sig => (
                        <span
                          key={sig}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold border border-blue-200 animate-in fade-in"
                        >
                          <span>{sig}</span>
                          <button
                            type="button"
                            onClick={() => toggleUnit(sig)}
                            className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 text-blue-700 flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Multi-unit Mode Selector (when > 1 unit selected and not editing) */}
                {selectedUnits.length > 1 && !editingSchedule && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200/80 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                      Formato de Registro para as {selectedUnits.length} Unidades:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        creationMode === 'UNIFICADO'
                          ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-2xs'
                          : 'bg-slate-50/60 border-slate-200 text-slate-600 font-medium hover:bg-slate-100/50'
                      }`}>
                        <input
                          type="radio"
                          name="creationMode"
                          checked={creationMode === 'UNIFICADO'}
                          onChange={() => setCreationMode('UNIFICADO')}
                          className="mt-0.5"
                        />
                        <div>
                          <span>Cronograma Único Compartilhado</span>
                          <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                            1 cronograma central vinculando todas as {selectedUnits.length} unidades nesta mesma data.
                          </p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        creationMode === 'INDIVIDUAL'
                          ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-2xs'
                          : 'bg-slate-50/60 border-slate-200 text-slate-600 font-medium hover:bg-slate-100/50'
                      }`}>
                        <input
                          type="radio"
                          name="creationMode"
                          checked={creationMode === 'INDIVIDUAL'}
                          onChange={() => setCreationMode('INDIVIDUAL')}
                          className="mt-0.5"
                        />
                        <div>
                          <span>Cronogramas Individuais em Lote</span>
                          <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                            Gera {selectedUnits.length} cronogramas independentes (um para cada unidade) com as mesmas datas.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. DADOS DO CRONOGRAMA */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Título do Cronograma</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setIsTitleManual(true);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Programa</label>
                  <select
                    value={programa}
                    onChange={(e) => {
                      setPrograma(e.target.value);
                      if (!isTitleManual) {
                        const label = selectedUnits.length > 0 ? selectedUnits.join(', ') : 'Unidades';
                        setNome(`${label} — ${e.target.value} ${tipoPedido} — ${competencia}`);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Competência</label>
                  <input
                    type="text"
                    required
                    value={competencia}
                    onChange={(e) => {
                      setCompetencia(e.target.value);
                      if (!isTitleManual) {
                        const label = selectedUnits.length > 0 ? selectedUnits.join(', ') : 'Unidades';
                        setNome(`${label} — ${programa} ${tipoPedido} — ${e.target.value}`);
                      }
                    }}
                    placeholder="Ex: OUT/26"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipo de Pedido</label>
                  <select
                    value={tipoPedido}
                    onChange={(e) => {
                      setTipoPedido(e.target.value);
                      if (!isTitleManual) {
                        const label = selectedUnits.length > 0 ? selectedUnits.join(', ') : 'Unidades';
                        setNome(`${label} — ${programa} ${e.target.value} — ${competencia}`);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {orderTypes.map(t => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. DATAS LIMITE DO CICLO */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block text-[10px]">
                    Mapeamento de Datas Limite do Ciclo (5 Etapas)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cycle = calculateCycleDatesForDelivery(entregaPrevista);
                      if (cycle) {
                        setExpedicaoPrevista(cycle.expedicao);
                        setSeparacaoPrevista(cycle.separacao);
                        setLimiteAprovacao(cycle.limiteAprovacao);
                        setLimiteSolicitacao(cycle.limiteSolicitacao);
                        showToast('info', 'Prazos do Ciclo Calculados', 'Datas retroativas sugeridas com base na entrega.');
                      }
                    }}
                    className="text-[10px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 hover:bg-blue-50 cursor-pointer shadow-2xs"
                  >
                    Sugerir Prazos do Ciclo
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">1. Limite Solicitação</label>
                    <input
                      type="date"
                      required
                      value={limiteSolicitacao}
                      onChange={(e) => setLimiteSolicitacao(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">2. Limite Aprovação</label>
                    <input
                      type="date"
                      required
                      value={limiteAprovacao}
                      onChange={(e) => setLimiteAprovacao(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">3. Separação Prevista</label>
                    <input
                      type="date"
                      required
                      value={separacaoPrevista}
                      onChange={(e) => setSeparacaoPrevista(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">4. Expedição Prevista</label>
                    <input
                      type="date"
                      required
                      value={expedicaoPrevista}
                      onChange={(e) => setExpedicaoPrevista(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-emerald-800 block mb-0.5">5. Entrega no Hospital (Data Agendada)</label>
                    <input
                      type="date"
                      required
                      value={entregaPrevista}
                      onChange={(e) => setEntregaPrevista(e.target.value)}
                      className="w-full p-2 bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Observações do Cronograma</label>
                <textarea
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Informações adicionais do cronograma..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {selectedUnits.length} unidade(s) selecionada(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    {editingSchedule 
                      ? 'Salvar Alterações' 
                      : creationMode === 'INDIVIDUAL' && selectedUnits.length > 1
                      ? `Criar ${selectedUnits.length} Cronogramas`
                      : `Salvar Cronograma (${selectedUnits.length} un.)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Orders Modal triggered directly from date clicks */}
      {dayOrdersModalConfig && (
        <DayOrdersModal
          isOpen={true}
          onClose={() => setDayOrdersModalConfig(null)}
          dayNumber={dayOrdersModalConfig.day}
          monthNumber={dayOrdersModalConfig.month}
          onNavigateDay={(newDay) => setDayOrdersModalConfig(prev => prev ? { ...prev, day: newDay } : null)}
          onSelectOrder={onSelectOrder}
          onOpenNewSchedule={handleOpenNewForDay}
          externalFilterOrderTypes={dayOrdersModalConfig.type ? [dayOrdersModalConfig.type] : filterTypes}
          externalFilterUnits={filterUnits}
          externalStageFilters={[]}
          onOpenScheduleOrders={(sch, filter) => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: filter || 'ALL' })}
        />
      )}

      {/* Schedule Orders Modal for Progress & SLA audit */}
      {scheduleOrdersModalConfig && (
        <ScheduleOrdersModal
          isOpen={true}
          onClose={() => setScheduleOrdersModalConfig(null)}
          schedule={scheduleOrdersModalConfig.schedule}
          initialFilter={scheduleOrdersModalConfig.initialFilter || 'ALL'}
          onSelectOrder={onSelectOrder}
        />
      )}

      {/* Batch Link Orders Modal */}
      {batchLinkScheduleId && (
        <BatchLinkOrdersModal
          isOpen={true}
          onClose={() => setBatchLinkScheduleId(null)}
          preselectedScheduleId={batchLinkScheduleId === 'ANY' ? undefined : batchLinkScheduleId}
        />
      )}
    </div>
  );
};
