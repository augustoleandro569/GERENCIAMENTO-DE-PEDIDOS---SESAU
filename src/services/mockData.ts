import { HospitalUnit, Program, RequestTypeConfig, Schedule, Order, OrderStatus, Priority } from '../types';
import { parseHistoryToEvents } from '../utils/historyParser';
import { CANONICAL_UNITS } from '../utils/unitNormalizer';

export const INITIAL_UNITS: HospitalUnit[] = CANONICAL_UNITS;


export const INITIAL_PROGRAMS: Program[] = [
  { id: 'prog-1', nome: 'Hospitalar', descricao: 'Insumos médico-hospitalares, gases, medicamentos e correlatos de internação', ativo: true },
  { id: 'prog-2', nome: 'Almoxarifado', descricao: 'Materiais de escritório, expediente, higiene, descartáveis e limpeza', ativo: true },
  { id: 'prog-3', nome: 'Nutricional', descricao: 'Dietas enterais, fórmulas infantis e suplementos clínicos', ativo: true },
  { id: 'prog-4', nome: 'Oncológico', descricao: 'Quimioterápicos, imunoterápicos e medicamentos adjuvantes oncológicos', ativo: true },
  { id: 'prog-5', nome: 'Órtese e Prótese', descricao: 'OPME, materiais cirúrgicos implantáveis e fios de sutura especializados', ativo: true },
  { id: 'prog-6', nome: 'LACEN', descricao: 'Reagentes laboratoriais, kits diagnósticos PCR/sorologia e meios de cultura', ativo: true },
];

export const INITIAL_TYPES: RequestTypeConfig[] = [
  { id: 't-1', nome: 'Mensal', cor: '#2563eb', prioridade_padrao: 'Normal', ativo: true },
  { id: 't-2', nome: 'Emergencial', cor: '#dc2626', prioridade_padrao: 'Urgente', ativo: true },
  { id: 't-3', nome: 'Falta', cor: '#ea580c', prioridade_padrao: 'Alta', ativo: true },
  { id: 't-4', nome: 'Semanal', cor: '#0d9488', prioridade_padrao: 'Normal', ativo: true },
  { id: 't-5', nome: 'Quinzenal', cor: '#7c3aed', prioridade_padrao: 'Normal', ativo: true },
];

export const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: 'sch-1',
    nome: 'HGE — Hospitalar Mensal — Out/2026',
    competencia: 'OUT/26',
    unidade: 'HGE',
    programa: 'Hospitalar',
    tipo_pedido: 'Mensal',
    data_limite_solicitacao: '2026-10-05',
    data_limite_aprovacao: '2026-10-07',
    data_separacao: '2026-10-08',
    data_expedicao: '2026-10-09',
    data_entrega: '2026-10-10',
    observacao: 'Grade regular de abastecimento mensal do Hospital Geral do Estado',
    ativo: true,
  },
  {
    id: 'sch-2',
    nome: 'HEMOAR — Almoxarifado Mensal — Set/2026',
    competencia: 'SET/26',
    unidade: 'HEMOAR',
    programa: 'Almoxarifado',
    tipo_pedido: 'Mensal',
    data_limite_solicitacao: '2026-09-23',
    data_limite_aprovacao: '2026-09-25',
    data_separacao: '2026-09-26',
    data_expedicao: '2026-09-27',
    data_entrega: '2026-09-28',
    observacao: 'Cronograma Setembro/2026 para Hemocentro de Arapiraca',
    ativo: true,
  },
  {
    id: 'sch-3',
    nome: 'HMA — Hospitalar Mensal — Set/2026',
    competencia: 'SET/26',
    unidade: 'HMA',
    programa: 'Hospitalar',
    tipo_pedido: 'Mensal',
    data_limite_solicitacao: '2026-09-20',
    data_limite_aprovacao: '2026-09-22',
    data_separacao: '2026-09-23',
    data_expedicao: '2026-09-24',
    data_entrega: '2026-09-25',
    observacao: 'Abastecimento rotina Metropolitano',
    ativo: true,
  },
  {
    id: 'sch-4',
    nome: 'HRM — Nutricional Semanal — Set/2026 (S39)',
    competencia: 'SET/26',
    unidade: 'HRM',
    programa: 'Nutricional',
    tipo_pedido: 'Semanal',
    data_limite_solicitacao: '2026-09-21',
    data_limite_aprovacao: '2026-09-22',
    data_separacao: '2026-09-23',
    data_expedicao: '2026-09-24',
    data_entrega: '2026-09-25',
    observacao: 'Dietas enterais e nutrição clínica semanal para Regional da Mata',
    ativo: true,
  },
  {
    id: 'sch-5',
    nome: 'LACEN — Insumos e Reagentes Quinzenal — Set/2026',
    competencia: 'SET/26',
    unidade: 'LACEN',
    programa: 'LACEN',
    tipo_pedido: 'Quinzenal',
    data_limite_solicitacao: '2026-09-18',
    data_limite_aprovacao: '2026-09-20',
    data_separacao: '2026-09-21',
    data_expedicao: '2026-09-22',
    data_entrega: '2026-09-23',
    observacao: 'Kits diagnósticos e reagentes de biossegurança',
    ativo: true,
  },
  {
    id: 'sch-6',
    nome: 'HMULHER — Hospitalar Mensal — Out/2026',
    competencia: 'OUT/26',
    unidade: 'HMULHER',
    programa: 'Hospitalar',
    tipo_pedido: 'Mensal',
    data_limite_solicitacao: '2026-10-02',
    data_limite_aprovacao: '2026-10-04',
    data_separacao: '2026-10-05',
    data_expedicao: '2026-10-06',
    data_entrega: '2026-10-07',
    observacao: 'Hospital da Mulher',
    ativo: true,
  }
];

