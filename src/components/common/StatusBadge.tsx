import React, { useState, useRef, useEffect } from 'react';
import { OrderStatus, DeadlineSituation, Priority, RequestType } from '../../types';
import { 
  Clock, 
  CheckCircle2, 
  Truck, 
  PackageCheck, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  FileEdit,
  ClipboardCheck,
  Boxes,
  ChevronDown,
  Check
} from 'lucide-react';

export function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case 'Rascunho':
      return { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200/80' };
    case 'Aguardando Validação':
    case 'Aguardando Aprovação':
      return { dot: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50/70', border: 'border-amber-200/70' };
    case 'Aprovado':
    case 'Aprovada':
      return { dot: 'bg-blue-600', text: 'text-blue-800', bg: 'bg-blue-50/70', border: 'border-blue-200/70' };
    case 'Aguardando Separação':
      return { dot: 'bg-indigo-500', text: 'text-indigo-800', bg: 'bg-indigo-50/70', border: 'border-indigo-200/70' };
    case 'Em Separação':
      return { dot: 'bg-purple-600', text: 'text-purple-800', bg: 'bg-purple-50/70', border: 'border-purple-200/70' };
    case 'Aguardando Conferência':
      return { dot: 'bg-violet-500', text: 'text-violet-800', bg: 'bg-violet-50/70', border: 'border-violet-200/70' };
    case 'Em Conferência':
      return { dot: 'bg-teal-600', text: 'text-teal-800', bg: 'bg-teal-50/70', border: 'border-teal-200/70' };
    case 'Expedida':
      return { dot: 'bg-cyan-600', text: 'text-cyan-800', bg: 'bg-cyan-50/70', border: 'border-cyan-200/70' };
    case 'Em Transporte':
      return { dot: 'bg-orange-500', text: 'text-orange-800', bg: 'bg-orange-50/70', border: 'border-orange-200/70' };
    case 'Entregue':
      return { dot: 'bg-emerald-600', text: 'text-emerald-800', bg: 'bg-emerald-50/70', border: 'border-emerald-200/70' };
    case 'Entregue Parcialmente':
      return { dot: 'bg-lime-600', text: 'text-lime-800', bg: 'bg-lime-50/70', border: 'border-lime-200/70' };
    case 'Rejeitada':
      return { dot: 'bg-rose-600', text: 'text-rose-800', bg: 'bg-rose-50/70', border: 'border-rose-200/70' };
    case 'Cancelado':
    case 'Cancelada':
      return { dot: 'bg-neutral-400', text: 'text-neutral-600', bg: 'bg-neutral-50', border: 'border-neutral-200' };
    default:
      return { dot: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
}

export function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case 'Rascunho':
      return <FileEdit className="w-3 h-3 shrink-0" />;
    case 'Aguardando Validação':
    case 'Aguardando Aprovação':
      return <Clock className="w-3 h-3 shrink-0" />;
    case 'Aprovado':
    case 'Aprovada':
      return <ClipboardCheck className="w-3 h-3 shrink-0" />;
    case 'Em Separação':
    case 'Aguardando Separação':
      return <Boxes className="w-3 h-3 shrink-0" />;
    case 'Em Transporte':
    case 'Expedida':
      return <Truck className="w-3 h-3 shrink-0" />;
    case 'Entregue':
    case 'Entregue Parcialmente':
      return <PackageCheck className="w-3 h-3 shrink-0" />;
    case 'Rejeitada':
    case 'Cancelado':
    case 'Cancelada':
      return <XCircle className="w-3 h-3 shrink-0" />;
    default:
      return <Clock className="w-3 h-3 shrink-0" />;
  }
}

export const StatusBadge: React.FC<{ status: OrderStatus; size?: 'sm' | 'md' }> = ({ status }) => {
  const s = getStatusStyle(status);
  const icon = getStatusIcon(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${s.bg} ${s.text} ${s.border} whitespace-nowrap tracking-tight shadow-2xs hover:shadow-xs transition-all`}
      title={`Status: ${status}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span>{status}</span>
    </span>
  );
};

export const ALL_STATUSES: OrderStatus[] = [
  'Rascunho',
  'Aguardando Validação',
  'Aguardando Aprovação',
  'Aprovado',
  'Aprovada',
  'Aguardando Separação',
  'Em Separação',
  'Aguardando Conferência',
  'Em Conferência',
  'Expedida',
  'Em Transporte',
  'Entregue',
  'Entregue Parcialmente',
  'Cancelado',
  'Cancelada',
  'Rejeitada',
];

