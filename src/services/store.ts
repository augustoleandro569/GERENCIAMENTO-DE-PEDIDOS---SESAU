import {
  Order,
  Schedule,
  HospitalUnit,
  Program,
  RequestTypeConfig,
  ImportRecord,
  AuditLog,
  UserProfile,
  SystemSettings,
  OrderStatus,
  OrderEvent
} from '../types';
import {
  INITIAL_UNITS,
  INITIAL_PROGRAMS,
  INITIAL_TYPES,
  INITIAL_SCHEDULES,
  generateSeedOrders
} from './mockData';
import { parseHistoryToEvents } from '../utils/historyParser';
import { ImportAnalysis } from '../utils/spreadsheet';

const STORAGE_KEYS = {
  ORDERS: 'gp_orders_v1',
  SCHEDULES: 'gp_schedules_v1',
  UNITS: 'gp_units_v1',
  PROGRAMS: 'gp_programs_v1',
  TYPES: 'gp_types_v1',
  IMPORTS: 'gp_imports_v1',
  AUDIT: 'gp_audit_v1',
  USER: 'gp_user_v1',
  SETTINGS: 'gp_settings_v1',
};

const DEFAULT_USER: UserProfile = {
  id: 'usr-1',
  nome: 'Rodrigo Cesar de Moura',
  email: 'rodrigo.moura@sesau.al.gov.br',
  cargo: 'Coordenador de Logística Hospitalar',
  role: 'ADMIN',
  unidade_padrao: 'SESAU Central',
};

const DEFAULT_SETTINGS: SystemSettings = {
  horas_alerta_atencao: 48,
  auto_vincular_cronograma: true,
  status_operacional_default_mapping: {
    'Rascunho': 'Rascunho',
    'Aguardando Aprovação': 'Aguardando Aprovação',
    'Aprovada': 'Aguardando Separação',
    'Em Separação': 'Em Separação',
    'Aguardando Conferência': 'Aguardando Conferência',
    'Em Conferência': 'Em Conferência',
    'Expedida': 'Expedida',
    'Em Transporte': 'Em Transporte',
    'Entregue': 'Entregue',
    'Entregue Parcialmente': 'Entregue Parcialmente',
    'Rejeitada': 'Rejeitada',
    'Cancelada': 'Cancelada',
  },
};

type Listener = () => void;

