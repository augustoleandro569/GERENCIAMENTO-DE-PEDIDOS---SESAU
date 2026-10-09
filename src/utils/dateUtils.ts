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

/**
 * Extracts date only string formatted as YYYY-MM-DD from various formats (ISO, DD/MM/YYYY, etc.)
 */
export function extractDateOnly(val?: string | null): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD/MM/YYYY HH:mm
  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const parts = trimmed.split(' ')[0].split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // ISO string
  if (trimmed.includes('T')) {
    return trimmed.split('T')[0];
  }

  const d = parseDateSafe(trimmed);
  if (d && !isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return trimmed;
}

/**
 * Calculates the start date of picking/separation by subtracting business days (dias úteis)
 * from the target delivery date, skipping Saturdays and Sundays.
 * Default is 5 business days (dias úteis) before delivery.
 */
export function calculatePickingStartDate(deliveryDateStr?: string | null, businessDays = 5): string {
  if (!deliveryDateStr) return '';
  const cleanDelivery = extractDateOnly(deliveryDateStr);
  const parsed = parseDateSafe(cleanDelivery);
  if (!parsed || isNaN(parsed.getTime())) return '';

  const cur = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
  let daysSubtracted = 0;

  while (daysSubtracted < businessDays) {
    cur.setDate(cur.getDate() - 1);
    const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysSubtracted++;
    }
  }

  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, '0');
  const d = String(cur.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Counts business days (Monday-Friday) between two dates.
 */
export function countBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0);
  
  if (start.getTime() >= end.getTime()) return 0;

  let count = 0;
  const cur = new Date(start.getTime());
  while (cur.getTime() < end.getTime()) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      count++;
    }
  }
  return count;
}

export type SeparationAlertSeverity = 'NORMAL' | 'IMINENTE' | 'ALERTA' | 'CRITICO' | 'CONCLUIDO' | 'CANCELADO';

export interface SeparationAlertInfo {
  severity: SeparationAlertSeverity;
  isStarted: boolean;
  hasDeliveryDate: boolean;
  deliveryDate: string;
  pickingStartDate: string;
  businessDaysRemaining: number;
  businessDaysOverdue: number;
  badgeLabel: string;
  badgeColor: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  title: string;
  description: string;
  actionRecommended: string;
}

/**
 * Evaluates the 5 business day separation alert control for an order.
 * Triggers warnings when separation has not commenced 5 business days prior to scheduled delivery.
 */
