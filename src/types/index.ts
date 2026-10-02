export type OrderOrigin = 'IMPORTAÇÃO' | 'MANUAL';

export type RequestType = 'Mensal' | 'Emergencial' | 'Falta' | 'Semanal' | 'Quinzenal' | string;

export type ProgramName = 
  | 'Almoxarifado' 
  | 'Hospitalar' 
  | 'Nutricional' 
  | 'Oncológico' 
  | 'Órtese e Prótese' 
  | 'LACEN' 
  | string;

export type OrderStatus =
  | 'Rascunho'
  | 'Aguardando Validação'
  | 'Aguardando Aprovação'
  | 'Aprovado'
  | 'Aprovada'
  | 'Aguardando Separação'
  | 'Em Separação'
  | 'Aguardando Conferência'
  | 'Em Conferência'
  | 'Expedida'
  | 'Em Transporte'
  | 'Entregue'
  | 'Entregue Parcialmente'
  | 'Rejeitada'
  | 'Cancelado'
  | 'Cancelada';

export type Priority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';

export type DeadlineSituation =
  | 'Dentro do prazo'
  | 'Atenção'
  | 'Atrasado'
  | 'Concluído no prazo'
  | 'Concluído com atraso'
  | 'Fora do cronograma';

export type ScheduleLinkType = 'AUTOMÁTICO' | 'MANUAL' | 'NENHUM';

export interface OrderEvent {
  id: string;
  pedido_id: string;
  tipo_evento: string;
  status: OrderStatus;
  data_evento: string;
  responsavel: string;
  origem: 'IMPORTAÇÃO' | 'MANUAL' | 'SISTEMA';
  observacao?: string;
}

export interface Order {
  id: string;
  codigo: string; // Ex: SOL-2026-03074 (Unique Key)
  origem: OrderOrigin;
  tipo: RequestType;
  solicitante: string;
  cpf: string;
  programa: ProgramName;
  unidade: string;
  quantidade_itens: number;
  criado_em: string; // ISO format or YYYY-MM-DD HH:mm
  status_origem: OrderStatus;
  status_operacional: OrderStatus;
  
  // Validation / Approval
  validador?: string;
  validada_em?: string;
  validado_em?: string;

  // Separation
  separador?: string;
  separado_em?: string;

  // Checking / Conference
  conferente?: string;
  conferido_em?: string;

  // Dispatch / Expedição
  expedidor?: string;
  expedido_em?: string;

  // Delivery
  entregador?: string;
  entregue_em?: string;

  // Raw & parsed history
  historico_original: string;
  eventos?: OrderEvent[];

  // Schedule linking
  cronograma_id?: string | null;
  cronograma_vinculo?: ScheduleLinkType;
  // Lifecycle / Phase Dates (Datas do Ciclo Operacional)
  data_inicio?: string; // Data de Inicialização do Pedido (YYYY-MM-DD ou YYYY-MM-DD HH:mm)
  data_solicitacao?: string; // YYYY-MM-DD ou YYYY-MM-DD HH:mm
  data_aprovacao?: string; // YYYY-MM-DD ou YYYY-MM-DD HH:mm
  data_inicio_separacao?: string; // YYYY-MM-DD ou YYYY-MM-DD HH:mm
  data_expedicao?: string; // YYYY-MM-DD ou YYYY-MM-DD HH:mm
  data_prevista_entrega?: string; // YYYY-MM-DD or specific calendar date

  // Operational controls
  prioridade: Priority;
  observacoes?: string;
  importacao_id?: string | null;
  
  criado_no_sistema_em: string;
  atualizado_em: string;
}

export interface Schedule {
  id: string;
  nome: string;
  competencia: string; // e.g. "SET/26", "OUT/26"
  unidade: string; // Sigla principal ou lista formatada de unidades (ex: "HGE, HEPR, HRPA")
  unidades?: string[]; // Array de siglas das unidades vinculadas a este cronograma
  programa: string;
  tipo_pedido: string;
  data_limite_solicitacao: string; // YYYY-MM-DD
  data_limite_aprovacao: string; // YYYY-MM-DD
  data_separacao: string; // YYYY-MM-DD
  data_expedicao: string; // YYYY-MM-DD
  data_entrega: string; // YYYY-MM-DD
  observacao?: string;
  ativo: boolean;
}

export interface HospitalUnit {
  id: string;
  sigla: string;
  nome: string;
  municipio: string;
  descricao?: string;
  tipo: 'Hospital' | 'UPA' | 'Maternidade' | 'Ambulatório' | 'Laboratório' | 'Hemocentro' | 'Outro';
  ativa: boolean;
}

export interface Program {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export interface RequestTypeConfig {
  id: string;
  nome: string;
  cor: string;
  prioridade_padrao: Priority;
  ativo: boolean;
}

export interface ImportRecord {
  id: string;
  arquivo: string;
  data_importacao: string;
  usuario: string;
  quantidade_registros: number;
  novos: number;
  atualizados: number;
  sem_alteracao: number;
  erros: number;
}

export interface AuditLog {
  id: string;
  pedido_id: string;
  codigo_pedido: string;
  usuario: string;
  data_hora: string;
  campo_alterado: string;
  valor_anterior: string;
  novo_valor: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  role: UserRole;
  unidade_padrao?: string;
}

export interface SystemSettings {
  horas_alerta_atencao: number; // e.g., 24 or 48 hours before deadline
  auto_vincular_cronograma: boolean;
  status_operacional_default_mapping: Record<string, OrderStatus>;
}