export const STATUS_LIST: OrderStatus[] = [
  'Rascunho',
  'Aguardando Aprovação',
  'Aprovada',
  'Aguardando Separação',
  'Em Separação',
  'Aguardando Conferência',
  'Em Conferência',
  'Expedida',
  'Em Transporte',
  'Entregue',
  'Entregue Parcialmente',
  'Rejeitada',
  'Cancelada',
];

const REQUISTERS = [
  'Dra. Camila Alencar', 'Dr. Marcelo Fontes', 'Enf. Patricia Lima', 'Farm. Bruno Tavares',
  'Dra. Silvia Regina', 'Dr. Lucas Brandão', 'Enf. Juliana Vasconcelos', 'Farm. Rafael Medeiros',
  'Dra. Monique Cordeiro', 'Dr. Eduardo Wanderley', 'Enf. Cristiane Ramos', 'Farm. Thiago Aragão',
  'Dra. Vanessa Cavalcante', 'Dr. Felipe Holanda', 'Enf. Mariana Teles', 'Farm. Igor Lins'
];

const VALIDATORS = [
  'Rodrigo Cesar de Moura Castro Alves', 'Dra. Valeria Souza', 'Marcos Vinicius Barros',
  'Clarice Meneses Fontes', 'Leandro Augusto Barbosa'
];

const PICKERS = [
  'Lucas Albuquerque', 'Amanda Rocha', 'Danilo Cerqueira', 'Gisele Miranda', 'Felipe Santos'
];

const CONFERENTES = [
  'Roberto Silveira', 'Jessica Queiroz', 'Carlos Eduardo Santana'
];

const DRIVERS = [
  'Edvaldo Santos (Motorista)', 'Manoel Messias (Logística 02)', 'José Claudio Viana (Furgão 05)', 'Valmir Pontes (Caminhão Térmico)'
];

