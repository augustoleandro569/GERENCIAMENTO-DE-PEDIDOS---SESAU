import { Order, Schedule, DeadlineSituation } from '../types';

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    // If it has time component
    if (dateStr.includes('T') || dateStr.includes(':')) {
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

export function parseDateSafe(val?: string | null): Date | null {
  if (!val) return null;
  
  // Format DD/MM/YYYY or DD/MM/YYYY HH:mm
  if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
    const [datePart, timePart] = val.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    let hours = 0;
    let minutes = 0;
    if (timePart) {
      const [h, m] = timePart.split(':').map(Number);
      hours = h || 0;
      minutes = m || 0;
    }
    return new Date(year, month - 1, day, hours, minutes);
  }
  
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function calculateDeadlineSituation(
  order: Order,
  schedule?: Schedule | null,
  warningHours = 48
): { situation: DeadlineSituation; label: string; delayDays: number; targetDate: string } {
  // If order is completed
  const isDelivered = order.status_operacional === 'Entregue' || order.status_origem === 'Entregue';
  const isPartiallyDelivered = order.status_operacional === 'Entregue Parcialmente' || order.status_origem === 'Entregue Parcialmente';

  if (!schedule) {
    if (order.data_prevista_entrega) {
      const targetDelivery = parseDateSafe(order.data_prevista_entrega);
      if (isDelivered || isPartiallyDelivered) {
        return { situation: 'Concluído no prazo', label: 'Concluído', delayDays: 0, targetDate: order.data_prevista_entrega };
      }
      if (targetDelivery) {
        const now = new Date();
        const diffMs = targetDelivery.getTime() - now.getTime();
        if (diffMs < 0) {
          const days = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
          return { situation: 'Atrasado', label: `Atrasado ${days}d`, delayDays: days, targetDate: order.data_prevista_entrega };
        } else if (diffMs <= warningHours * 3600000) {
          const hours = Math.max(1, Math.floor(diffMs / 3600000));
          return { situation: 'Atenção', label: `Vence em ${hours}h`, delayDays: 0, targetDate: order.data_prevista_entrega };
        } else {
          return { situation: 'Dentro do prazo', label: 'No prazo', delayDays: 0, targetDate: order.data_prevista_entrega };
        }
      }
    }

    if (isDelivered || isPartiallyDelivered) {
      return { situation: 'Concluído no prazo', label: 'Concluído', delayDays: 0, targetDate: '—' };
    }
    return { situation: 'Fora do cronograma', label: 'Sem Cronograma', delayDays: 0, targetDate: '—' };
  }

  const now = new Date();
  
  // Delivered status check
  if (isDelivered || isPartiallyDelivered) {
    const deliveryDate = parseDateSafe(order.entregue_em) || parseDateSafe(order.atualizado_em);
    const targetDelivery = parseDateSafe(schedule.data_entrega);
    if (deliveryDate && targetDelivery) {
      if (deliveryDate.getTime() <= targetDelivery.getTime() + 86400000) { // include day end
        return { situation: 'Concluído no prazo', label: 'Entregue no prazo', delayDays: 0, targetDate: schedule.data_entrega };
      } else {
        const diffMs = deliveryDate.getTime() - targetDelivery.getTime();
        const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return { situation: 'Concluído com atraso', label: `Entregue com ${days}d de atraso`, delayDays: days, targetDate: schedule.data_entrega };
      }
    }
    return { situation: 'Concluído no prazo', label: 'Concluído', delayDays: 0, targetDate: schedule.data_entrega };
  }

  // Active stages check
  const isAwaitingApproval = order.status_operacional === 'Aguardando Aprovação' || order.status_operacional === 'Aguardando Validação' || order.status_origem === 'Aguardando Aprovação' || order.status_origem === 'Aguardando Validação' || order.status_operacional === 'Rascunho';
  const isApprovedOrSeparating = order.status_operacional === 'Aprovada' || order.status_operacional === 'Aprovado' || order.status_operacional === 'Aguardando Separação' || order.status_operacional === 'Em Separação';
  const isInConferenceOrDispatch = order.status_operacional === 'Aguardando Conferência' || order.status_operacional === 'Em Conferência' || order.status_operacional === 'Expedida';
  const isInTransport = order.status_operacional === 'Em Transporte';

  let milestoneDateStr = schedule.data_entrega;
  if (isAwaitingApproval) {
    milestoneDateStr = schedule.data_limite_aprovacao;
  } else if (isApprovedOrSeparating) {
    milestoneDateStr = schedule.data_separacao;
  } else if (isInConferenceOrDispatch) {
    milestoneDateStr = schedule.data_expedicao;
  } else if (isInTransport) {
    milestoneDateStr = schedule.data_entrega;
  }

  const milestoneDate = parseDateSafe(milestoneDateStr);
  if (!milestoneDate) {
    return { situation: 'Dentro do prazo', label: 'No prazo', delayDays: 0, targetDate: milestoneDateStr };
  }

  // End of milestone day (23:59:59)
  const milestoneEndOfDay = new Date(milestoneDate);
  milestoneEndOfDay.setHours(23, 59, 59, 999);

  const diffMs = milestoneEndOfDay.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    const delayDays = Math.max(1, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
    return {
      situation: 'Atrasado',
      label: `Atrasado ${delayDays}d`,
      delayDays,
      targetDate: milestoneDateStr
    };
  }

  if (diffHours <= warningHours) {
    return {
      situation: 'Atenção',
      label: `Vence em ${Math.ceil(diffHours / 24)}d`,
      delayDays: 0,
      targetDate: milestoneDateStr
    };
  }

  return {
    situation: 'Dentro do prazo',
    label: 'Dentro do prazo',
    delayDays: 0,
    targetDate: milestoneDateStr
  };
}

export function calculateLeadTimeHours(startStr?: string | null, endStr?: string | null): number | null {
  const start = parseDateSafe(startStr);
  const end = parseDateSafe(endStr);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}
