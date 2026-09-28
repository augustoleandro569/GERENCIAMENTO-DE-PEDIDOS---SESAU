import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, OrderStatus } from '../../types';
import { calculateDeadlineSituation, formatDate, formatShortDate } from '../../utils/dateUtils';
import { StatusBadge, TypeTag, DeadlineBadge, PriorityBadge, InlineStatusSelect } from '../common/StatusBadge';
import { showToast } from '../common/Toast';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Package, 
  Boxes, 
  Send, 
  ShieldCheck, 
  History, 
  FileText, 
  Link2, 
  User, 
  Building, 
  Tag, 
  AlertTriangle,
  Zap,
  Check,
  CalendarCheck,
  Sparkles
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
  const { schedules, auditLogs, updateOperationalStatus, updateOrder, currentUser, settings } = useStore();

  const [activeTab, setActiveTab] = useState<'resumo' | 'cronograma' | 'historico' | 'observacoes' | 'auditoria'>('resumo');
  const [observationInput, setObservationInput] = useState('');
  const [statusSuccessFeedback, setStatusSuccessFeedback] = useState(false);

  // Operational Cycle Dates local state
  const [dataInicio, setDataInicio] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [dataInicioSeparacao, setDataInicioSeparacao] = useState('');
  const [dataExpedicao, setDataExpedicao] = useState('');
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState('');

  // Schedule link state
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('NONE');

  // Helper to extract YYYY-MM-DD
  const extractDateOnly = (val?: string) => {
    if (!val) return '';
    if (val.includes('T')) return val.split('T')[0];
    if (val.includes(' ')) return val.split(' ')[0];
    return val;
  };

  const getPresetDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (order) {
      setDataInicio(extractDateOnly(order.data_inicio || order.data_solicitacao || order.criado_em));
      setDataSolicitacao(extractDateOnly(order.data_solicitacao || order.criado_em));
      setDataAprovacao(extractDateOnly(order.data_aprovacao || order.validada_em || order.validado_em));
      setDataInicioSeparacao(extractDateOnly(order.data_inicio_separacao || order.separado_em));
      setDataExpedicao(extractDateOnly(order.data_expedicao || order.expedido_em));
      setDataPrevistaEntrega(extractDateOnly(order.data_prevista_entrega || order.entregue_em));
      setSelectedScheduleId(order.cronograma_id || 'NONE');
    }
  }, [order]);

  if (!order) return null;

  const schedule = order.cronograma_id 
    ? schedules.find(s => s.id === order.cronograma_id) 
    : null;

  const orderAuditLogs = auditLogs.filter(l => l.pedido_id === order.id);
  const { situation, label } = calculateDeadlineSituation(order, schedule, settings.horas_alerta_atencao);

  const handleSaveDatesAndSchedule = () => {
    const updates: Partial<Order> = {
      cronograma_id: selectedScheduleId === 'NONE' ? undefined : selectedScheduleId,
      cronograma_vinculo: selectedScheduleId === 'NONE' ? 'NENHUM' : 'MANUAL',
      data_inicio: dataInicio || undefined,
      data_solicitacao: dataSolicitacao || undefined,
      data_aprovacao: dataAprovacao || undefined,
      data_inicio_separacao: dataInicioSeparacao || undefined,
      data_expedicao: dataExpedicao || undefined,
      data_prevista_entrega: dataPrevistaEntrega || undefined,
      validada_em: dataAprovacao ? `${dataAprovacao} 10:00` : order.validada_em,
      separado_em: dataInicioSeparacao ? `${dataInicioSeparacao} 14:00` : order.separado_em,
      expedido_em: dataExpedicao ? `${dataExpedicao} 16:00` : order.expedido_em,
      entregue_em: (order.status_operacional === 'Entregue' && dataPrevistaEntrega) ? `${dataPrevistaEntrega} 17:00` : order.entregue_em,
    };

    updateOrder(order.id, updates, currentUser, 'Atualização das datas operacionais e inicialização do pedido');
    showToast('success', `${order.codigo} atualizado`, 'Data de inicialização, solicitação e ciclo operacional salvas com sucesso.');
  };

  const handleQuickStatusChange = (newStatus: OrderStatus) => {
    updateOperationalStatus(order.id, newStatus, currentUser, 'Alteração direta via painel do pedido');
    setStatusSuccessFeedback(true);
    showToast('success', `${order.codigo} atualizado`, `Status operacional alterado para: ${newStatus}`);
    setTimeout(() => setStatusSuccessFeedback(false), 2500);
  };

  const handleSaveObservation = () => {
    if (!observationInput.trim()) return;
    const currentObs = order.observacoes ? `${order.observacoes}\n\n` : '';
    const newEntry = `[${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${currentUser.nome}]: ${observationInput.trim()}`;
    updateOrder(order.id, { observacoes: currentObs + newEntry }, currentUser, 'Nova observação adicionada');
    showToast('info', 'Anotação registrada', `Nova observação gravada em ${order.codigo}`);
    setObservationInput('');
  };

  // Operational Timeline Stages
  const stages: {
    id: string;
    name: string;
    targetStatus: OrderStatus;
    done: boolean;
    date?: string | null;
    responsible: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'inicializacao',
      name: 'Inicialização do Pedido',
      targetStatus: 'Aguardando Aprovação',
      done: true,
      date: dataInicio || order.data_inicio || dataSolicitacao || order.criado_em,
      responsible: order.solicitante,
      icon: Sparkles,
    },
    {
      id: 'criacao',
      name: 'Solicitação',
      targetStatus: 'Aguardando Aprovação',
      done: true,
      date: dataSolicitacao || order.data_solicitacao || order.criado_em,
      responsible: order.solicitante,
      icon: FileText,
    },
    {
      id: 'aprovacao',
      name: 'Aprovação',
      targetStatus: 'Aprovada',
      done: !!order.validador || ['Aprovada', 'Aguardando Separação', 'Em Separação', 'Aguardando Conferência', 'Em Conferência', 'Expedida', 'Em Transporte', 'Entregue'].includes(order.status_operacional),
      date: dataAprovacao || order.data_aprovacao || order.validada_em,
      responsible: order.validador || 'Pendente',
      icon: Clock,
    },
    {
      id: 'separacao',
      name: 'Separação',
      targetStatus: 'Em Separação',
      done: !!order.separador || ['Aguardando Conferência', 'Em Conferência', 'Expedida', 'Em Transporte', 'Entregue'].includes(order.status_operacional),
      date: dataInicioSeparacao || order.data_inicio_separacao || order.separado_em,
      responsible: order.separador || (order.status_operacional === 'Em Separação' ? 'Em andamento' : 'Pendente'),
      icon: Boxes,
    },
    {
      id: 'conferencia',
      name: 'Conferência',
      targetStatus: 'Em Conferência',
      done: !!order.conferente || ['Expedida', 'Em Transporte', 'Entregue'].includes(order.status_operacional),
      date: order.conferido_em,
      responsible: order.conferente || 'Pendente',
      icon: CheckCircle2,
    },
    {
      id: 'expedicao',
      name: 'Expedição',
      targetStatus: 'Expedida',
      done: !!order.expedidor || ['Em Transporte', 'Entregue'].includes(order.status_operacional),
      date: dataExpedicao || order.data_expedicao || order.expedido_em,
      responsible: order.expedidor || 'Pendente',
      icon: Package,
    },
    {
      id: 'transporte',
      name: 'Transporte',
      targetStatus: 'Em Transporte',
      done: !!order.entregador || order.status_operacional === 'Entregue',
      date: null,
      responsible: order.entregador || (order.status_operacional === 'Em Transporte' ? 'Em rota' : 'Pendente'),
      icon: Truck,
    },
    {
      id: 'entrega',
      name: 'Entrega',
      targetStatus: 'Entregue',
      done: order.status_operacional === 'Entregue' || order.status_origem === 'Entregue',
      date: dataPrevistaEntrega || order.data_prevista_entrega || order.entregue_em,
      responsible: order.entregador || 'Aguardando',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Fast Status Changer - Rounded Top */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-base font-bold text-slate-900">
                {order.codigo}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                {order.origem}
              </span>
              <TypeTag type={order.tipo} />
              <PriorityBadge priority={order.prioridade} />
              <DeadlineBadge situation={situation} label={label} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-bold text-slate-900">{order.unidade}</span>
              <span>·</span>
              <span>{order.programa}</span>
              <span>·</span>
              <span className="font-mono font-bold text-slate-800">{order.quantidade_itens} itens</span>
              <span>·</span>
              <span>Solicitado em {formatDate(dataSolicitacao || order.criado_em)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Status Selector Right on Header */}
            <div className="bg-white p-2 px-3 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-600" />
                <span>Mudar Status Operacional:</span>
              </div>
              <InlineStatusSelect
                currentStatus={order.status_operacional}
                onStatusChange={handleQuickStatusChange}
                disabled={currentUser.role === 'VIEWER'}
              />
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {statusSuccessFeedback && (
          <div className="bg-emerald-50 text-emerald-900 px-6 py-2 text-xs font-bold flex items-center gap-2 border-b border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Status operacional atualizado com sucesso para: <strong>{order.status_operacional}</strong>!</span>
          </div>
        )}

        {/* Stepper with Live Stage Dates - Rounded Container */}
        <div className="p-4 bg-white border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[700px]">
            {stages.map((st, idx) => {
              const Icon = st.icon;
              return (
                <div key={st.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (currentUser.role !== 'VIEWER') {
                          handleQuickStatusChange(st.targetStatus);
                        }
                      }}
                      disabled={currentUser.role === 'VIEWER'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        st.done 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                      title={`Clique para avançar status para: ${st.targetStatus}`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                    <span className={`text-[10px] font-bold mt-1.5 ${st.done ? 'text-blue-700' : 'text-slate-400'}`}>
                      {st.name}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap font-medium">
                      {st.date ? formatShortDate(st.date) : '—'}
                    </span>
                  </div>
                  {idx < stages.length - 1 && (
                    <div className={`h-1 w-7 shrink-0 -mt-6 rounded-full ${stages[idx + 1].done ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs Bar - Rounded Full Segmented Navigation */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50/70 overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-full border border-slate-200/50 w-fit">
            {[
              { id: 'resumo', label: 'Resumo da Solicitação' },
              { id: 'cronograma', label: 'Datas das Etapas & Cronograma' },
              { id: 'historico', label: `Histórico (${order.eventos?.length || 0})` },
              { id: 'observacoes', label: 'Anotações' },
              { id: 'auditoria', label: `Auditoria (${orderAuditLogs.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-900 shadow-xs scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* TAB: RESUMO */}
          {activeTab === 'resumo' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dados da Unidade & Solicitante</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p><span className="text-slate-500 font-medium">Unidade:</span> <strong>{order.unidade}</strong></p>
                    <p><span className="text-slate-500 font-medium">Programa:</span> <strong>{order.programa}</strong></p>
                    <p><span className="text-slate-500 font-medium">Solicitante:</span> <strong>{order.solicitante}</strong></p>
                    {order.cpf && <p><span className="text-slate-500 font-medium">CPF:</span> <span className="font-mono">{order.cpf}</span></p>}
                    <p><span className="text-slate-500 font-medium">Tipo de Pedido:</span> <span className="font-semibold">{order.tipo}</span></p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Controle de Prazos & SLA</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p><span className="text-slate-500 font-medium">Situação SLA:</span> <DeadlineBadge situation={situation} label={label} /></p>
                    <p><span className="text-slate-500 font-medium">Cronograma Vinculado:</span> <strong>{schedule ? schedule.nome : (order.cronograma_vinculo || 'Sob Demanda')}</strong></p>
                    <p><span className="text-slate-500 font-medium">Data Prevista de Entrega:</span> <strong className="font-mono text-blue-700">{dataPrevistaEntrega ? formatShortDate(dataPrevistaEntrega) : 'Não agendada'}</strong></p>
                    <p><span className="text-slate-500 font-medium">Validador SESAU:</span> <span>{order.validador || 'Pendente de validação'}</span></p>
                  </div>
                </div>
              </div>

              {/* Quick Summary of 5 Lifecycle Dates */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mapeamento das 5 Datas Operacionais</span>
                  </h4>
                  <button
                    onClick={() => setActiveTab('cronograma')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Editar datas →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                  <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200/80">
                    <span className="text-[10px] text-blue-700 block font-bold flex items-center justify-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                      Inicialização
                    </span>
                    <span className="font-mono font-bold text-blue-900 block text-xs mt-1">
                      {dataInicio ? formatShortDate(dataInicio) : (dataSolicitacao ? formatShortDate(dataSolicitacao) : '—')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block font-medium">1. Solicitação</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs mt-1">
                      {dataSolicitacao ? formatShortDate(dataSolicitacao) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block font-medium">2. Aprovação</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs mt-1">
                      {dataAprovacao ? formatShortDate(dataAprovacao) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block font-medium">3. Separação</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs mt-1">
                      {dataInicioSeparacao ? formatShortDate(dataInicioSeparacao) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block font-medium">4. Expedição</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs mt-1">
                      {dataExpedicao ? formatShortDate(dataExpedicao) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                    <span className="text-[10px] text-emerald-700 block font-bold">5. Entrega</span>
                    <span className="font-mono font-bold text-emerald-900 block text-xs mt-1">
                      {dataPrevistaEntrega ? formatShortDate(dataPrevistaEntrega) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DATAS DAS ETAPAS & CRONOGRAMA */}
          {activeTab === 'cronograma' && (
            <div className="space-y-4">
              {/* Card 1: Configuration of All 5 Lifecycle Dates with Quick Presets */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Datas das Etapas do Pedido
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Informe as datas das fases operacionais ou use os botões rápidos de preenchimento
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 font-bold">
                    Ciclo Completo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                  {/* Data 0: Inicialização */}
                  <div className="space-y-1.5 p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>Data de Inicialização:</span>
                      </label>
                      <button 
                        type="button"
                        onClick={() => setDataInicio(getPresetDate(0))}
                        className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 px-1.5 py-0.5 rounded-full hover:bg-blue-100"
                      >
                        Hoje
                      </button>
                    </div>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-blue-300 rounded-xl p-2 text-blue-950 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Data 1: Solicitação */}
                  <div className="space-y-1.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        1. Data de Solicitação:
                      </label>
                      <button 
                        type="button"
                        onClick={() => setDataSolicitacao(getPresetDate(0))}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-full hover:bg-blue-50"
                      >
                        Hoje
                      </button>
                    </div>
                    <input
                      type="date"
                      value={dataSolicitacao}
                      onChange={(e) => setDataSolicitacao(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Data 2: Aprovação */}
                  <div className="space-y-1.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        2. Data de Aprovação:
                      </label>
                      <button 
                        type="button"
                        onClick={() => setDataAprovacao(getPresetDate(0))}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-full hover:bg-blue-50"
                      >
                        Hoje
                      </button>
                    </div>
                    <input
                      type="date"
                      value={dataAprovacao}
                      onChange={(e) => setDataAprovacao(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Data 3: Inicialização de Separação */}
                  <div className="space-y-1.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        3. Inicialização Separação:
                      </label>
                      <button 
                        type="button"
                        onClick={() => setDataInicioSeparacao(getPresetDate(0))}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-full hover:bg-blue-50"
                      >
                        Hoje
                      </button>
                    </div>
                    <input
                      type="date"
                      value={dataInicioSeparacao}
                      onChange={(e) => setDataInicioSeparacao(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Data 4: Expedição */}
                  <div className="space-y-1.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        4. Data de Expedição:
                      </label>
                      <div className="flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => setDataExpedicao(getPresetDate(0))}
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-full hover:bg-blue-50"
                        >
                          Hoje
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDataExpedicao(getPresetDate(1))}
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-full hover:bg-blue-50"
                        >
                          +1d
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={dataExpedicao}
                      onChange={(e) => setDataExpedicao(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Data 5: Entrega (Prevista / Efetiva) */}
                  <div className="space-y-1.5 p-3 bg-blue-50/60 rounded-2xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-800">
                        5. Data de Entrega (Calendário):
                      </label>
                      <div className="flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => setDataPrevistaEntrega(getPresetDate(0))}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-1.5 py-0.5 rounded-full hover:bg-blue-100"
                        >
                          Hoje
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDataPrevistaEntrega(getPresetDate(3))}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-1.5 py-0.5 rounded-full hover:bg-blue-100"
                        >
                          +3d
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDataPrevistaEntrega(getPresetDate(7))}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-1.5 py-0.5 rounded-full hover:bg-blue-100"
                        >
                          +7d
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={dataPrevistaEntrega}
                      onChange={(e) => setDataPrevistaEntrega(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-blue-300 rounded-xl p-2 text-blue-950 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    As datas salvas reposicionam o pedido no calendário unificado e atualizam os marcos do stepper.
                  </span>
                  <button
                    onClick={handleSaveDatesAndSchedule}
                    disabled={currentUser.role === 'VIEWER'}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Datas do Pedido</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Interactive Schedule Linking */}
              <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Vínculo com Cronograma Operacional Oficial
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Vincule este pedido a um cronograma homologado da SESAU
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Selecione o Cronograma da Unidade:
                  </label>
                  <select
                    value={selectedScheduleId}
                    onChange={(e) => {
                      const newSchId = e.target.value;
                      setSelectedScheduleId(newSchId);
                      if (newSchId !== 'NONE') {
                        const found = schedules.find(s => s.id === newSchId);
                        if (found) {
                          if (found.data_limite_solicitacao && !dataSolicitacao) setDataSolicitacao(found.data_limite_solicitacao);
                          if (found.data_limite_aprovacao && !dataAprovacao) setDataAprovacao(found.data_limite_aprovacao);
                          if (found.data_separacao && !dataInicioSeparacao) setDataInicioSeparacao(found.data_separacao);
                          if (found.data_expedicao && !dataExpedicao) setDataExpedicao(found.data_expedicao);
                          if (found.data_entrega && !dataPrevistaEntrega) setDataPrevistaEntrega(found.data_entrega);
                        }
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="NONE">Sem Cronograma (Regime Sob Demanda / Falta)</option>
                    {schedules.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.unidade} — {s.programa} ({s.competencia}) [Entrega: {s.data_entrega}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                  <span className="text-[11px] text-slate-500">
                    O vínculo recalcula o SLA e sincroniza os prazos máximos com as datas limites do cronograma.
                  </span>
                  <button
                    onClick={handleSaveDatesAndSchedule}
                    disabled={currentUser.role === 'VIEWER'}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Salvar Vínculo</span>
                  </button>
                </div>
              </div>

              {schedule && (
                <div className="border border-slate-200/80 rounded-3xl overflow-hidden bg-white shadow-xs">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{schedule.nome}</h4>
                      <p className="text-[11px] text-slate-500">
                        Competência {schedule.competencia} · {schedule.unidade}
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      ATIVO
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Limite Solicitação</span>
                      <strong className="font-mono text-slate-800">{formatShortDate(schedule.data_limite_solicitacao)}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Limite Aprovação</span>
                      <strong className="font-mono text-slate-800">{formatShortDate(schedule.data_limite_aprovacao)}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Separação Prevista</span>
                      <strong className="font-mono text-slate-800">{formatShortDate(schedule.data_separacao)}</strong>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Expedição Prevista</span>
                      <strong className="font-mono text-slate-800">{formatShortDate(schedule.data_expedicao)}</strong>
                    </div>
                    <div className="p-2.5 bg-blue-50/80 rounded-2xl border border-blue-200">
                      <span className="text-[10px] text-blue-700 font-bold block">Entrega Prevista</span>
                      <strong className="font-mono text-blue-900">{formatShortDate(schedule.data_entrega)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Eventos e Marcos Registrados
              </h4>
              <div className="border border-slate-200/80 rounded-3xl divide-y divide-slate-100 overflow-hidden bg-white shadow-xs">
                {order.eventos && order.eventos.length > 0 ? (
                  order.eventos.map((ev, idx) => (
                    <div key={idx} className="p-3.5 text-xs flex items-start gap-3 hover:bg-slate-50/80 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 font-bold">{ev.tipo_evento || ev.status}</strong>
                          <span className="text-[11px] font-mono text-slate-400">{formatDate(ev.data_evento)}</span>
                        </div>
                        {ev.observacao && <p className="text-slate-600 mt-1">{ev.observacao}</p>}
                        {ev.responsavel && (
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                            Responsável: {ev.responsavel}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Nenhum evento registrado no histórico deste pedido.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ANOTAÇÕES */}
          {activeTab === 'observacoes' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Adicionar Nova Anotação / Ocorrência
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={observationInput}
                    onChange={(e) => setObservationInput(e.target.value)}
                    placeholder="Digite observações operacionais sobre divergência, priorização ou transporte..."
                    className="flex-1 text-xs p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={handleSaveObservation}
                    disabled={!observationInput.trim()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-full flex items-center gap-1.5 self-end transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gravar</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Histórico de Anotações
                </h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-mono whitespace-pre-wrap text-slate-700 max-h-48 overflow-y-auto">
                  {order.observacoes || 'Nenhuma observação registrada.'}
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDITORIA */}
          {activeTab === 'auditoria' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Trilha de Auditoria (Quem alterou e quando)</span>
              </h4>

              <div className="border border-slate-200/80 rounded-3xl divide-y divide-slate-100 overflow-hidden bg-white max-h-64 overflow-y-auto shadow-xs">
                {orderAuditLogs.length > 0 ? (
                  orderAuditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 text-xs flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">Alterado: {log.campo_alterado}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                            {log.usuario}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          {log.valor_anterior || '(vazio)'} → {log.novo_valor}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {formatDate(log.data_hora)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Nenhum registro de auditoria gravado para este pedido.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