class AppStore {
  private orders: Order[] = [];
  private schedules: Schedule[] = [];
  private units: HospitalUnit[] = [];
  private programs: Program[] = [];
  private orderTypes: RequestTypeConfig[] = [];
  private importRecords: ImportRecord[] = [];
  private auditLogs: AuditLog[] = [];
  private currentUser: UserProfile = DEFAULT_USER;
  private settings: SystemSettings = DEFAULT_SETTINGS;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      } else {
        this.orders = generateSeedOrders();
        this.save(STORAGE_KEYS.ORDERS, this.orders);
      }

      const storedSchedules = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      this.schedules = storedSchedules ? JSON.parse(storedSchedules) : INITIAL_SCHEDULES;

      const storedUnits = localStorage.getItem(STORAGE_KEYS.UNITS);
      this.units = storedUnits ? JSON.parse(storedUnits) : INITIAL_UNITS;

      const storedPrograms = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      this.programs = storedPrograms ? JSON.parse(storedPrograms) : INITIAL_PROGRAMS;

      const storedTypes = localStorage.getItem(STORAGE_KEYS.TYPES);
      this.orderTypes = storedTypes ? JSON.parse(storedTypes) : INITIAL_TYPES;

      const storedImports = localStorage.getItem(STORAGE_KEYS.IMPORTS);
      this.importRecords = storedImports ? JSON.parse(storedImports) : [
        {
          id: 'imp-seed-1',
          arquivo: 'relatorio-solicitacoes-setembro.xlsx',
          data_importacao: '2026-09-24T08:00:00Z',
          usuario: 'Rodrigo Cesar (Carga Inicial)',
          quantidade_registros: 631,
          novos: 631,
          atualizados: 0,
          sem_alteracao: 0,
          erros: 0,
        }
      ];

      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);
      this.auditLogs = storedAudit ? JSON.parse(storedAudit) : [];

      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      this.currentUser = storedUser ? JSON.parse(storedUser) : DEFAULT_USER;

      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      this.settings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;
    } catch (err) {
      console.error('Failed to initialize storage, falling back to mock data:', err);
      this.orders = generateSeedOrders();
      this.schedules = INITIAL_SCHEDULES;
      this.units = INITIAL_UNITS;
      this.programs = INITIAL_PROGRAMS;
      this.orderTypes = INITIAL_TYPES;
    }
  }

  private save(key: string, data: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed (quota or disabled):', e);
    }
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Getters
  public getOrders(): Order[] { return this.orders; }
  public getSchedules(): Schedule[] { return this.schedules; }
  public getUnits(): HospitalUnit[] { return this.units; }
  public getPrograms(): Program[] { return this.programs; }
  public getOrderTypes(): RequestTypeConfig[] { return this.orderTypes; }
  public getImportRecords(): ImportRecord[] { return this.importRecords; }
  public getAuditLogs(): AuditLog[] { return this.auditLogs; }
  public getCurrentUser(): UserProfile { return this.currentUser; }
  public getSettings(): SystemSettings { return this.settings; }

  public setCurrentUser(user: UserProfile) {
    this.currentUser = user;
    this.save(STORAGE_KEYS.USER, this.currentUser);
    this.notify();
  }

  public updateSettings(partial: Partial<SystemSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.save(STORAGE_KEYS.SETTINGS, this.settings);
    this.notify();
  }

  // Match schedule automatically (supports multi-unit schedules)
  public findMatchingSchedule(unit: string, program: string, tipo: string): Schedule | undefined {
    const unitUpper = (unit || '').toUpperCase().trim();
    return this.schedules.find(s => {
      if (!s.ativo) return false;
      const primaryMatches = s.unidade && s.unidade.toUpperCase().trim() === unitUpper;
      const arrayMatches = s.unidades && s.unidades.some(u => u.toUpperCase().trim() === unitUpper);
      const csvMatches = s.unidade && s.unidade.split(',').map(x => x.trim().toUpperCase()).includes(unitUpper);
      const unitMatches = primaryMatches || arrayMatches || csvMatches;
      return (
        unitMatches &&
        s.programa.toUpperCase() === program.toUpperCase() &&
        s.tipo_pedido.toUpperCase() === tipo.toUpperCase()
      );
    });
  }

  // Add Order manually
  public addOrder(orderData: Omit<Order, 'id' | 'criado_no_sistema_em' | 'atualizado_em' | 'eventos'>, user: UserProfile): Order {
    const id = `ord-${Date.now()}`;
    const now = new Date().toISOString();

    // Check automatic schedule linking
    let cronograma_id = orderData.cronograma_id;
    let cronograma_vinculo = orderData.cronograma_vinculo || 'NENHUM';

    if (!cronograma_id && this.settings.auto_vincular_cronograma) {
      const match = this.findMatchingSchedule(orderData.unidade, orderData.programa, orderData.tipo);
      if (match) {
        cronograma_id = match.id;
        cronograma_vinculo = 'AUTOMÁTICO';
      }
    }

    const events: OrderEvent[] = [
      {
        id: `evt-${id}-1`,
        pedido_id: id,
        tipo_evento: 'Criação Manual',
        status: orderData.status_operacional,
        data_evento: now,
        responsavel: user.nome,
        origem: 'MANUAL',
        observacao: 'Pedido cadastrado manualmente no sistema',
      }
    ];

    const newOrder: Order = {
      ...orderData,
      id,
      cronograma_id,
      cronograma_vinculo,
      origem: 'MANUAL',
      criado_no_sistema_em: now,
      atualizado_em: now,
      eventos: events,
      historico_original: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – Criada por ${user.nome}`,
    };

    this.orders.unshift(newOrder);
    this.save(STORAGE_KEYS.ORDERS, this.orders);

    this.addAuditLog({
      pedido_id: id,
      codigo_pedido: newOrder.codigo,
      usuario: user.nome,
      data_hora: now,
      campo_alterado: 'Criação de Pedido',
      valor_anterior: '—',
      novo_valor: `Status: ${newOrder.status_operacional} | Itens: ${newOrder.quantidade_itens}`,
    });

    this.notify();
    return newOrder;
  }

  // Update operational status with audit log
  public updateOperationalStatus(id: string, newStatus: OrderStatus, user: UserProfile, note?: string) {
    const orderIndex = this.orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return;

    const current = this.orders[orderIndex];
    if (current.status_operacional === newStatus && !note) return;

    const oldStatus = current.status_operacional;
    const now = new Date().toISOString();

    const newEvent: OrderEvent = {
      id: `evt-${id}-${Date.now()}`,
      pedido_id: id,
      tipo_evento: `Status Operacional: ${newStatus}`,
      status: newStatus,
      data_evento: now,
      responsavel: user.nome,
      origem: 'MANUAL',
      observacao: note || undefined,
    };

    const updatedEvents = [...(current.eventos || []), newEvent];

    // Specific date fields based on operational progress
    const updates: Partial<Order> = {
      status_operacional: newStatus,
      atualizado_em: now,
      eventos: updatedEvents,
    };

    if (newStatus === 'Aprovada' && !current.validador) {
      updates.validador = user.nome;
      updates.validado_em = now;
    } else if (newStatus === 'Em Separação' && !current.separador) {
      updates.separador = user.nome;
      updates.separado_em = now;
    } else if (newStatus === 'Em Conferência' && !current.conferente) {
      updates.conferente = user.nome;
      updates.conferido_em = now;
    } else if (newStatus === 'Expedida' && !current.expedidor) {
      updates.expedidor = user.nome;
      updates.expedido_em = now;
    } else if (newStatus === 'Em Transporte' && !current.entregador) {
      updates.entregador = user.nome;
    } else if (newStatus === 'Entregue' && !current.entregue_em) {
      updates.entregue_em = now;
    }

    this.orders[orderIndex] = {
      ...current,
      ...updates,
    };

    this.save(STORAGE_KEYS.ORDERS, this.orders);

    this.addAuditLog({
      pedido_id: id,
      codigo_pedido: current.codigo,
      usuario: user.nome,
      data_hora: now,
      campo_alterado: 'Status Operacional',
      valor_anterior: oldStatus,
      novo_valor: newStatus + (note ? ` (Obs: ${note})` : ''),
    });

    this.notify();
  }

  // Update any field on order
  public updateOrder(id: string, partial: Partial<Order>, user: UserProfile, reason?: string) {
    const idx = this.orders.findIndex(o => o.id === id);
    if (idx === -1) return;

    const current = this.orders[idx];
    const now = new Date().toISOString();

    // Log key changes to audit
    Object.keys(partial).forEach(k => {
      const key = k as keyof Order;
      if (key !== 'atualizado_em' && key !== 'eventos' && current[key] !== partial[key]) {
        this.addAuditLog({
          pedido_id: id,
          codigo_pedido: current.codigo,
          usuario: user.nome,
          data_hora: now,
          campo_alterado: String(key),
          valor_anterior: String(current[key] ?? '—'),
          novo_valor: String(partial[key] ?? '—'),
        });
      }
    });

    this.orders[idx] = {
      ...current,
      ...partial,
      atualizado_em: now,
    };

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    this.notify();
  }

  // Process Import idempotently
  public processImport(analysis: ImportAnalysis, user: UserProfile): ImportRecord {
    const now = new Date().toISOString();
    const importId = `imp-${Date.now()}`;
    const existingMap = new Map<string, Order>();
    this.orders.forEach(o => existingMap.set(o.codigo.toUpperCase().trim(), o));

    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const item of analysis.items) {
      if (item.action === 'ERRO') {
        errorCount++;
        continue;
      }

      const row = item.row;
      const codeKey = row.codigo.toUpperCase().trim();
      const existing = existingMap.get(codeKey);

      // Check if unit needs auto-registration
      const existingUnit = this.units.find(u => u.sigla.toUpperCase() === row.unidade.toUpperCase() || u.nome.toUpperCase() === row.unidade.toUpperCase());
      if (!existingUnit && row.unidade) {
        this.units.push({
          id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          sigla: row.unidade.toUpperCase().slice(0, 10),
          nome: row.unidade,
          municipio: 'Alagoas',
          tipo: 'Hospital',
          ativa: true,
        });
        this.save(STORAGE_KEYS.UNITS, this.units);
      }

      if (!existing) {
        // CREATE NEW ORDER
        const id = `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        let cronograma_id: string | null = null;
        let cronograma_vinculo: 'AUTOMÁTICO' | 'MANUAL' | 'NENHUM' = 'NENHUM';
        const match = this.findMatchingSchedule(row.unidade, row.programa, row.tipo);
        if (match) {
          cronograma_id = match.id;
          cronograma_vinculo = 'AUTOMÁTICO';
        }

        const initialOperationalStatus = (this.settings.status_operacional_default_mapping[row.status] || row.status) as OrderStatus;
        const events = parseHistoryToEvents(id, row.historico, row.solicitante);

        const newOrder: Order = {
          id,
          codigo: row.codigo,
          origem: 'IMPORTAÇÃO',
          tipo: row.tipo,
          solicitante: row.solicitante,
          cpf: row.cpf,
          programa: row.programa,
          unidade: row.unidade,
          quantidade_itens: row.itens,
          criado_em: row.criada_em,
          status_origem: row.status as OrderStatus,
          status_operacional: initialOperationalStatus,
          validador: row.validador,
          validada_em: row.validada_em,
          separador: row.separador,
          separado_em: row.separada_em,
          entregador: row.entregador,
          entregue_em: row.entregue_em,
          historico_original: row.historico || '',
          eventos: events,
          cronograma_id,
          cronograma_vinculo,
          prioridade: row.tipo === 'Emergencial' ? 'Urgente' : row.tipo === 'Falta' ? 'Alta' : 'Normal',
          importacao_id: importId,
          criado_no_sistema_em: now,
          atualizado_em: now,
        };

        this.orders.unshift(newOrder);
        existingMap.set(codeKey, newOrder);
        newCount++;

        this.addAuditLog({
          pedido_id: id,
          codigo_pedido: newOrder.codigo,
          usuario: user.nome,
          data_hora: now,
          campo_alterado: 'Importação (Novo Registro)',
          valor_anterior: '—',
          novo_valor: `Importado de ${analysis.fileName} | Status Origem: ${newOrder.status_origem}`,
        });
      } else {
        // UPDATE EXISTING ORDER
        // Important: Update status_origem and data from file, but DO NOT overwrite manual operational status!
        let hasChanged = false;
        const current = existing;

        if (current.status_origem !== row.status) {
          this.addAuditLog({
            pedido_id: current.id,
            codigo_pedido: current.codigo,
            usuario: user.nome,
            data_hora: now,
            campo_alterado: 'Status Origem (Atualização Importação)',
            valor_anterior: current.status_origem,
            novo_valor: row.status,
          });
          current.status_origem = row.status as OrderStatus;
          hasChanged = true;
        }

        if (current.quantidade_itens !== row.itens) {
          current.quantidade_itens = row.itens;
          hasChanged = true;
        }

        if (row.validador && current.validador !== row.validador) {
          current.validador = row.validador;
          current.validada_em = row.validada_em || current.validada_em;
          hasChanged = true;
        }

        if (row.separador && current.separador !== row.separador) {
          current.separador = row.separador;
          current.separado_em = row.separada_em || current.separado_em;
          hasChanged = true;
        }

        if (row.entregador && current.entregador !== row.entregador) {
          current.entregador = row.entregador;
          current.entregue_em = row.entregue_em || current.entregue_em;
          hasChanged = true;
        }

        if (row.historico && row.historico !== current.historico_original) {
          current.historico_original = row.historico;
          // Add newly parsed events without erasing previous
          const newParsedEvents = parseHistoryToEvents(current.id, row.historico, row.solicitante);
          current.eventos = newParsedEvents;
          hasChanged = true;
        }

        if (hasChanged) {
          current.atualizado_em = now;
          current.importacao_id = importId;
          updateCount++;
        } else {
          unchangedCount++;
        }
      }
    }

    const record: ImportRecord = {
      id: importId,
      arquivo: analysis.fileName,
      data_importacao: now,
      usuario: user.nome,
      quantidade_registros: analysis.totalFound,
      novos: newCount,
      atualizados: updateCount,
      sem_alteracao: unchangedCount,
      erros: errorCount,
    };

    this.importRecords.unshift(record);
    this.save(STORAGE_KEYS.ORDERS, this.orders);
    this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);

    this.notify();
    return record;
  }

  // Audit logging helper
  private addAuditLog(entry: Omit<AuditLog, 'id'>) {
    const log: AuditLog = {
      ...entry,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    };
    this.auditLogs.unshift(log);
    // Limit to 500 logs to prevent memory saturation
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
  }

  // Schedule CRUD
  public addSchedule(scheduleData: Omit<Schedule, 'id'>): Schedule {
    const id = `sch-${Date.now()}`;
    const newSch: Schedule = { ...scheduleData, id };
    this.schedules.push(newSch);

    if (this.settings.auto_vincular_cronograma) {
      let linked = false;
      this.orders.forEach(order => {
        if (!order.cronograma_id) {
          const match = this.findMatchingSchedule(order.unidade, order.programa, order.tipo);
          if (match && match.id === id) {
            order.cronograma_id = id;
            order.cronograma_vinculo = 'AUTOMÁTICO';
            if (!order.data_prevista_entrega && newSch.data_entrega) {
              order.data_prevista_entrega = newSch.data_entrega;
            }
            linked = true;
          }
        }
      });
      if (linked) {
        this.save(STORAGE_KEYS.ORDERS, this.orders);
      }
    }

    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.notify();
    return newSch;
  }

  public addSchedules(schedulesData: Omit<Schedule, 'id'>[]): Schedule[] {
    const timestamp = Date.now();
    const created: Schedule[] = schedulesData.map((data, idx) => ({
      ...data,
      id: `sch-${timestamp}-${idx}-${Math.floor(Math.random() * 1000)}`,
    }));
    this.schedules.push(...created);

    if (this.settings.auto_vincular_cronograma) {
      let linked = false;
      this.orders.forEach(order => {
        if (!order.cronograma_id) {
          const match = this.findMatchingSchedule(order.unidade, order.programa, order.tipo);
          if (match && created.some(c => c.id === match.id)) {
            order.cronograma_id = match.id;
            order.cronograma_vinculo = 'AUTOMÁTICO';
            if (!order.data_prevista_entrega && match.data_entrega) {
              order.data_prevista_entrega = match.data_entrega;
            }
            linked = true;
          }
        }
      });
      if (linked) {
        this.save(STORAGE_KEYS.ORDERS, this.orders);
      }
    }

    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.notify();
    return created;
  }

  public updateSchedule(id: string, partial: Partial<Schedule>) {
    const idx = this.schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.schedules[idx] = { ...this.schedules[idx], ...partial };
      this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
      this.notify();
    }
  }

  public deleteSchedule(id: string) {
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.notify();
  }

  // Auto-link trigger for all unlinked orders
  public runAutoLinking(): { linkedCount: number } {
    let linkedCount = 0;
    this.orders.forEach(order => {
      if (!order.cronograma_id) {
        const match = this.findMatchingSchedule(order.unidade, order.programa, order.tipo);
        if (match) {
          order.cronograma_id = match.id;
          order.cronograma_vinculo = 'AUTOMÁTICO';
          linkedCount++;
        }
      }
    });

    if (linkedCount > 0) {
      this.save(STORAGE_KEYS.ORDERS, this.orders);
      this.notify();
    }
    return { linkedCount };
  }

  // Unit CRUD
  public addUnit(unitData: Omit<HospitalUnit, 'id'>): HospitalUnit {
    const id = `u-${Date.now()}`;
    const unit: HospitalUnit = { ...unitData, id };
    this.units.push(unit);
    this.save(STORAGE_KEYS.UNITS, this.units);
    this.notify();
    return unit;
  }

  public updateUnit(id: string, partial: Partial<HospitalUnit>) {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx] = { ...this.units[idx], ...partial };
      this.save(STORAGE_KEYS.UNITS, this.units);
      this.notify();
    }
  }

  // Reset to initial 631 records
  public resetToDefault() {
    this.orders = generateSeedOrders();
    this.schedules = INITIAL_SCHEDULES;
    this.units = INITIAL_UNITS;
    this.programs = INITIAL_PROGRAMS;
    this.orderTypes = INITIAL_TYPES;
    this.auditLogs = [];
    this.importRecords = [
      {
        id: 'imp-seed-1',
        arquivo: 'relatorio-solicitacoes-setembro.xlsx',
        data_importacao: '2026-09-24T08:00:00Z',
        usuario: 'Rodrigo Cesar (Carga Inicial)',
        quantidade_registros: 631,
        novos: 631,
        atualizados: 0,
        sem_alteracao: 0,
        erros: 0,
      }
    ];

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.save(STORAGE_KEYS.UNITS, this.units);
    this.save(STORAGE_KEYS.PROGRAMS, this.programs);
    this.save(STORAGE_KEYS.TYPES, this.orderTypes);
    this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);

    this.notify();
  }
}

export const store = new AppStore();
