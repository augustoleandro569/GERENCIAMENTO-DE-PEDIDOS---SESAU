import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { Order, Schedule } from '../../types';
import { showToast } from '../common/Toast';
import { TypeTag, StatusBadge } from '../common/StatusBadge';
import { 
  X, 
  Search, 
  Calendar, 
  Link2, 
  Check, 
  Clock, 
  Boxes,
  CheckCircle2
} from 'lucide-react';

interface LinkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string; // YYYY-MM-DD
  dayNumber: number;
  monthNumber: number;
  availableSchedules: Schedule[];
}

export const LinkOrderModal: React.FC<LinkOrderModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  dayNumber,
  monthNumber,
  availableSchedules,
}) => {
  const { orders, currentUser, updateOrder } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('NONE');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  // Phase dates for the linked order
  const [dataSolicitacao, setDataSolicitacao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [dataInicioSeparacao, setDataInicioSeparacao] = useState('');
  const [dataExpedicao, setDataExpedicao] = useState('');
  const [dataEntrega, setDataEntrega] = useState(targetDate);

  useEffect(() => {
    setDataEntrega(targetDate);
  }, [targetDate]);

  // Filter orders that can be linked
  const eligibleOrders = useMemo(() => {
    return orders.filter(order => {
      if (onlyUnlinked && order.cronograma_id) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCode = order.codigo.toLowerCase().includes(q);
        const matchesUnit = order.unidade.toLowerCase().includes(q);
        const matchesRequester = order.solicitante.toLowerCase().includes(q);
        const matchesProgram = order.programa.toLowerCase().includes(q);
        if (!matchesCode && !matchesUnit && !matchesRequester && !matchesProgram) return false;
      }
      return true;
    }).slice(0, 30);
  }, [orders, searchTerm, onlyUnlinked]);

  if (!isOpen) return null;

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const extractDateOnly = (val?: string) => {
    if (!val) return '';
    if (val.includes('T')) return val.split('T')[0];
    if (val.includes(' ')) return val.split(' ')[0];
    return val;
  };

  const handleLink = () => {
    if (!selectedOrderId || !selectedOrder) return;

    const updates: Partial<Order> = {
      data_solicitacao: dataSolicitacao || undefined,
      data_aprovacao: dataAprovacao || undefined,
      data_inicio_separacao: dataInicioSeparacao || undefined,
      data_expedicao: dataExpedicao || undefined,
      data_prevista_entrega: dataEntrega || targetDate,
      validada_em: dataAprovacao ? `${dataAprovacao} 10:00` : selectedOrder.validada_em,
      separado_em: dataInicioSeparacao ? `${dataInicioSeparacao} 14:00` : selectedOrder.separado_em,
      expedido_em: dataExpedicao ? `${dataExpedicao} 16:00` : selectedOrder.expedido_em,
    };

    if (selectedScheduleId !== 'KEEP') {
      if (selectedScheduleId === 'NONE') {
        updates.cronograma_id = null;
        updates.cronograma_vinculo = 'MANUAL';
      } else {
        updates.cronograma_id = selectedScheduleId;
        updates.cronograma_vinculo = 'MANUAL';
      }
    }

    updateOrder(
      selectedOrderId,
      updates,
      currentUser,
      `Vinculado ao dia ${dayNumber}/${monthNumber === 9 ? '09' : '10'} no calendário com datas de etapas configuradas`
    );

    showToast(
      'success',
      `${selectedOrder.codigo} vinculado com sucesso!`,
      `Agendado para o dia ${dayNumber}/${monthNumber === 9 ? '09' : '10'}/2026 com cronograma e datas atualizados.`
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Vincular Pedido ao Dia {dayNumber} de {monthNumber === 9 ? 'Setembro' : 'Outubro'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Data do calendário: <span className="font-mono font-bold text-blue-700">{targetDate}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 flex-1 overflow-y-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: SOL-2026-03074), hospital ou solicitante..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={onlyUnlinked}
                onChange={(e) => setOnlyUnlinked(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4"
              />
              <span>Mostrar apenas pedidos sem cronograma vinculado</span>
            </label>
            <span className="font-mono text-[10px] text-slate-400 font-bold">
              {eligibleOrders.length} resultado(s)
            </span>
          </div>

          {/* List of Orders */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white shadow-2xs">
            {eligibleOrders.length > 0 ? (
              eligibleOrders.map((order, idx) => {
                const isSelected = order.id === selectedOrderId;
                return (
                  <div
                    key={`${order.id}-${idx}`}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setDataSolicitacao(extractDateOnly(order.data_solicitacao || order.criado_em));
                      setDataAprovacao(extractDateOnly(order.data_aprovacao || order.validada_em));
                      setDataInicioSeparacao(extractDateOnly(order.data_inicio_separacao || order.separado_em));
                      setDataExpedicao(extractDateOnly(order.data_expedicao || order.expedido_em));
                      setDataEntrega(targetDate || extractDateOnly(order.data_prevista_entrega));

                      // Try to match available schedule for this order's unit
                      const matchingSch = availableSchedules.find(s => s.unidade === order.unidade);
                      if (matchingSch) {
                        setSelectedScheduleId(matchingSch.id);
                      } else {
                        setSelectedScheduleId('NONE');
                      }
                    }}
                    className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-[11px]">
                            {order.codigo}
                          </span>
                          <span className="font-bold text-slate-800 text-[11px]">
                            · {order.unidade}
                          </span>
                          <TypeTag type={order.tipo} />
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {order.solicitante} · {order.quantidade_itens} itens · {order.programa}
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
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Nenhum pedido encontrado com esses termos.
              </div>
            )}
          </div>

          {/* Schedule Association for the selected order */}
          {selectedOrder && (
            <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 text-xs animate-in fade-in">
              <span className="font-bold text-slate-900 block text-xs">
                Vínculo de Cronograma para {selectedOrder.codigo}:
              </span>

              <select
                value={selectedScheduleId}
                onChange={(e) => {
                  const newSchId = e.target.value;
                  setSelectedScheduleId(newSchId);
                  if (newSchId !== 'NONE') {
                    const found = availableSchedules.find(s => s.id === newSchId);
                    if (found) {
                      if (found.data_limite_solicitacao && !dataSolicitacao) setDataSolicitacao(found.data_limite_solicitacao);
                      if (found.data_limite_aprovacao && !dataAprovacao) setDataAprovacao(found.data_limite_aprovacao);
                      if (found.data_separacao && !dataInicioSeparacao) setDataInicioSeparacao(found.data_separacao);
                      if (found.data_expedicao && !dataExpedicao) setDataExpedicao(found.data_expedicao);
                      if (found.data_entrega) setDataEntrega(found.data_entrega);
                    }
                  }
                }}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="NONE">Apenas agendar a data no Calendário (Sem vincular cronograma)</option>
                {availableSchedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.unidade} — {s.programa} ({s.competencia}) [Entrega: {s.data_entrega}]
                  </option>
                ))}
              </select>

              {/* 5 Operational Phase Dates */}
              <div className="pt-2.5 border-t border-slate-200/80 space-y-2.5">
                <span className="font-bold text-slate-800 block text-xs">
                  Datas das Etapas Operacionais do Pedido:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                      1. Solicitação:
                    </label>
                    <input
                      type="date"
                      value={dataSolicitacao}
                      onChange={(e) => setDataSolicitacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                      2. Aprovação:
                    </label>
                    <input
                      type="date"
                      value={dataAprovacao}
                      onChange={(e) => setDataAprovacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                      3. Início Separação:
                    </label>
                    <input
                      type="date"
                      value={dataInicioSeparacao}
                      onChange={(e) => setDataInicioSeparacao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                      4. Expedição:
                    </label>
                    <input
                      type="date"
                      value={dataExpedicao}
                      onChange={(e) => setDataExpedicao(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-blue-800 block mb-0.5">
                      5. Data de Entrega (Calendário):
                    </label>
                    <input
                      type="date"
                      value={dataEntrega}
                      onChange={(e) => setDataEntrega(e.target.value)}
                      className="w-full text-xs font-mono p-1.5 bg-blue-50 border border-blue-300 text-blue-950 font-bold rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer - Rounded Full Actions */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors rounded-full"
          >
            Cancelar
          </button>

          <button
            onClick={handleLink}
            disabled={!selectedOrderId}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Confirmar Vínculo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