export function getSeparationAlertInfo(
  order: Order,
  schedule?: Schedule | null,
  referenceDate?: Date
): SeparationAlertInfo {
  const isDelivered = order.status_operacional === 'Entregue' || order.status_operacional === 'Entregue Parcialmente';
  const isCancelled = order.status_operacional === 'Cancelado' || order.status_operacional === 'Cancelada' || order.status_operacional === 'Rejeitada';
  
  const isSeparationStarted = [
    'Em Separação',
    'Aguardando Conferência',
    'Em Conferência',
    'Expedida',
    'Em Transporte',
    'Entregue',
    'Entregue Parcialmente'
  ].includes(order.status_operacional);

  const deliveryRaw = order.data_prevista_entrega || schedule?.data_entrega || '';
  const deliveryClean = extractDateOnly(deliveryRaw);

  const pickingRaw = order.data_inicio_separacao || schedule?.data_separacao || calculatePickingStartDate(deliveryClean, 5);
  const pickingClean = extractDateOnly(pickingRaw);

  if (isCancelled) {
    return {
      severity: 'CANCELADO',
      isStarted: false,
      hasDeliveryDate: !!deliveryClean,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      badgeLabel: 'Cancelado',
      badgeColor: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
      title: 'Pedido Cancelado',
      description: 'O pedido foi cancelado e não requer separação.',
      actionRecommended: 'Nenhuma ação necessária.',
    };
  }

  if (isDelivered) {
    return {
      severity: 'CONCLUIDO',
      isStarted: true,
      hasDeliveryDate: !!deliveryClean,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      badgeLabel: 'Entregue',
      badgeColor: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      },
      title: 'Entrega Concluída',
      description: 'Demanda já entregue à unidade hospitalar.',
      actionRecommended: 'Concluído.',
    };
  }

  if (isSeparationStarted) {
    const isSeparating = order.status_operacional === 'Em Separação';
    return {
      severity: 'CONCLUIDO',
      isStarted: true,
      hasDeliveryDate: !!deliveryClean,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      badgeLabel: isSeparating ? 'Em Separação' : order.status_operacional,
      badgeColor: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      },
      title: isSeparating ? 'Separação em Andamento' : `Status: ${order.status_operacional}`,
      description: `A demanda foi iniciada no almoxarifado por ${order.separador || 'equipe operacional'}.`,
      actionRecommended: 'Acompanhar conferência e expedição.',
    };
  }

  // Not started yet
  if (!deliveryClean) {
    return {
      severity: 'NORMAL',
      isStarted: false,
      hasDeliveryDate: false,
      deliveryDate: '',
      pickingStartDate: pickingClean,
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      badgeLabel: 'Sem Data Entrega',
      badgeColor: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
      title: 'Data de Entrega Não Definida',
      description: 'Vincule o pedido a um cronograma ou defina a data prevista de entrega para ativar o controle de 5 dias úteis.',
      actionRecommended: 'Definir data de entrega prevista.',
    };
  }

  const now = referenceDate || new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  const deliveryDateObj = parseDateSafe(deliveryClean);
  const pickingDateObj = parseDateSafe(pickingClean);

  if (!deliveryDateObj || isNaN(deliveryDateObj.getTime())) {
    return {
      severity: 'NORMAL',
      isStarted: false,
      hasDeliveryDate: false,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      badgeLabel: 'Data Inválida',
      badgeColor: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
      title: 'Data de Entrega Inválida',
      description: 'Verifique o formato da data de entrega.',
      actionRecommended: 'Corrigir data.',
    };
  }

  const deliveryNorm = new Date(deliveryDateObj.getFullYear(), deliveryDateObj.getMonth(), deliveryDateObj.getDate(), 12, 0, 0);
  const pickingNorm = pickingDateObj 
    ? new Date(pickingDateObj.getFullYear(), pickingDateObj.getMonth(), pickingDateObj.getDate(), 12, 0, 0)
    : new Date(calculatePickingStartDate(deliveryClean, 5) + 'T12:00:00');

  // Business days remaining until delivery
  const businessDaysRemaining = countBusinessDaysBetween(todayOnly, deliveryNorm);

  // Is today on or past the picking start deadline?
  const diffDaysFromPicking = Math.round((todayOnly.getTime() - pickingNorm.getTime()) / (1000 * 60 * 60 * 24));
  const isPastPickingStart = todayOnly.getTime() >= pickingNorm.getTime();
  const businessDaysOverdue = isPastPickingStart ? countBusinessDaysBetween(pickingNorm, todayOnly) : 0;

  // 1. Critical: delivery is in 2 business days or less, or delivery date already passed, and separation NOT started!
  if (businessDaysRemaining <= 2 || todayOnly.getTime() >= deliveryNorm.getTime()) {
    const isDeliveryPast = todayOnly.getTime() >= deliveryNorm.getTime();
    return {
      severity: 'CRITICO',
      isStarted: false,
      hasDeliveryDate: true,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining,
      businessDaysOverdue: Math.max(1, businessDaysOverdue),
      badgeLabel: isDeliveryPast ? 'Entrega Vencida (Não Iniciado)' : 'Expedição Crítica',
      badgeColor: {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-300',
        dot: 'bg-rose-600',
      },
      title: '🚨 Risco Crítico de Atraso na Expedição',
      description: isDeliveryPast 
        ? 'A data de entrega já chegou e a separação sequer foi iniciada! Expedição atrasada.'
        : `Restam apenas ${businessDaysRemaining} dia(s) útil(eis) para a entrega e a separação ainda não começou! O prazo de antecedência foi estourado.`,
      actionRecommended: 'Iniciar separação imediatamente em caráter de urgência!',
    };
  }

  // 2. Alert: today is on or past the 5-business-day picking start date, and separation hasn't started
  if (isPastPickingStart) {
    return {
      severity: 'ALERTA',
      isStarted: false,
      hasDeliveryDate: true,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining,
      businessDaysOverdue: Math.max(0, businessDaysOverdue),
      badgeLabel: diffDaysFromPicking === 0 ? 'Iniciar Separação Hoje' : `Separação Pendente (${businessDaysOverdue}d úteis)`,
      badgeColor: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
        dot: 'bg-amber-500',
      },
      title: '⚠️ Alerta: Prazo de 5 Dias Úteis Atingido',
      description: diffDaysFromPicking === 0
        ? 'Hoje é o prazo limite para iniciar a separação (5 dias úteis de antecedência). A demanda ainda não foi iniciada no almoxarifado!'
        : `A separação deveria ter iniciado há ${businessDaysOverdue} dia(s) útil(eis). Restam ${businessDaysRemaining} dias úteis até a entrega. Risco iminente de atraso na expedição!`,
      actionRecommended: 'Mobilizar equipe e iniciar separação agora.',
    };
  }

  // 3. Imminent: tomorrow or within 1 business day of picking start date
  const businessDaysUntilStart = countBusinessDaysBetween(todayOnly, pickingNorm);
  if (businessDaysUntilStart <= 1) {
    return {
      severity: 'IMINENTE',
      isStarted: false,
      hasDeliveryDate: true,
      deliveryDate: deliveryClean,
      pickingStartDate: pickingClean,
      businessDaysRemaining,
      businessDaysOverdue: 0,
      badgeLabel: 'Separação Iminente',
      badgeColor: {
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: 'bg-sky-500',
      },
      title: 'Próximo do Início de Separação',
      description: `A separação deve iniciar em ${businessDaysUntilStart === 0 ? 'breve' : '1 dia útil'} (${formatShortDate(pickingClean)}) para respeitar os 5 dias úteis de antecedência.`,
      actionRecommended: 'Validar aprovação e preparar separação.',
    };
  }

  // 4. Normal / No Prazo
  return {
    severity: 'NORMAL',
    isStarted: false,
    hasDeliveryDate: true,
    deliveryDate: deliveryClean,
    pickingStartDate: pickingClean,
    businessDaysRemaining,
    businessDaysOverdue: 0,
    badgeLabel: `Separação em ${businessDaysUntilStart}d úteis`,
    badgeColor: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
    },
    title: 'No Prazo de Planejamento',
    description: `Separação prevista para ${formatShortDate(pickingClean)} (5 dias úteis antes da entrega em ${formatShortDate(deliveryClean)}).`,
    actionRecommended: 'Aguardar ciclo operacional.',
  };
}

