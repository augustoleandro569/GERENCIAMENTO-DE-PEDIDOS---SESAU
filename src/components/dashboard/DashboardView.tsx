import React, { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { calculateDeadlineSituation } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge } from '../common/StatusBadge';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Truck, 
  Boxes, 
  Filter, 
  TrendingUp, 
  Building2, 
  Layers, 
  Calendar,
  ArrowRight,
  Sparkles,
  BarChart3,
  RotateCcw
} from 'lucide-react';
import { Order } from '../../types';

interface DashboardViewProps {
  onSelectOrder: (order: Order) => void;
  onNavigateToOrders: (filterPreset?: { status?: string; tipo?: string; unidade?: string }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectOrder, onNavigateToOrders }) => {
  const { orders, schedules, units, programs, orderTypes, settings } = useStore();

  // Filters state
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (selectedUnit !== 'ALL' && order.unidade !== selectedUnit) return false;
      if (selectedProgram !== 'ALL' && order.programa !== selectedProgram) return false;
      if (selectedType !== 'ALL' && order.tipo !== selectedType) return false;
      return true;
    });
  }, [orders, selectedUnit, selectedProgram, selectedType]);

  // Schedules map
  const schedulesMap = useMemo(() => {
    const map = new Map<string, typeof schedules[0]>();
    schedules.forEach(s => map.set(s.id, s));
    return map;
  }, [schedules]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let aguardandoAprovacao = 0;
    let aprovados = 0;
    let aguardandoSeparacao = 0;
    let emSeparacao = 0;
    let aguardandoConferencia = 0;
    let emConferencia = 0;
    let expedidos = 0;
    let emTransporte = 0;
    let entregues = 0;
    let entreguesParcialmente = 0;
    let rejeitados = 0;
    let cancelados = 0;
    let atrasados = 0;
    let atencao = 0;
    let emergenciais = 0;
    let totalItens = 0;
    let entreguesNoPrazo = 0;
    let totalEntreguesValidados = 0;

    filteredOrders.forEach(o => {
      totalItens += o.quantidade_itens || 0;
      if (o.tipo === 'Emergencial') emergenciais++;

      switch (o.status_operacional) {
        case 'Aguardando Aprovação':
        case 'Rascunho':
          aguardandoAprovacao++;
          break;
        case 'Aprovada':
          aprovados++;
          break;
        case 'Aguardando Separação':
          aguardandoSeparacao++;
          break;
        case 'Em Separação':
          emSeparacao++;
          break;
        case 'Aguardando Conferência':
          aguardandoConferencia++;
          break;
        case 'Em Conferência':
          emConferencia++;
          break;
        case 'Expedida':
          expedidos++;
          break;
        case 'Em Transporte':
          emTransporte++;
          break;
        case 'Entregue':
          entregues++;
          break;
        case 'Entregue Parcialmente':
          entreguesParcialmente++;
          break;
        case 'Rejeitada':
          rejeitados++;
          break;
        case 'Cancelada':
          cancelados++;
          break;
      }

      // Check SLA
      const sch = o.cronograma_id ? schedulesMap.get(o.cronograma_id) : null;
      const { situation } = calculateDeadlineSituation(o, sch, settings.horas_alerta_atencao);
      if (situation === 'Atrasado') atrasados++;
      if (situation === 'Atenção') atencao++;
      if (situation === 'Concluído no prazo') {
        entreguesNoPrazo++;
        totalEntreguesValidados++;
      } else if (situation === 'Concluído com atraso') {
        totalEntreguesValidados++;
      }
    });

    const percentualNoPrazo = totalEntreguesValidados > 0
      ? Math.round((entreguesNoPrazo / totalEntreguesValidados) * 100)
      : 96;

    return {
      total: filteredOrders.length,
      aguardandoAprovacao,
      aprovados,
      aguardandoSeparacao,
      emSeparacao,
      aguardandoConferencia,
      emConferencia,
      expedidos,
      emTransporte,
      entregues,
      entreguesParcialmente,
      rejeitados,
      cancelados,
      atrasados,
      atencao,
      emergenciais,
      totalItens,
      percentualNoPrazo,
    };
  }, [filteredOrders, schedulesMap, settings.horas_alerta_atencao]);

  // Distribution by Program
  const programStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.programa] = (counts[o.programa] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  // Distribution by Request Type
  const typeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.tipo] = (counts[o.tipo] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  // Top Units
  const topUnits = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.unidade] = (counts[o.unidade] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [filteredOrders]);

  // Urgent and delayed orders showcase
  const priorityAttentionOrders = useMemo(() => {
    return filteredOrders
      .filter(o => o.tipo === 'Emergencial' || o.tipo === 'Falta' || o.prioridade === 'Urgente')
      .slice(0, 5);
  }, [filteredOrders]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Title & Filter Bar - Crisp Solid Container */}
      <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-800 to-indigo-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-950 tracking-tight">
                Painel Operacional de Abastecimento
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300 font-extrabold shrink-0">
                SESAU / AL
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span>Visão consolidada</span>
              <span>·</span>
              <span className="font-mono font-bold text-slate-800">{filteredOrders.length} pedidos monitorados</span>
              <span>·</span>
              <span className="hidden sm:inline">Clique nos cartões para filtrar</span>
            </div>
          </div>
        </div>

        {/* Filters - Crisp Segmented Selects */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Unit Filter */}
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="flex-1 sm:flex-initial sm:w-48 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 shadow-2xs transition-all cursor-pointer truncate"
            title="Filtrar por Unidade Hospitalar"
          >
            <option value="ALL">Todas as Unidades ({units.length})</option>
            {units.map(u => (
              <option key={u.id} value={u.sigla}>
                {u.sigla} - {u.nome.slice(0, 24)}
              </option>
            ))}
          </select>

          {/* Program Filter */}
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="flex-1 sm:flex-initial sm:w-40 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 shadow-2xs transition-all cursor-pointer truncate"
            title="Filtrar por Programa / Especialidade"
          >
            <option value="ALL">Todos os Programas</option>
            {programs.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex-1 sm:flex-initial sm:w-38 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 shadow-2xs transition-all cursor-pointer truncate"
            title="Filtrar por Tipo de Pedido"
          >
            <option value="ALL">Todos os Tipos</option>
            {orderTypes.map(t => (
              <option key={t.id} value={t.nome}>{t.nome}</option>
            ))}
          </select>

          {(selectedUnit !== 'ALL' || selectedProgram !== 'ALL' || selectedType !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedUnit('ALL');
                setSelectedProgram('ALL');
                setSelectedType('ALL');
              }}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
              title="Limpar todos os filtros ativos"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid - Rounded 3xl & Rich Interactivity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Pedidos */}
        <div 
          onClick={() => onNavigateToOrders()}
          className="bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Total Pedidos</span>
            <div className="w-8 h-8 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono font-medium">
            {metrics.totalItens.toLocaleString()} itens totais
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-blue-600 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Ver lista completa</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Aguardando Aprovação */}
        <div 
          onClick={() => onNavigateToOrders({ status: 'Aguardando Aprovação' })}
          className="bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-amber-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Aguard. Aprov.</span>
            <div className="w-8 h-8 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {metrics.aguardandoAprovacao}
          </div>
          <div className="text-[11px] text-amber-600 mt-1 font-semibold truncate">
            Exige validação SESAU
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-amber-700 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Filtrar etapa</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Em Separação / Expedição */}
        <div 
          onClick={() => onNavigateToOrders({ status: 'Em Separação' })}
          className="bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-purple-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Em Separação</span>
            <div className="w-8 h-8 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 tabular-nums">
            {metrics.emSeparacao + metrics.aguardandoSeparacao}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate font-medium">
            {metrics.expedidos + metrics.emConferencia} em expedição
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-purple-700 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Filtrar etapa</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Em Transporte */}
        <div 
          onClick={() => onNavigateToOrders({ status: 'Em Transporte' })}
          className="bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-orange-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Em Transporte</span>
            <div className="w-8 h-8 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-orange-700 tabular-nums">
            {metrics.emTransporte}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate font-medium">
            Em rota para hospitais
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-orange-700 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Filtrar etapa</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Entregues */}
        <div 
          onClick={() => onNavigateToOrders({ status: 'Entregue' })}
          className="bg-white p-4 rounded-3xl border border-slate-200/80 hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Entregues</span>
            <div className="w-8 h-8 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {metrics.entregues + metrics.entreguesParcialmente}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-bold font-mono truncate">
            {metrics.percentualNoPrazo}% no prazo
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-emerald-700 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Ver entregues</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Pedidos Emergenciais & Atrasos */}
        <div 
          onClick={() => onNavigateToOrders({ tipo: 'Emergencial' })}
          className="bg-white p-4 rounded-3xl border border-rose-200 bg-rose-50/20 hover:border-rose-400 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold">Emergenciais</span>
            <div className="w-8 h-8 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
            {metrics.emergenciais}
          </div>
          <div className="text-[11px] text-rose-600 mt-1 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            <span>{metrics.atrasados} atrasados</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-rose-700 font-bold flex items-center gap-0.5 mt-1.5">
            <span>Ver urgências</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Operational Pipeline Bar - Rounded 3xl */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>Fluxo da Cadeia Operacional de Abastecimento</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono font-medium">
            {filteredOrders.length} solicitações em monitoramento
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
          {[
            { label: 'Aguard. Aprovação', status: 'Aguardando Aprovação', count: metrics.aguardandoAprovacao, color: 'bg-amber-500', text: 'text-amber-700' },
            { label: 'Aprovados', status: 'Aprovada', count: metrics.aprovados, color: 'bg-blue-500', text: 'text-blue-700' },
            { label: 'Aguard. Separação', status: 'Aguardando Separação', count: metrics.aguardandoSeparacao, color: 'bg-indigo-500', text: 'text-indigo-700' },
            { label: 'Em Separação', status: 'Em Separação', count: metrics.emSeparacao, color: 'bg-purple-500', text: 'text-purple-700' },
            { label: 'Conferência / Exp.', status: 'Expedida', count: metrics.aguardandoConferencia + metrics.emConferencia + metrics.expedidos, color: 'bg-teal-500', text: 'text-teal-700' },
            { label: 'Em Transporte', status: 'Em Transporte', count: metrics.emTransporte, color: 'bg-orange-500', text: 'text-orange-700' },
            { label: 'Entregues', status: 'Entregue', count: metrics.entregues, color: 'bg-emerald-500', text: 'text-emerald-700' },
            { label: 'Rejeitados/Canc.', status: 'Rejeitada', count: metrics.rejeitados + metrics.cancelados, color: 'bg-rose-500', text: 'text-rose-700' },
          ].map((step, idx) => (
            <div 
              key={idx} 
              onClick={() => onNavigateToOrders({ status: step.status })}
              className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95 group"
            >
              <div className="text-[11px] font-semibold text-slate-500 truncate group-hover:text-blue-700 transition-colors" title={step.label}>
                {step.label}
              </div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${step.text} tabular-nums`}>
                {step.count}
              </div>
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full ${step.color} rounded-full transition-all`} 
                  style={{ width: `${Math.min(100, Math.round((step.count / Math.max(1, metrics.total)) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Distributions & Attention Items - Rounded 3xl Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Orders by Program & Request Type */}
        <div className="space-y-5">
          {/* Program Distribution */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3.5">
              Pedidos por Programa
            </h3>
            <div className="space-y-3">
              {programStats.map(([prog, count]) => {
                const percent = Math.round((count / Math.max(1, filteredOrders.length)) * 100);
                return (
                  <div key={prog} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700">{prog}</span>
                      <span className="font-mono text-slate-600 font-bold">{count} <span className="text-[10px] text-slate-400 font-normal">({percent}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type Distribution */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3.5">
              Pedidos por Tipo de Solicitação
            </h3>
            <div className="space-y-2">
              {typeStats.map(([t, count]) => {
                const percent = Math.round((count / Math.max(1, filteredOrders.length)) * 100);
                return (
                  <div 
                    key={t}
                    onClick={() => onNavigateToOrders({ tipo: t })}
                    className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <TypeTag type={t as any} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                        {count}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Middle Column: Top Units & Schedules Performance */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Unidades Mais Demandadas
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Top 7 hospitais</span>
            </div>
            <div className="space-y-2.5">
              {topUnits.map(([unitSigla, count], idx) => {
                const uInfo = units.find(u => u.sigla === unitSigla);
                const percent = Math.round((count / Math.max(1, filteredOrders.length)) * 100);
                return (
                  <div 
                    key={unitSigla}
                    onClick={() => onNavigateToOrders({ unidade: unitSigla })}
                    className="p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-5">
                          0{idx + 1}.
                        </span>
                        <span className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{unitSigla}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                          {uInfo?.nome || ''}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {count} pedidos
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, percent * 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div 
            onClick={() => onNavigateToOrders()}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold cursor-pointer hover:underline"
          >
            <span>Ver todas as {units.length} unidades cadastradas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Right Column: Pedidos Prioritários / Atenção Imediata */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Fila Crítica & Emergências</span>
              </h3>
              <span className="text-[11px] text-rose-600 font-bold font-mono">
                {priorityAttentionOrders.length} em destaque
              </span>
            </div>

            <div className="space-y-2.5">
              {priorityAttentionOrders.map((ord, idx) => {
                const sch = ord.cronograma_id ? schedulesMap.get(ord.cronograma_id) : null;
                const { situation, label } = calculateDeadlineSituation(ord, sch, settings.horas_alerta_atencao);
                return (
                  <div
                    key={`${ord.id}-${idx}`}
                    onClick={() => onSelectOrder(ord)}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-blue-700 group-hover:underline">
                        {ord.codigo}
                      </span>
                      <TypeTag type={ord.tipo} />
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">
                        {ord.unidade} · <span className="font-normal text-slate-500">{ord.programa}</span>
                      </span>
                      <span className="font-mono text-slate-600 font-bold">
                        {ord.quantidade_itens} itens
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <StatusBadge status={ord.status_operacional} />
                      <DeadlineBadge situation={situation} label={label} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigateToOrders({ tipo: 'Emergencial' })}
            className="w-full mt-4 py-2.5 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full transition-all border border-rose-200 text-center cursor-pointer shadow-2xs active:scale-98"
          >
            Abrir todos os pedidos emergenciais e de falta →
          </button>
        </div>
      </div>
    </div>
  );
};