// Generates exactly 631 realistic orders as described in the user prompt
export function generateSeedOrders(): Order[] {
  const orders: Order[] = [];
  const baseCodeNumber = 3074; // SOL-2026-03074 downwards

  // Explicit showcase first orders matching the prompt exactly:
  // 1. SOL-2026-03074
  orders.push({
    id: 'ord-3074',
    codigo: 'SOL-2026-03074',
    origem: 'IMPORTAÇÃO',
    tipo: 'Mensal',
    solicitante: 'Dra. Camila Alencar',
    cpf: '123.456.789-00',
    programa: 'Almoxarifado',
    unidade: 'HEMOAR',
    quantidade_itens: 23,
    criado_em: '2026-09-24 09:30',
    data_inicio: '2026-09-24',
    data_solicitacao: '2026-09-24',
    status_origem: 'Aguardando Aprovação',
    status_operacional: 'Aguardando Aprovação',
    cronograma_id: 'sch-2',
    cronograma_vinculo: 'AUTOMÁTICO',
    prioridade: 'Normal',
    observacoes: 'Solicitação mensal regular do Hemocentro de Arapiraca.',
    historico_original: '24/09/2026 09:30 – Criada por Dra. Camila Alencar',
    criado_no_sistema_em: '2026-09-24T09:30:00Z',
    atualizado_em: '2026-09-24T09:30:00Z',
  });

  // 2. SOL-2026-03073
  orders.push({
    id: 'ord-3073',
    codigo: 'SOL-2026-03073',
    origem: 'IMPORTAÇÃO',
    tipo: 'Emergencial',
    solicitante: 'Dr. Marcelo Fontes',
    cpf: '987.654.321-11',
    programa: 'Oncológico',
    unidade: 'HMA',
    quantidade_itens: 25,
    criado_em: '2026-09-24 10:15',
    status_origem: 'Aprovada',
    status_operacional: 'Aguardando Separação',
    validador: 'Rodrigo Cesar de Moura Castro Alves',
    validado_em: '2026-09-24 10:45',
    cronograma_id: null,
    cronograma_vinculo: 'NENHUM',
    prioridade: 'Urgente',
    observacoes: 'Emergência Oncológica para UTI do Metropolitano. Despacho urgente.',
    historico_original: '24/09/2026 10:15 – Criada por Dr. Marcelo Fontes\n24/09/2026 10:45 – Aprovada por Rodrigo Cesar de Moura Castro Alves',
    criado_no_sistema_em: '2026-09-24T10:15:00Z',
    atualizado_em: '2026-09-24T10:45:00Z',
  });

  // 3. SOL-2026-03072
  orders.push({
    id: 'ord-3072',
    codigo: 'SOL-2026-03072',
    origem: 'IMPORTAÇÃO',
    tipo: 'Falta',
    solicitante: 'Enf. Patricia Lima',
    cpf: '333.444.555-66',
    programa: 'Hospitalar',
    unidade: 'HGE',
    quantidade_itens: 14,
    criado_em: '2026-09-23 14:20',
    status_origem: 'Em Separação',
    status_operacional: 'Em Separação',
    validador: 'Rodrigo Cesar de Moura Castro Alves',
    validado_em: '2026-09-23 15:00',
    separador: 'Lucas Albuquerque',
    separado_em: '2026-09-24 08:30',
    cronograma_id: null,
    cronograma_vinculo: 'NENHUM',
    prioridade: 'Alta',
    observacoes: 'Itens em falta na farmácia central do HGE.',
    historico_original: '23/09/2026 14:20 – Criada por Enf. Patricia Lima\n23/09/2026 15:00 – Aprovada por Rodrigo Cesar\n24/09/2026 08:30 – Em separação por Lucas Albuquerque',
    criado_no_sistema_em: '2026-09-23T14:20:00Z',
    atualizado_em: '2026-09-24T08:30:00Z',
  });

  // 4. SOL-2026-03071
  orders.push({
    id: 'ord-3071',
    codigo: 'SOL-2026-03071',
    origem: 'IMPORTAÇÃO',
    tipo: 'Semanal',
    solicitante: 'Farm. Bruno Tavares',
    cpf: '777.888.999-00',
    programa: 'Nutricional',
    unidade: 'HRM',
    quantidade_itens: 42,
    criado_em: '2026-09-22 11:00',
    status_origem: 'Em Transporte',
    status_operacional: 'Em Transporte',
    validador: 'Dra. Valeria Souza',
    validado_em: '2026-09-22 11:30',
    separador: 'Lucas Albuquerque',
    separado_em: '2026-09-23 09:00',
    conferente: 'Roberto Silveira',
    conferido_em: '2026-09-23 16:00',
    expedidor: 'Marcos Vinicius Barros',
    expedido_em: '2026-09-23 17:00',
    entregador: 'Edvaldo Santos (Motorista)',
    cronograma_id: 'sch-4',
    cronograma_vinculo: 'AUTOMÁTICO',
    prioridade: 'Normal',
    observacoes: 'Em rota na rodovia BR-104 com destino a União dos Palmares.',
    historico_original: '22/09/2026 11:00 – Criada por Farm. Bruno Tavares\n22/09/2026 11:30 – Aprovada por Dra. Valeria Souza\n23/09/2026 09:00 – Separada por Lucas Albuquerque\n23/09/2026 17:00 – Expedida por Marcos Vinicius Barros\n24/09/2026 07:15 – Em transporte por Edvaldo Santos',
    criado_no_sistema_em: '2026-09-22T11:00:00Z',
    atualizado_em: '2026-09-24T07:15:00Z',
  });

  // 5. SOL-2026-03070
  orders.push({
    id: 'ord-3070',
    codigo: 'SOL-2026-03070',
    origem: 'IMPORTAÇÃO',
    tipo: 'Quinzenal',
    solicitante: 'Dra. Silvia Regina',
    cpf: '555.666.777-88',
    programa: 'LACEN',
    unidade: 'LACEN',
    quantidade_itens: 19,
    criado_em: '2026-09-21 08:00',
    status_origem: 'Entregue',
    status_operacional: 'Entregue',
    validador: 'Rodrigo Cesar de Moura Castro Alves',
    validado_em: '2026-09-21 08:45',
    separador: 'Amanda Rocha',
    separado_em: '2026-09-21 14:30',
    conferente: 'Jessica Queiroz',
    conferido_em: '2026-09-21 17:00',
    expedidor: 'Marcos Vinicius Barros',
    expedido_em: '2026-09-22 08:00',
    entregador: 'Edvaldo Santos',
    entregue_em: '2026-09-22 10:20',
    cronograma_id: 'sch-5',
    cronograma_vinculo: 'AUTOMÁTICO',
    prioridade: 'Normal',
    observacoes: 'Entregue e atestado pela recepção técnica do LACEN.',
    historico_original: '21/09/2026 08:00 – Criada por Dra. Silvia Regina\n21/09/2026 08:45 – Aprovada por Rodrigo Cesar\n21/09/2026 14:30 – Separada por Amanda Rocha\n22/09/2026 10:20 – Entregue por Edvaldo Santos',
    criado_no_sistema_em: '2026-09-21T08:00:00Z',
    atualizado_em: '2026-09-22T10:20:00Z',
  });

  // Now generate remaining 626 orders to make exactly 631 records
  const statusWeights: { status: OrderStatus; weight: number }[] = [
    { status: 'Entregue', weight: 260 },
    { status: 'Aprovada', weight: 65 },
    { status: 'Aguardando Separação', weight: 55 },
    { status: 'Em Separação', weight: 45 },
    { status: 'Aguardando Aprovação', weight: 40 },
    { status: 'Em Transporte', weight: 35 },
    { status: 'Aguardando Conferência', weight: 30 },
    { status: 'Em Conferência', weight: 25 },
    { status: 'Expedida', weight: 25 },
    { status: 'Entregue Parcialmente', weight: 20 },
    { status: 'Rascunho', weight: 15 },
    { status: 'Rejeitada', weight: 10 },
    { status: 'Cancelada', weight: 6 },
  ];

  // Flatten array based on weights
  const statusPool: OrderStatus[] = [];
  statusWeights.forEach(sw => {
    for (let w = 0; w < sw.weight; w++) statusPool.push(sw.status);
  });

  const typePool = ['Mensal', 'Mensal', 'Mensal', 'Emergencial', 'Falta', 'Semanal', 'Quinzenal'];
  const programPool = ['Hospitalar', 'Hospitalar', 'Almoxarifado', 'Nutricional', 'Oncológico', 'Órtese e Prótese', 'LACEN'];

  for (let i = 5; i < 631; i++) {
    const codeNum = baseCodeNumber - i;
    const code = `SOL-2026-${String(codeNum).padStart(5, '0')}`;
    const unit = INITIAL_UNITS[i % INITIAL_UNITS.length].sigla;
    const prog = programPool[i % programPool.length];
    const tipo = typePool[i % typePool.length];
    const status = statusPool[i % statusPool.length];
    const requester = REQUISTERS[i % REQUISTERS.length];
    const validator = VALIDATORS[i % VALIDATORS.length];
    const picker = PICKERS[i % PICKERS.length];
    const driver = DRIVERS[i % DRIVERS.length];
    
    // Day distribution in Sep 2026 (1 to 24)
    const day = Math.max(1, 24 - Math.floor(i / 27));
    const dayStr = String(day).padStart(2, '0');
    const createdDate = `2026-09-${dayStr} 08:30`;
    
    let prioridade: Priority = 'Normal';
    if (tipo === 'Emergencial') prioridade = 'Urgente';
    else if (tipo === 'Falta') prioridade = 'Alta';
    else if (i % 11 === 0) prioridade = 'Baixa';

    // Link schedule if matching
    let cronograma_id: string | null = null;
    let cronograma_vinculo: 'AUTOMÁTICO' | 'MANUAL' | 'NENHUM' = 'NENHUM';
    if (unit === 'HGE' && prog === 'Hospitalar' && tipo === 'Mensal') {
      cronograma_id = 'sch-1';
      cronograma_vinculo = 'AUTOMÁTICO';
    } else if (unit === 'HEMOAR' && prog === 'Almoxarifado' && tipo === 'Mensal') {
      cronograma_id = 'sch-2';
      cronograma_vinculo = 'AUTOMÁTICO';
    } else if (unit === 'HMA' && prog === 'Hospitalar' && tipo === 'Mensal') {
      cronograma_id = 'sch-3';
      cronograma_vinculo = 'AUTOMÁTICO';
    } else if (unit === 'HRM' && prog === 'Nutricional' && tipo === 'Semanal') {
      cronograma_id = 'sch-4';
      cronograma_vinculo = 'AUTOMÁTICO';
    } else if (unit === 'LACEN' && prog === 'LACEN' && tipo === 'Quinzenal') {
      cronograma_id = 'sch-5';
      cronograma_vinculo = 'AUTOMÁTICO';
    }

    const itemsCount = 8 + ((i * 7) % 73);
    const validatedDate = day <= 23 ? `2026-09-${dayStr} 11:20` : undefined;
    const separatedDate = day <= 22 ? `2026-09-${String(day + 1).padStart(2, '0')} 14:00` : undefined;
    const deliveredDate = (status === 'Entregue' || status === 'Entregue Parcialmente') ? `2026-09-${String(Math.min(24, day + 2)).padStart(2, '0')} 15:45` : undefined;

    const hist = [
      `${dayStr}/09/2026 08:30 – Criada por ${requester}`,
      validatedDate ? `${dayStr}/09/2026 11:20 – Aprovada por ${validator}` : null,
      separatedDate ? `${String(day + 1).padStart(2, '0')}/09/2026 14:00 – Em separação por ${picker}` : null,
      deliveredDate ? `${String(Math.min(24, day + 2)).padStart(2, '0')}/09/2026 15:45 – Entregue por ${driver}` : null,
    ].filter(Boolean).join('\n');

    orders.push({
      id: `ord-${codeNum}`,
      codigo: code,
      origem: i % 18 === 0 ? 'MANUAL' : 'IMPORTAÇÃO',
      tipo,
      solicitante: requester,
      cpf: `123.456.${String(codeNum).slice(-3)}-00`,
      programa: prog,
      unidade: unit,
      quantidade_itens: itemsCount,
      criado_em: createdDate,
      data_inicio: `2026-09-${dayStr}`,
      data_solicitacao: `2026-09-${dayStr}`,
      status_origem: status,
      status_operacional: status,
      validador: validatedDate ? validator : undefined,
      validada_em: validatedDate,
      separador: separatedDate ? picker : undefined,
      separado_em: separatedDate,
      entregador: deliveredDate ? driver : undefined,
      entregue_em: deliveredDate,
      cronograma_id,
      cronograma_vinculo,
      prioridade,
      observacoes: i % 7 === 0 ? `Acompanhamento prioritário solicitado pela direção de ${unit}.` : undefined,
      historico_original: hist,
      criado_no_sistema_em: `2026-09-${dayStr}T08:30:00Z`,
      atualizado_em: deliveredDate ? `${deliveredDate.replace(' ', 'T')}:00Z` : `2026-09-${dayStr}T08:30:00Z`,
    });
  }

  // Parse events for each order
  orders.forEach(o => {
    o.eventos = parseHistoryToEvents(o.id, o.historico_original, o.solicitante);
  });

  return orders;
}
