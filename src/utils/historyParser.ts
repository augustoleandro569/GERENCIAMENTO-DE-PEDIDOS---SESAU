import { OrderEvent, OrderStatus } from '../types';

export function parseHistoryToEvents(
  orderId: string,
  historicoRaw?: string | null,
  fallbackResponsavel = 'Sistema'
): OrderEvent[] {
  if (!historicoRaw || !historicoRaw.trim()) {
    return [];
  }

  const events: OrderEvent[] = [];
  // Split lines or separated by ';' or '|' or '\n'
  const lines = historicoRaw
    .split(/\r?\n|;(?=\s*\d{2}\/\d{2}\/)|\|(?=\s*\d{2}\/\d{2}\/)/)
    .map(l => l.trim())
    .filter(Boolean);

  let counter = 1;

  for (const line of lines) {
    // Typical patterns:
    // "24/09/2026 16:43 – Criada por Natalli Morais Acioli"
    // "24/09/2026 16:51 – Aprovada - Rodrigo Cesar"
    // "24/09/2026 17:10: Em separação (Almoxarifado Central)"
    // "24/09/2026 - Pedido Entregue por Carlos Eduardo"
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
    
    let dateStr = new Date().toISOString();
    let remaining = line;

    if (dateMatch) {
      dateStr = dateMatch[1];
      remaining = line.substring(dateMatch[0].length).replace(/^[\s–\-:·|]+/, '').trim();
    }

    // Try to extract responsible
    let responsavel = fallbackResponsavel;
    let tipo_evento = remaining;
    let observacao = '';

    const byMatch = remaining.match(/(?:por|respons[aá]vel:|op:|usu[aá]rio:|-|–)\s*([A-Za-zÀ-ÿ\s.'’]+)$/i);
    if (byMatch && byMatch[1] && byMatch[1].trim().length > 2) {
      responsavel = byMatch[1].trim();
      tipo_evento = remaining.substring(0, remaining.lastIndexOf(byMatch[0])).trim();
    }

    // Normalize status from tipo_evento
    let status: OrderStatus = 'Aguardando Aprovação';
    const lower = tipo_evento.toLowerCase();
    if (lower.includes('criada') || lower.includes('criado') || lower.includes('rascunho')) {
      status = 'Aguardando Aprovação';
      tipo_evento = 'Criação do Pedido';
    } else if (lower.includes('aprovad') || lower.includes('validada') || lower.includes('validado')) {
      status = 'Aprovada';
      tipo_evento = 'Aprovação';
    } else if (lower.includes('em separação') || lower.includes('separando')) {
      status = 'Em Separação';
      tipo_evento = 'Separação Iniciada';
    } else if (lower.includes('separada') || lower.includes('separado') || lower.includes('aguardando conferência')) {
      status = 'Aguardando Conferência';
      tipo_evento = 'Separação Concluída';
    } else if (lower.includes('em conferência') || lower.includes('conferindo')) {
      status = 'Em Conferência';
      tipo_evento = 'Conferência em Andamento';
    } else if (lower.includes('expedid') || lower.includes('expedição')) {
      status = 'Expedida';
      tipo_evento = 'Expedição';
    } else if (lower.includes('transporte') || lower.includes('em trânsito') || lower.includes('rota')) {
      status = 'Em Transporte';
      tipo_evento = 'Saída para Entrega';
    } else if (lower.includes('entregue parcialmente')) {
      status = 'Entregue Parcialmente';
      tipo_evento = 'Entrega Parcial';
    } else if (lower.includes('entregue') || lower.includes('entregada')) {
      status = 'Entregue';
      tipo_evento = 'Entrega Concluída';
    } else if (lower.includes('rejeitad') || lower.includes('reprovad')) {
      status = 'Rejeitada';
      tipo_evento = 'Rejeição';
    } else if (lower.includes('cancelad')) {
      status = 'Cancelada';
      tipo_evento = 'Cancelamento';
    }

    events.push({
      id: `evt-${orderId}-${counter++}`,
      pedido_id: orderId,
      tipo_evento: tipo_evento || 'Atualização',
      status,
      data_evento: dateStr,
      responsavel: responsavel || 'Operador',
      origem: 'IMPORTAÇÃO',
      observacao: observacao || undefined,
    });
  }

  return events;
}
