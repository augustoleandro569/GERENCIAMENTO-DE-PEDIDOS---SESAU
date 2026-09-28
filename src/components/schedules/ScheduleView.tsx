import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { Schedule, Order } from '../../types';
import { formatDate, formatShortDate, parseDateSafe, calculateDeadlineSituation } from '../../utils/dateUtils';
import { UnifiedCalendar } from './UnifiedCalendar';
import { DayOrdersModal } from './DayOrdersModal';
import { ScheduleOrdersModal } from './ScheduleOrdersModal';
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
  CalendarPlus
} from 'lucide-react';

interface ScheduleViewProps {
  onSelectOrder?: (order: Order) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onSelectOrder }) => {
  const { schedules, units, programs, orderTypes, orders, addSchedule, addSchedules, updateSchedule, deleteSchedule, runAutoLinking, currentUser, settings } = useStore();

  // Mode: Calendário | Progresso | Lista
  const [activeTab, setActiveTab] = useState<'calendario' | 'progresso' | 'lista'>('calendario');

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
    const now = new Date('2026-09-24T14:15:00');

    return schedules.map(sch => {
      const linkedOrders = orders.filter(o => {
        if (o.cronograma_id === sch.id) return true;
        if (!o.cronograma_id) {
          const matchesUnit = 
            (sch.unidade && sch.unidade.toUpperCase().trim() === o.unidade.toUpperCase().trim()) ||
            (sch.unidades && sch.unidades.some(u => u.toUpperCase().trim() === o.unidade.toUpperCase().trim()));
          const matchesProg = sch.programa.toUpperCase().trim() === o.programa.toUpperCase().trim();
          const matchesTipo = sch.tipo_pedido.toUpperCase().trim() === o.tipo.toUpperCase().trim();
          return matchesUnit && matchesProg && matchesTipo;
        }
        return false;
      });

      const total = linkedOrders.length;
      const delivered = linkedOrders.filter(o => o.status_operacional === 'Entregue' || o.status_operacional === 'Entregue Parcialmente').length;
      const inTransport = linkedOrders.filter(o => o.status_operacional === 'Em Transporte').length;
      const inSeparation = linkedOrders.filter(o => o.status_operacional === 'Em Separação' || o.status_operacional === 'Aguardando Conferência' || o.status_operacional === 'Expedida').length;
      const awaiting = linkedOrders.filter(o => o.status_operacional === 'Aguardando Aprovação' || o.status_operacional === 'Rascunho' || o.status_operacional === 'Aprovada').length;

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

  return (
    <div className="space-y-4">
      {/* Top Header - Rounded 3xl Container */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Cronograma & Calendário de Abastecimento
              </h2>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70 font-bold">
                {schedules.length} cronogramas ativos
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Mapeamento unificado de datas: Solicitação, Aprovação, Separação, Expedição e Entrega no Hospital
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Segmented Switcher: Calendário, Progresso, Lista - Rounded Full */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/50 shadow-inner text-xs">
            <button
              onClick={() => setActiveTab('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'calendario'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Calendário</span>
            </button>

            <button
              onClick={() => setActiveTab('progresso')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'progresso'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Por Progresso</span>
            </button>

            <button
              onClick={() => setActiveTab('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'lista'
                  ? 'bg-white text-slate-900 shadow-xs font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <List className="w-3.5 h-3.5 text-purple-600" />
              <span>Tabela</span>
            </button>
          </div>

          <button
            onClick={handleRunAutoLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 rounded-full transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Percorrer pedidos sem cronograma e vincular automaticamente"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Vincular Automático</span>
          </button>

          <button
            onClick={handleOpenNew}
            disabled={currentUser.role === 'VIEWER'}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
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
        />
      )}

      {/* VIEW 2: VISÃO POR PROGRESSO */}
      {activeTab === 'progresso' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Progresso Físico dos Cronogramas de Abastecimento
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento percentual do fluxo operacional desde o pedido até a chegada no hospital
              </p>
            </div>
            <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 shadow-2xs self-start sm:self-auto">
              {scheduleProgressList.length} cronogramas avaliados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduleProgressList.map(({ sch, total, delivered, inTransport, inSeparation, awaiting, noPrazo, atencao, foraDoPrazo, progressPercent, currentMilestone }) => {
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
                  <div className="flex items-start justify-between">
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
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{sch.nome} · {sch.programa}</p>
                    </div>

                    <div className="text-right">
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

                    <button
                      type="button"
                      onClick={() => setScheduleOrdersModalConfig({ schedule: sch, initialFilter: 'ALL' })}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs transition-colors cursor-pointer ml-auto"
                      title="Auditar progresso, verificar pedidos no prazo/fora do prazo e definir inicialização"
                    >
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>Auditar Pedidos</span>
                    </button>
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
        </div>
      )}

      {/* VIEW 3: TABELA DETALHADA DE CRONOGRAMAS */}
      {activeTab === 'lista' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Cronograma / Competência</th>
                  <th className="py-3 px-3">Unidade & Programa</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3 text-center">1. Limite Solicitação</th>
                  <th className="py-3 px-3 text-center">2. Limite Aprovação</th>
                  <th className="py-3 px-3 text-center">3. Início Separação</th>
                  <th className="py-3 px-3 text-center">4. Expedição</th>
                  <th className="py-3 px-3 text-center font-bold text-emerald-800">5. Entrega Hospital</th>
                  <th className="py-3 px-3 text-center">Progresso & Prazos (SLA)</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {schedules.map((sch) => {
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
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      <button
                        type="button"
                        onClick={() => handleOpenDayFromDate(sch.data_limite_solicitacao, sch.tipo_pedido)}
                        className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                        title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_limite_solicitacao)}`}
                      >
                        {formatShortDate(sch.data_limite_solicitacao)}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      <button
                        type="button"
                        onClick={() => handleOpenDayFromDate(sch.data_limite_aprovacao, sch.tipo_pedido)}
                        className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                        title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_limite_aprovacao)}`}
                      >
                        {formatShortDate(sch.data_limite_aprovacao)}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      <button
                        type="button"
                        onClick={() => handleOpenDayFromDate(sch.data_separacao, sch.tipo_pedido)}
                        className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                        title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_separacao)}`}
                      >
                        {formatShortDate(sch.data_separacao)}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      <button
                        type="button"
                        onClick={() => handleOpenDayFromDate(sch.data_expedicao, sch.tipo_pedido)}
                        className="hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                        title={`Clique para abrir pedidos vinculados a ${formatShortDate(sch.data_expedicao)}`}
                      >
                        {formatShortDate(sch.data_expedicao)}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
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

      {/* Modal: Novo / Editar Cronograma - Rounded 3xl */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
          initialOrderType={dayOrdersModalConfig.type || 'ALL'}
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
    </div>
  );
};
