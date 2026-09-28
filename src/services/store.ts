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
} from './mockData';
import { parseHistoryToEvents } from '../utils/historyParser';
import { ImportAnalysis } from '../utils/spreadsheet';
import { dbSync } from './dbSync';

const STORAGE_KEYS = {
  ORDERS: 'gp_orders_backend_v2',
  SCHEDULES: 'gp_schedules_backend_v2',
  UNITS: 'gp_units_backend_v2',
  PROGRAMS: 'gp_programs_backend_v2',
  TYPES: 'gp_types_backend_v2',
  IMPORTS: 'gp_imports_backend_v2',
  AUDIT: 'gp_audit_backend_v2',
  USER: 'gp_user_v2',
  SETTINGS: 'gp_settings_v2',
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
  private programs: Program[] = INITIAL_PROGRAMS;
  private orderTypes: RequestTypeConfig[] = INITIAL_TYPES;
  private importRecords: ImportRecord[] = [];
  private auditLogs: AuditLog[] = [];
  private currentUser: UserProfile = DEFAULT_USER;
  private settings: SystemSettings = DEFAULT_SETTINGS;
  private listeners: Set<Listener> = new Set();
  private isLoadedFromBackend = false;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Purge legacy mock data from old versions to ensure strict backend alignment
    try {
      localStorage.removeItem('gp_orders_v1');
      localStorage.removeItem('gp_imports_v1');
      localStorage.removeItem('gp_schedules_v1');
      localStorage.removeItem('gp_units_v1');
    } catch {
      // Ignore
    }

    // 2. Load cached records if available
    try {
      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      }

      const storedSchedules = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (storedSchedules) {
        this.schedules = JSON.parse(storedSchedules);
      }

      const storedUnits = localStorage.getItem(STORAGE_KEYS.UNITS);
      if (storedUnits) {
        this.units = JSON.parse(storedUnits);
      }

      const storedImports = localStorage.getItem(STORAGE_KEYS.IMPORTS);
      if (storedImports) {
        this.importRecords = JSON.parse(storedImports);
      }

      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);
      if (storedAudit) {
        this.auditLogs = JSON.parse(storedAudit);
      }

      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }

      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      }
    } catch (err) {
      console.warn('Cache read warning:', err);
    }

    // 3. Setup real-time listener handlers
    dbSync.setChangeListeners(
      (payload) => this.handleRemoteOrderPayload(payload),
      (payload) => this.handleRemoteSchedulePayload(payload)
    );

    // 4. Immediately trigger strict backend fetch (Supabase)
    setTimeout(() => {
      this.loadBackendData();
    }, 20);

    // 5. Also listen to Firestore fallback
    setTimeout(() => {
      dbSync.initFirestore(
        (remoteOrders) => {
          if (!this.isLoadedFromBackend && remoteOrders && remoteOrders.length > 0) {
            this.orders = remoteOrders;
            this.save(STORAGE_KEYS.ORDERS, this.orders);
            this.notify();
          }
        },
        (remoteSchedules) => {
          if (this.schedules.length === 0 && remoteSchedules && remoteSchedules.length > 0) {
            this.schedules = remoteSchedules;
            this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
            this.notify();
          }
        },
        (remoteUnits) => {
          if (this.units.length === 0 && remoteUnits && remoteUnits.length > 0) {
            this.units = remoteUnits;
            this.save(STORAGE_KEYS.UNITS, this.units);
            this.notify();
          }
        }
      );
    }, 150);
  }

  // Load 100% real records directly from the database backend
  public async loadBackendData(): Promise<{ success: boolean; count: number; message?: string }> {
    try {
      const res = await dbSync.syncStrictFromSupabase();
      if (res.success) {
        this.isLoadedFromBackend = true;
        // Strictly use backend data. Drop any uncommitted/mock rows!
        this.orders = res.orders;
        if (res.schedules.length > 0) {
          this.schedules = res.schedules;
        }
        if (res.units.length > 0) {
          this.units = res.units;
        }

        // Cache the verified backend dataset
        this.save(STORAGE_KEYS.ORDERS, this.orders);
        this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
        this.save(STORAGE_KEYS.UNITS, this.units);

        this.notify();
        return { success: true, count: this.orders.length };
      }
      return { success: false, count: this.orders.length, message: res.message };
    } catch (err: any) {
      console.error('Failed to load backend data:', err);
      return { success: false, count: this.orders.length, message: err.message || String(err) };
    }
  }

  // Handle live Postgres changes from Supabase
  private handleRemoteOrderPayload(payload: any) {
    if (!payload || !payload.eventType) return;
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' && newRecord) {
      const exists = this.orders.some(o => o.id === newRecord.id);
      if (!exists) {
        this.orders.unshift(newRecord as Order);
        this.save(STORAGE_KEYS.ORDERS, this.orders);
        this.notify();
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      const idx = this.orders.findIndex(o => o.id === newRecord.id);
      if (idx !== -1) {
        this.orders[idx] = { ...this.orders[idx], ...(newRecord as Order) };
        this.save(STORAGE_KEYS.ORDERS, this.orders);
        this.notify();
      }
    } else if (eventType === 'DELETE' && oldRecord) {
      this.orders = this.orders.filter(o => o.id !== oldRecord.id);
      this.save(STORAGE_KEYS.ORDERS, this.orders);
      this.notify();
    }
  }

  private handleRemoteSchedulePayload(payload: any) {
    if (!payload || !payload.eventType) return;
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' && newRecord) {
      if (!this.schedules.some(s => s.id === newRecord.id)) {
        this.schedules.push(newRecord as Schedule);
        this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
        this.notify();
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      const idx = this.schedules.findIndex(s => s.id === newRecord.id);
      if (idx !== -1) {
        this.schedules[idx] = { ...this.schedules[idx], ...(newRecord as Schedule) };
        this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
        this.notify();
      }
    } else if (eventType === 'DELETE' && oldRecord) {
      this.schedules = this.schedules.filter(s => s.id !== oldRecord.id);
      this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
      this.notify();
    }
  }

  private save(key: string, data: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save note:', e);
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
    const progUpper = (program || '').toUpperCase().trim();
    const tipoUpper = (tipo || '').toUpperCase().trim();

    return this.schedules.find(s => {
      if (!s.ativo) return false;
      const sUnit = (s.unidade || '').toUpperCase().trim();
      const sProg = (s.programa || '').toUpperCase().trim();
      const sTipo = (s.tipo_pedido || '').toUpperCase().trim();

      const unitMatches = sUnit === 'TODAS' || sUnit === 'TODOS' || sUnit === unitUpper || sUnit.split(/[,;\s]+/).includes(unitUpper);
      const progMatches = sProg === progUpper;
      const tipoMatches = sTipo === tipoUpper;

      return unitMatches && progMatches && tipoMatches;
    });
  }

  // Add new order
  public addOrder(
    orderData: Omit<Order, 'id' | 'codigo' | 'criado_no_sistema_em' | 'atualizado_em' | 'eventos'> & { codigo?: string },
    responsavel?: string | UserProfile
  ): Order {
    const now = new Date().toISOString();
    const dateFormatted = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const userNome = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);

    let code = orderData.codigo;
    if (!code) {
      const maxExisting = this.orders.reduce((max, o) => {
        const match = o.codigo.match(/SOL-\d{4}-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 3074);
      code = `SOL-2026-${String(maxExisting + 1).padStart(5, '0')}`;
    }

    const orderId = `ord-${Date.now()}`;
    const initialEvent: OrderEvent = {
      id: `evt-${orderId}-1`,
      pedido_id: orderId,
      tipo_evento: 'Criação do Pedido',
      status: orderData.status_operacional || 'Aguardando Aprovação',
      data_evento: dateFormatted,
      responsavel: orderData.solicitante || userNome,
      origem: 'MANUAL',
      observacao: orderData.observacoes,
    };

    let cronogramaId = orderData.cronograma_id;
    let cronogramaVinculo = orderData.cronograma_vinculo || 'NENHUM';
    let dataPrevistaEntrega = orderData.data_prevista_entrega;

    if (!cronogramaId && this.settings.auto_vincular_cronograma) {
      const matchedSchedule = this.findMatchingSchedule(orderData.unidade, orderData.programa, orderData.tipo);
      if (matchedSchedule) {
        cronogramaId = matchedSchedule.id;
        cronogramaVinculo = 'AUTOMÁTICO';
        if (!dataPrevistaEntrega && matchedSchedule.data_entrega) {
          dataPrevistaEntrega = matchedSchedule.data_entrega;
        }
      }
    }

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      codigo: code,
      cronograma_id: cronogramaId,
      cronograma_vinculo: cronogramaVinculo,
      data_prevista_entrega: dataPrevistaEntrega,
      eventos: [initialEvent],
      historico_original: `${dateFormatted} – Criada por ${orderData.solicitante || userNome}`,
      criado_no_sistema_em: now,
      atualizado_em: now,
    };

    this.orders.unshift(newOrder);
    this.save(STORAGE_KEYS.ORDERS, this.orders);
    dbSync.saveOrder(newOrder);

    this.addAuditLog({
      pedido_id: newOrder.id,
      codigo_pedido: newOrder.codigo,
      usuario: userNome,
      data_hora: now,
      campo_alterado: 'Criação',
      valor_anterior: 'Nenhum',
      novo_valor: `Pedido criado com status ${newOrder.status_operacional}`,
    });

    this.notify();
    return newOrder;
  }

  // Quick 1-click update for operational status
  public updateOperationalStatus(
    orderId: string,
    newStatus: OrderStatus,
    responsavel?: string | UserProfile,
    observacao?: string
  ): boolean {
    const orderIndex = this.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return false;

    const current = this.orders[orderIndex];
    const previousStatus = current.status_operacional;
    if (previousStatus === newStatus) return true;

    const now = new Date().toISOString();
    const dateFormatted = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const user = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);

    const updates: Partial<Order> = {
      status_operacional: newStatus,
      atualizado_em: now,
    };

    let eventType = `Alteração para ${newStatus}`;

    if (newStatus === 'Aguardando Separação' || newStatus === 'Aprovada') {
      eventType = 'Aprovação';
      updates.validador = user;
      updates.validada_em = dateFormatted;
      if (!current.data_aprovacao) updates.data_aprovacao = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'Em Separação') {
      eventType = 'Separação Iniciada';
      updates.separador = user;
      updates.separado_em = dateFormatted;
      if (!current.data_inicio_separacao) updates.data_inicio_separacao = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'Aguardando Conferência') {
      eventType = 'Separação Concluída';
      if (!current.separador) updates.separador = user;
      if (!current.separado_em) updates.separado_em = dateFormatted;
    } else if (newStatus === 'Em Conferência') {
      eventType = 'Conferência Iniciada';
      updates.conferente = user;
      updates.conferido_em = dateFormatted;
    } else if (newStatus === 'Expedida') {
      eventType = 'Expedição';
      updates.expedidor = user;
      updates.expedido_em = dateFormatted;
      if (!current.data_expedicao) updates.data_expedicao = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'Em Transporte') {
      eventType = 'Saída para Entrega';
      updates.entregador = user;
    } else if (newStatus === 'Entregue' || newStatus === 'Entregue Parcialmente') {
      eventType = newStatus === 'Entregue' ? 'Entrega Realizada' : 'Entrega Parcial';
      updates.entregador = user;
      updates.entregue_em = dateFormatted;
    }

    const newEvent: OrderEvent = {
      id: `evt-${orderId}-${Date.now()}`,
      pedido_id: orderId,
      tipo_evento: eventType,
      status: newStatus,
      data_evento: dateFormatted,
      responsavel: user,
      origem: 'SISTEMA',
      observacao: observacao,
    };

    const currentEvents = current.eventos || [];
    updates.eventos = [...currentEvents, newEvent];

    const histLine = `${dateFormatted} – ${newStatus} por ${user}${observacao ? ` (${observacao})` : ''}`;
    updates.historico_original = current.historico_original
      ? `${current.historico_original}\n${histLine}`
      : histLine;

    this.orders[orderIndex] = {
      ...current,
      ...updates,
    };

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    dbSync.saveOrder(this.orders[orderIndex]);

    this.addAuditLog({
      pedido_id: orderId,
      codigo_pedido: current.codigo,
      usuario: user,
      data_hora: now,
      campo_alterado: 'Status Operacional',
      valor_anterior: previousStatus,
      novo_valor: newStatus,
    });

    this.notify();
    return true;
  }

  // Update order fields
  public updateOrder(
    orderId: string,
    partial: Partial<Order>,
    responsavel?: string | UserProfile,
    observacao?: string
  ) {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;

    const current = this.orders[idx];
    const now = new Date().toISOString();
    const user = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);

    this.orders[idx] = {
      ...current,
      ...partial,
      atualizado_em: now,
    };

    if (observacao) {
      this.addAuditLog({
        pedido_id: orderId,
        codigo_pedido: current.codigo,
        usuario: user,
        data_hora: now,
        campo_alterado: 'Atualização de Dados',
        valor_anterior: 'Registro Anterior',
        novo_valor: observacao,
      });
    }

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    dbSync.saveOrder(this.orders[idx]);
    this.notify();
  }

  // Process Import idempotently
  public processImport(analysis: ImportAnalysis, responsavel?: string | UserProfile): ImportRecord {
    const now = new Date().toISOString();
    const importId = `imp-${Date.now()}`;
    const userNome = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);

    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const item of analysis.items) {
      if (item.action === 'ERRO' || !item.row) {
        errorCount++;
        continue;
      }

      const row = item.row;

      if (item.action === 'NOVO') {
        newCount++;
        const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const parsedEvents = parseHistoryToEvents(orderId, row.historico, row.solicitante);

        let cronogramaId = undefined;
        let cronogramaVinculo: 'AUTOMÁTICO' | 'MANUAL' | 'NENHUM' = 'NENHUM';
        let dataPrevista = undefined;

        if (this.settings.auto_vincular_cronograma) {
          const match = this.findMatchingSchedule(row.unidade, row.programa, row.tipo);
          if (match) {
            cronogramaId = match.id;
            cronogramaVinculo = 'AUTOMÁTICO';
            dataPrevista = match.data_entrega;
          }
        }

        const newOrder: Order = {
          id: orderId,
          codigo: row.codigo,
          origem: 'IMPORTAÇÃO',
          tipo: row.tipo,
          solicitante: row.solicitante,
          cpf: row.cpf,
          programa: row.programa,
          unidade: row.unidade,
          quantidade_itens: row.itens,
          criado_em: row.criada_em || row.data_solicitacao || '',
          data_inicio: row.data_solicitacao,
          data_solicitacao: row.data_solicitacao,
          data_aprovacao: row.data_aprovacao,
          data_inicio_separacao: row.data_inicio_separacao,
          data_expedicao: row.data_expedicao,
          data_prevista_entrega: dataPrevista,
          status_origem: (row.status as OrderStatus) || 'Aguardando Aprovação',
          status_operacional: (row.status as OrderStatus) || 'Aguardando Aprovação',
          validador: row.validador,
          validada_em: row.validada_em,
          separador: row.separador,
          separado_em: row.separada_em,
          entregador: row.entregador,
          entregue_em: row.entregue_em,
          cronograma_id: cronogramaId,
          cronograma_vinculo: cronogramaVinculo,
          prioridade: 'Normal',
          historico_original: row.historico || '',
          importacao_id: importId,
          criado_no_sistema_em: now,
          atualizado_em: now,
          eventos: parsedEvents,
        };

        this.orders.unshift(newOrder);
      } else if (item.action === 'ATUALIZAR') {
        const current = this.orders.find(o => o.codigo === row.codigo);
        if (!current) continue;

        let hasChanged = false;

        if (current.status_origem !== row.status) {
          this.addAuditLog({
            pedido_id: current.id,
            codigo_pedido: current.codigo,
            usuario: `Importação (${userNome})`,
            data_hora: now,
            campo_alterado: 'Status via Planilha',
            valor_anterior: current.status_origem,
            novo_valor: row.status,
          });
          current.status_origem = (row.status as OrderStatus);
          current.status_operacional = (row.status as OrderStatus);
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
      } else if (item.action === 'SEM_ALTERACAO') {
        unchangedCount++;
      }
    }

    const record: ImportRecord = {
      id: importId,
      arquivo: analysis.fileName,
      data_importacao: now,
      usuario: userNome,
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
    
    // Push new records to Supabase & Firestore in background
    dbSync.pushAllToSupabase(this.orders, this.schedules, this.units).catch(e => console.warn(e));

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
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
    dbSync.saveAuditLog(log);
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
    dbSync.saveSchedule(newSch);
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
    created.forEach(s => dbSync.saveSchedule(s));
    this.notify();
    return created;
  }

  public updateSchedule(id: string, partial: Partial<Schedule>) {
    const idx = this.schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.schedules[idx] = { ...this.schedules[idx], ...partial };
      this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
      dbSync.saveSchedule(this.schedules[idx]);
      this.notify();
    }
  }

  public deleteSchedule(id: string) {
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    dbSync.deleteSchedule(id);
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
    }
    return { linkedCount };
  }

  // Unit CRUD
  public addUnit(unitData: Omit<HospitalUnit, 'id'>): HospitalUnit {
    const id = `u-${Date.now()}`;
    const unit: HospitalUnit = { ...unitData, id };
    this.units.push(unit);
    this.save(STORAGE_KEYS.UNITS, this.units);
    dbSync.saveUnit(unit);
    this.notify();
    return unit;
  }

  public updateUnit(id: string, partial: Partial<HospitalUnit>) {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx] = { ...this.units[idx], ...partial };
      this.save(STORAGE_KEYS.UNITS, this.units);
      dbSync.saveUnit(this.units[idx]);
      this.notify();
    }
  }

  // Strictly reload directly from the database backend
  public async resetToDefault() {
    return await this.loadBackendData();
  }

  public async reloadStrictFromBackend() {
    return await this.loadBackendData();
  }

  // Supabase sync integrations
  public async syncAllToSupabase() {
    return await dbSync.pushAllToSupabase(this.orders, this.schedules, this.units);
  }

  public async syncAllFromSupabase() {
    return await this.loadBackendData();
  }

  public getDatabaseStatus() {
    return dbSync.getStatus();
  }
}

export const store = new AppStore();