/**
 * Inline Fast Status Selector: Refined, elegant, hairline border
 */
export const InlineStatusSelect: React.FC<{
  currentStatus: OrderStatus;
  onStatusChange: (newStatus: OrderStatus) => void;
  disabled?: boolean;
}> = ({ currentStatus, onStatusChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const s = getStatusStyle(currentStatus);

  if (disabled) {
    return <StatusBadge status={currentStatus} />;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${s.bg} ${s.text} ${s.border} hover:bg-white hover:border-blue-400 hover:shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap`}
        title="Clique para alterar status rapidamente"
      >
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          <span>{currentStatus}</span>
        </span>
        <ChevronDown className={`w-3 h-3 opacity-60 ml-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            Mudar Status:
          </div>
          {ALL_STATUSES.map((st) => {
            const isSelected = st === currentStatus;
            const itemStyle = getStatusStyle(st);
            return (
              <button
                key={st}
                type="button"
                onClick={() => {
                  onStatusChange(st);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-all rounded-lg mx-1 w-[calc(100%-8px)] ${
                  isSelected ? 'bg-blue-50/80 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${itemStyle.dot}`} />
                  <span>{st}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DeadlineBadge: React.FC<{ situation: DeadlineSituation; label?: string }> = ({ situation, label }) => {
  let style = 'text-slate-600 bg-slate-50 border-slate-200/70';
  let dot = 'bg-slate-400';

  switch (situation) {
    case 'Dentro do prazo':
      style = 'text-emerald-800 bg-emerald-50/70 border-emerald-200/70';
      dot = 'bg-emerald-500';
      break;
    case 'Atenção':
      style = 'text-amber-800 bg-amber-50/70 border-amber-200/70 font-medium';
      dot = 'bg-amber-500';
      break;
    case 'Atrasado':
      style = 'text-red-800 bg-red-50/70 border-red-200/70 font-semibold';
      dot = 'bg-red-500 animate-pulse';
      break;
    case 'Concluído no prazo':
      style = 'text-teal-800 bg-teal-50/70 border-teal-200/70';
      dot = 'bg-teal-500';
      break;
    case 'Concluído com atraso':
      style = 'text-orange-800 bg-orange-50/70 border-orange-200/70';
      dot = 'bg-orange-500';
      break;
    case 'Fora do cronograma':
      style = 'text-slate-500 bg-slate-50 border-slate-200/70';
      dot = 'bg-slate-400';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border ${style} whitespace-nowrap tracking-tight shadow-2xs hover:shadow-xs transition-all`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label || situation}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  switch (priority) {
    case 'Urgente':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rose-800 bg-rose-50/80 border border-rose-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping opacity-75" />
          Urgente
        </span>
      );
    case 'Alta':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-amber-800 bg-amber-50/80 border border-amber-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Alta
        </span>
      );
    case 'Normal':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-slate-500 bg-slate-50 border border-slate-200/60">
          Normal
        </span>
      );
    case 'Baixa':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-slate-400 bg-slate-50/50 border border-slate-100">
          Baixa
        </span>
      );
  }
};

export const TypeTag: React.FC<{ type: RequestType }> = ({ type }) => {
  let style = 'text-slate-600 bg-slate-50 border-slate-200/80';
  let dot = 'bg-slate-400';

  if (type === 'Emergencial') {
    style = 'text-rose-800 bg-rose-50/90 border-rose-200 font-semibold';
    dot = 'bg-rose-500';
  } else if (type === 'Falta') {
    style = 'text-amber-800 bg-amber-50/90 border-amber-200 font-medium';
    dot = 'bg-amber-500';
  } else if (type === 'Mensal') {
    style = 'text-blue-800 bg-blue-50/80 border-blue-200/80';
    dot = 'bg-blue-600';
  } else if (type === 'Semanal') {
    style = 'text-teal-800 bg-teal-50/80 border-teal-200/80';
    dot = 'bg-teal-600';
  } else if (type === 'Quinzenal') {
    style = 'text-purple-800 bg-purple-50/80 border-purple-200/80';
    dot = 'bg-purple-600';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${style} whitespace-nowrap tracking-tight shadow-2xs hover:shadow-xs transition-all`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{type}</span>
    </span>
  );
};
