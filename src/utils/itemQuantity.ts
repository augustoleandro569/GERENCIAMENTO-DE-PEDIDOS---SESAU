/**
 * Utility to calculate realistic, deterministic item quantities for hospital supply orders.
 * Standardizes operational logistics across SESAU:
 * - Large hospital monthly orders: 35-85 items
 * - Clinic/UPA monthly orders: 18-42 items
 * - Emergencial orders: 6-24 items
 * - Falta (stockout replenishment): 4-20 items
 * - Semanal/Quinzenal orders: 12-60 items
 */

export function computeRealisticItemCount(order: {
  codigo?: string;
  tipo?: string;
  unidade?: string;
  programa?: string;
  quantidade_itens?: number;
}): number {
  if (order.quantidade_itens && order.quantidade_itens > 1) {
    return order.quantidade_itens;
  }

  const codeNum = parseInt((order.codigo || '').replace(/\D/g, '') || '100', 10);
  const tipo = (order.tipo || 'Mensal').toLowerCase();
  const unidade = (order.unidade || '').toLowerCase();
  
  const isLargeHospital = 
    unidade.includes('hge') || 
    unidade.includes('metropolitano') || 
    unidade.includes('hma') || 
    unidade.includes('geral') || 
    unidade.includes('regional') || 
    unidade.includes('dr. daniel houly') ||
    unidade.includes('uedh') || 
    unidade.includes('mulher') || 
    unidade.includes('universitario') || 
    unidade.includes('hu');

  const isUpaOrSamu = 
    unidade.includes('upa') || 
    unidade.includes('samu') || 
    unidade.includes('clinica');

  // Stable pseudo-random seed from code number
  const seed = (codeNum * 19 + 37) % 100;
  
  if (tipo.includes('mensal')) {
    if (isLargeHospital) {
      return 35 + (seed % 46); // 35 to 80 items
    } else if (isUpaOrSamu) {
      return 18 + (seed % 23); // 18 to 40 items
    } else {
      return 22 + (seed % 31); // 22 to 52 items
    }
  } else if (tipo.includes('semanal') || tipo.includes('quinzenal')) {
    if (isLargeHospital) {
      return 25 + (seed % 36); // 25 to 60 items
    } else {
      return 12 + (seed % 19); // 12 to 30 items
    }
  } else if (tipo.includes('emergencial')) {
    if (isLargeHospital) {
      return 8 + (seed % 17); // 8 to 24 items
    } else {
      return 5 + (seed % 12); // 5 to 16 items
    }
  } else if (tipo.includes('falta')) {
    if (isLargeHospital) {
      return 6 + (seed % 16); // 6 to 21 items
    } else {
      return 4 + (seed % 11); // 4 to 14 items
    }
  } else {
    return 10 + (seed % 21); // 10 to 30 items
  }
}
