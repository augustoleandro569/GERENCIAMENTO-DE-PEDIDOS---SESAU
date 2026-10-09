import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { OrderStatus, Priority, RequestType, ProgramName } from '../../types';
import { calculatePickingStartDate, formatShortDate, countBusinessDaysBetween, parseDateSafe } from '../../utils/dateUtils';
import { X, Plus, Sparkles, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({ isOpen, onClose }) => {
  const { units, programs, orderTypes, schedules, currentUser, addOrder, orders } = useStore();

  // Generate next code
  const lastCodeNumber = orders.reduce((max, o) => {
    const match = o.codigo.match(/SOL-2026-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return Math.max(max, num);
    }
    return max;
  }, 3074);

  const defaultCode = `SOL-2026-${String(lastCodeNumber + 1).padStart(5, '0')}`;

  const [codigo, setCodigo] = useState(defaultCode);
  const [tipo, setTipo] = useState<RequestType>('Mensal');
  const [solicitante, setSolicitante] = useState(currentUser.nome);
  const [cpf, setCpf] = useState('000.000.000-00');
  const [programa, setPrograma] = useState<ProgramName>('Hospitalar');
  const [unidade, setUnidade] = useState(units[0]?.sigla || 'HGE');
  const [quantidadeItens, setQuantidadeItens] = useState(15);
  const [dataInicio, setDataInicio] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dataSolicitacao, setDataSolicitacao] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dataLimiteAprovacao, setDataLimiteAprovacao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [dataInicioSeparacao, setDataInicioSeparacao] = useState('');
  const [dataExpedicao, setDataExpedicao] = useState('');
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState('');
  const [isAutoSeparationActive, setIsAutoSeparationActive] = useState(true);

  const [status, setStatus] = useState<OrderStatus>('Aguardando Aprovação');
  const [prioridade, setPrioridade] = useState<Priority>('Normal');
  const [cronogramaId, setCronogramaId] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const cleanCode = codigo.trim().toUpperCase();
  const isCodeStandard = cleanCode.startsWith('SOL-2026-') && cleanCode.length >= 10;
  const isCodeDuplicate = orders.some(o => o.codigo.toUpperCase() === cleanCode);

  const getPresetDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString().split('T')[0];
  };

  const handleDeliveryDateChange = (val: string) => {
    setDataPrevistaEntrega(val);
    if (val) {
      const autoPicking = calculatePickingStartDate(val, 5);
      setDataInicioSeparacao(autoPicking);
      setIsAutoSeparationActive(true);
    }
  };

  const handleRecalculateSeparation = () => {
    if (dataPrevistaEntrega) {
      const autoPicking = calculatePickingStartDate(dataPrevistaEntrega, 5);
      setDataInicioSeparacao(autoPicking);
      setIsAutoSeparationActive(true);
    }
  };

  const handleTipoChange = (newTipo: RequestType) => {
    setTipo(newTipo);
    if (newTipo === 'Emergencial') setPrioridade('Urgente');
    else if (newTipo === 'Falta') setPrioridade('Alta');
    else setPrioridade('Normal');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCodeStandard || isCodeDuplicate) {
      return;
    }

    addOrder(
      {
        codigo: cleanCode,
        tipo,
        solicitante: solicitante.trim(),
        cpf: cpf.trim(),
        programa,
        unidade,
        quantidade_itens: Number(quantidadeItens) || 1,
        criado_em: dataInicio || dataSolicitacao,
        data_inicio: dataInicio || dataSolicitacao,
        data_solicitacao: dataSolicitacao,
        data_limite_aprovacao: dataLimiteAprovacao || undefined,
        data_aprovacao: dataAprovacao || undefined,
        data_inicio_separacao: dataInicioSeparacao || (dataPrevistaEntrega ? calculatePickingStartDate(dataPrevistaEntrega, 5) : undefined),
        data_expedicao: dataExpedicao || undefined,
        data_prevista_entrega: dataPrevistaEntrega || undefined,
        validada_em: dataAprovacao ? `${dataAprovacao} 10:00` : undefined,
        separado_em: dataInicioSeparacao ? `${dataInicioSeparacao} 14:00` : undefined,
        expedido_em: dataExpedicao ? `${dataExpedicao} 16:00` : undefined,
        entregue_em: dataPrevistaEntrega && status === 'Entregue' ? `${dataPrevistaEntrega} 17:00` : undefined,
        status_origem: status,
        status_operacional: status,
        prioridade,
        cronograma_id: cronogramaId ? cronogramaId : null,
        cronograma_vinculo: cronogramaId ? 'MANUAL' : 'AUTOMÁTICO',
        observacoes: observacoes.trim(),
        origem: 'MANUAL',
        historico_original: `${dataSolicitacao} – Criada manualmente por ${currentUser.nome}`,
      },
      currentUser
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              +
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Novo Pedido Manual</h3>
              <p className="text-[11px] text-slate-500">Cadastro de solicitação com origem MANUAL e datas personalizadas</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Row 1: Código & Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Código da Solicitação *
                </label>
                <button
                  type="button"
                  onClick={() => setCodigo(defaultCode)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Gerar Próximo Disponível
                </button>
              </div>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="SOL-2026-XXXXX"
                className={`w-full text-xs font-mono font-bold px-3 py-2 border rounded-xl focus:bg-white focus:outline-none transition-all ${
                  !isCodeStandard 
                    ? 'bg-amber-50/60 border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500/20'
                    : isCodeDuplicate
                    ? 'bg-rose-50/60 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {!isCodeStandard && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  Padrão obrigatório: o código deve iniciar com <strong>SOL-2026-</strong> (ex: {defaultCode}).
                </p>
              )}
              {isCodeStandard && isCodeDuplicate && (
                <p className="text-[11px] text-rose-700 font-bold mt-1">
                  Já existe um pedido cadastrado com o número {cleanCode}. O sistema não permite numeração duplicada.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tipo de Pedido *
              </label>
              <select
                value={tipo}
                onChange={(e) => handleTipoChange(e.target.value as RequestType)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
              >
                {orderTypes.map(t => (
                  <option key={t.id} value={t.nome}>{t.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Unidade & Programa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Unidade Solicitante *
              </label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
              >
                {units.map(u => (
                  <option key={u.id} value={u.sigla}>
                    {u.sigla} - {u.nome.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Programa *
              </label>
              <select
                value={programa}
                onChange={(e) => setPrograma(e.target.value as ProgramName)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
              >
                {programs.map(p => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Solicitante & CPF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nome do Solicitante *
              </label>
              <input
                type="text"
                required
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                CPF do Solicitante
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Row 4: Itens, Prioridade & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Qtd. de Itens *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantidadeItens}
                onChange={(e) => setQuantidadeItens(parseInt(e.target.value, 10) || 1)}
                className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Prioridade
              </label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as Priority)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
              >
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
              >
                <option value="Aguardando Aprovação">Aguardando Aprovação</option>
                <option value="Rascunho">Rascunho</option>
                <option value="Aprovada">Aprovada</option>
                <option value="Em Separação">Em Separação</option>
              </select>
            </div>
          </div>

          {/* Row: Datas do Ciclo Operacional - Rounded Card */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Datas das Etapas & Controle de Prazos</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-200/60 px-2 py-0.5 rounded-full">
                Controle Operacional SESAU
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {/* Data 0: Inicialização */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">
                    Data Inicialização *
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setDataInicio(getPresetDate(0))} 
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Hoje
                  </button>
                </div>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-blue-900"
                />
              </div>

              {/* Data 1: Solicitação (Informativa - sem tag no calendário) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Data Solicitação *</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setDataSolicitacao(getPresetDate(0))} 
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Hoje
                  </button>
                </div>
                <input
                  type="date"
                  required
                  value={dataSolicitacao}
                  onChange={(e) => setDataSolicitacao(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                <span className="text-[9px] text-slate-600 block italic leading-tight">
                  Informativo · sem tag no calendário
                </span>
              </div>

              {/* Data 2: Limite de Aprovação (Informativa - sem tag no calendário) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">
                    Limite de Aprovação
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setDataLimiteAprovacao(getPresetDate(1))} 
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    +1d
                  </button>
                </div>
                <input
                  type="date"
                  value={dataLimiteAprovacao}
                  onChange={(e) => setDataLimiteAprovacao(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                <span className="text-[9px] text-slate-600 block italic leading-tight">
                  Informativo · sem tag no calendário
                </span>
              </div>

              {/* Prazo de Entrega (Gera tag no calendário e dispara o cálculo de 5 dias úteis) */}
              <div className="space-y-1 sm:col-span-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-blue-900">
                    Prazo de Entrega *
                  </label>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => handleDeliveryDateChange(getPresetDate(5))} 
                      className="text-[10px] text-blue-700 font-bold hover:underline"
                    >
                      +5d
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleDeliveryDateChange(getPresetDate(7))} 
                      className="text-[10px] text-blue-700 font-bold hover:underline"
                    >
                      +7d
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleDeliveryDateChange(getPresetDate(10))} 
                      className="text-[10px] text-blue-700 font-bold hover:underline"
                    >
                      +10d
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={dataPrevistaEntrega}
                  onChange={(e) => handleDeliveryDateChange(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-1.5 bg-blue-50/70 border border-blue-300 rounded-xl text-blue-950 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-[9px] text-blue-600 block font-semibold leading-tight">
                  Marcos no calendário unificado
                </span>
              </div>

              {/* Início de Separação - AUTO PREENCHIDA COM 5 DIAS ÚTEIS ANTES DA ENTREGA */}
              <div className="space-y-1 sm:col-span-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                    <span>Início de Separação</span>
                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">
                      Automático (-5 dias úteis)
                    </span>
                  </label>
                  {dataPrevistaEntrega && (
                    <button 
                      type="button" 
                      onClick={handleRecalculateSeparation} 
                      className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
                      title="Recalcular 5 dias úteis antes da data de entrega"
                    >
                      ⚡ Recalcular (5d úteis)
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={dataInicioSeparacao}
                  onChange={(e) => {
                    setDataInicioSeparacao(e.target.value);
                    setIsAutoSeparationActive(false);
                  }}
                  className="w-full text-xs font-mono px-3 py-1.5 bg-indigo-50/60 border border-indigo-300 rounded-xl text-indigo-950 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="flex items-center justify-between text-[10px] text-indigo-700">
                  <span>
                    {dataInicioSeparacao && dataPrevistaEntrega
                      ? `Inicia em ${formatShortDate(dataInicioSeparacao)} para entrega em ${formatShortDate(dataPrevistaEntrega)}`
                      : 'Calculada automaticamente ao definir o prazo de entrega'}
                  </span>
                  {dataInicioSeparacao && (
                    <span className="font-semibold text-[9px] text-slate-500">
                      Dispara alerta se não iniciada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Alert Control Preview */}
            {dataPrevistaEntrega && dataInicioSeparacao && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">
                      Controle Interativo de Alerta de Separação
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-bold">
                      Regra: 5 Dias Úteis
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    A demanda deve ser iniciada até <strong className="text-indigo-900 font-mono">{formatShortDate(dataInicioSeparacao)}</strong>. Se não for iniciada com 5 dias úteis de antecedência do prazo de entrega (<strong className="text-blue-900 font-mono">{formatShortDate(dataPrevistaEntrega)}</strong>), o sistema emitirá alertas progressivos sinalizando risco de atraso na expedição!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Cronograma */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Vínculo com Cronograma Operacional
            </label>
            <select
              value={cronogramaId}
              onChange={(e) => setCronogramaId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            >
              <option value="">Detecção Automática (baseado em Unidade + Programa + Tipo)</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.competencia})
                </option>
              ))}
            </select>
          </div>

          {/* Row 6: Observações */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Observações Operacionais
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Instruções de entrega, leitos destinatários ou especificações de lote..."
              className="w-full text-xs p-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isCodeStandard || isCodeDuplicate}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-full shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Pedido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
