import {
  Order,
  Schedule,
  HospitalUnit,
  Program,
  RequestTypeConfig,
  ImportRecord,
  ImportStatus,
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
  generateSeedOrders,
} from './mockData';
import { parseHistoryToEvents } from '../utils/historyParser';
import { ImportAnalysis } from '../utils/spreadsheet';
import { dbSync, DatabaseSaveProgress } from './dbSync';
import { CANONICAL_UNITS, cleanUnitName } from '../utils/unitNormalizer';
import { idbGet, idbSet } from '../utils/indexedDb';
import { computeRealisticItemCount } from '../utils/itemQuantity';

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
        const parsed = JSON.parse(storedOrders);
        if (Array.isArray(parsed)) {
          const seenIds = new Set<string>();
          const seenCodes = new Set<string>();
          this.orders = parsed.filter(o => {
            if (!o || !o.id || !o.codigo) return false;
            const cleanCode = o.codigo.trim().toUpperCase();
            // Reject any order that does not start with SOL-2026
            if (!cleanCode.startsWith('SOL-2026')) return false;
            // Reject duplicate codes or IDs
            if (seenIds.has(o.id) || seenCodes.has(cleanCode)) return false;
            seenIds.add(o.id);
            seenCodes.add(cleanCode);
            if (!o.quantidade_itens || o.quantidade_itens <= 1) {
              o.quantidade_itens = computeRealisticItemCount(o);
            }
            return true;
          });
        }
      }

      // Also load from IndexedDB (persists all 2,948+ orders beyond localStorage 5MB limit)
      idbGet<Order[]>(STORAGE_KEYS.ORDERS).then(idbOrders => {
        if (idbOrders && Array.isArray(idbOrders) && idbOrders.length > this.orders.length) {
          const seenIds = new Set<string>();
          const seenCodes = new Set<string>();
          this.orders = idbOrders.filter(o => {
            if (!o || !o.id || !o.codigo) return false;
            const cleanCode = o.codigo.trim().toUpperCase();
            if (!cleanCode.startsWith('SOL-2026')) return false;
            if (seenIds.has(o.id) || seenCodes.has(cleanCode)) return false;
            seenIds.add(o.id);
            seenCodes.add(cleanCode);
            if (!o.quantidade_itens || o.quantidade_itens <= 1) {
              o.quantidade_itens = computeRealisticItemCount(o);
            }
            return true;
          });
          this.notify();
        }
      }).catch(err => console.warn('IndexedDB initial load note:', err));

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

    // 5. Also listen to Firestore fallback (with guard to avoid downgrading counts)
    setTimeout(() => {
      dbSync.initFirestore(
        (remoteOrders) => {
          if (!this.isLoadedFromBackend && remoteOrders && remoteOrders.length > 0) {
            // Guard: Never downgrade if we already have more order lines loaded
            if (remoteOrders.length < this.orders.length) return;
            const seen = new Set<string>();
            this.orders = remoteOrders.filter(o => {
              if (!o || !o.id || seen.has(o.id)) return false;
              seen.add(o.id);
              return true;
            });
            idbSet(STORAGE_KEYS.ORDERS, this.orders);
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
        },
        (remoteImports) => {
          if (remoteImports && remoteImports.length > 0) {
            this.importRecords = remoteImports;
            this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
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
      if (res.success && res.orders) {
        this.isLoadedFromBackend = true;
        
        // Deduplicate backend orders and strictly enforce SOL-2026 prefix and unique codes
        const seenIds = new Set<string>();
        const seenCodes = new Set<string>();
        const backendOrders = res.orders.filter(o => {
          if (!o || !o.id || !o.codigo) return false;
          const cleanCode = o.codigo.trim().toUpperCase();
          if (!cleanCode.startsWith('SOL-2026')) return false;
          if (seenIds.has(o.id) || seenCodes.has(cleanCode)) return false;
          seenIds.add(o.id);
          seenCodes.add(cleanCode);
          if (!o.quantidade_itens || o.quantidade_itens <= 1) {
            o.quantidade_itens = computeRealisticItemCount(o);
          }
          return true;
        });

        // Merge orders intelligently by code, preserving the newest data
        const mergedMap = new Map<string, Order>();
        backendOrders.forEach(bo => {
          if (bo && bo.codigo) {
            mergedMap.set(bo.codigo.toUpperCase().trim(), bo);
          }
        });

        // If local order has more recent updates (or was imported in session), retain the latest version
        this.orders.forEach(lo => {
          if (!lo || !lo.codigo) return;
          const codeUpper = lo.codigo.toUpperCase().trim();
          const existing = mergedMap.get(codeUpper);
          if (!existing) {
            mergedMap.set(codeUpper, lo);
          } else {
            const loTime = new Date(lo.atualizado_em || lo.criado_em || 0).getTime();
            const boTime = new Date(existing.atualizado_em || existing.criado_em || 0).getTime();
            if (loTime > boTime) {
              mergedMap.set(codeUpper, lo);
            }
          }
        });

        this.orders = Array.from(mergedMap.values());

        if (res.schedules.length > 0) {
          this.schedules = res.schedules;
        }
        if (res.units.length > 0) {
          this.units = res.units;
        }

        // Cache the verified full dataset into IndexedDB and localStorage
        idbSet(STORAGE_KEYS.ORDERS, this.orders);
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
    if (key === STORAGE_KEYS.ORDERS && Array.isArray(data)) {
      // IndexedDB handles the full dataset (3,000 - 10,000+ orders) asynchronously without thread lock
      idbSet(key, data).catch(err => console.warn('IndexedDB save orders note:', err));
      try {
        if (data.length > 300) {
          // Store a lightweight cache slice in localStorage to prevent 5MB QuotaExceededError and 500ms freeze
          localStorage.setItem(key, JSON.stringify(data.slice(0, 250)));
        } else {
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {
        // Safe: data is fully preserved in IndexedDB
      }
      return;
    }
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
  public getOrders(): Order[] { return [...this.orders]; }
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

      const unitMatches = sUnit === 'TODAS' || sUnit === 'TODOS' || 
                          sUnit === unitUpper || 
                          unitUpper.includes(sUnit) || 
                          sUnit.includes(unitUpper) ||
                          sUnit.split(/[,;\s]+/).some(part => part && (part === unitUpper || unitUpper.includes(part) || part.includes(unitUpper)));
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

    let code = (orderData.codigo || '').trim().toUpperCase();
    if (!code) {
      const maxExisting = this.orders.reduce((max, o) => {
        const match = o.codigo.match(/SOL-2026-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 3074);
      code = `SOL-2026-${String(maxExisting + 1).padStart(5, '0')}`;
    } else {
      // Normalize code format if only numbers or wrong separator
      if (!code.startsWith('SOL-2026-')) {
        const digits = code.replace(/\D/g, '');
        if (digits) {
          code = `SOL-2026-${digits.padStart(5, '0')}`;
        } else {
          throw new Error('O número do pedido deve obrigatoriamente iniciar com "SOL-2026-".');
        }
      }
    }

    // STRICT CHECK: Disallow more than 1 order with the same code
    const existingOrder = this.orders.find(o => o.codigo.toUpperCase() === code);
    if (existingOrder) {
      throw new Error(`Não é permitido duplicar pedidos: Já existe um pedido ativo com o número ${code} para ${existingOrder.unidade}.`);
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

    if (observacao?.toLowerCase().includes('retro')) {
      eventType = `Retrocesso para ${newStatus}`;
    } else if (newStatus === 'Aguardando Separação' || newStatus === 'Aprovada') {
      eventType = 'Aprovação';
      updates.validador = user;
      updates.validada_em = dateFormatted;
      if (!current.data_aprovacao) updates.data_aprovacao = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'Aguardando Aprovação' || newStatus === 'Rascunho') {
      eventType = 'Retorno para Aguardando Aprovação';
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

    const updatedOrder = {
      ...current,
      ...updates,
    };

    const updatedOrders = [...this.orders];
    updatedOrders[orderIndex] = updatedOrder;
    this.orders = updatedOrders;

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    dbSync.saveOrder(updatedOrder);

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

  // Batch update multiple orders efficiently
  public updateOrders(
    orderIds: string[],
    partial: Partial<Order> | ((order: Order) => Partial<Order>),
    responsavel?: string | UserProfile,
    observacao?: string
  ): number {
    if (!orderIds || orderIds.length === 0) return 0;
    const orderSet = new Set(orderIds);
    const now = new Date().toISOString();
    const user = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);
    let updatedCount = 0;

    for (let i = 0; i < this.orders.length; i++) {
      const current = this.orders[i];
      if (orderSet.has(current.id)) {
        const patch = typeof partial === 'function' ? partial(current) : partial;
        this.orders[i] = {
          ...current,
          ...patch,
          atualizado_em: now,
        };
        updatedCount++;

        if (observacao) {
          this.addAuditLog({
            pedido_id: current.id,
            codigo_pedido: current.codigo,
            usuario: user,
            data_hora: now,
            campo_alterado: 'Atualização de Dados em Lote',
            valor_anterior: 'Registro Anterior',
            novo_valor: observacao,
          });
        }
        dbSync.saveOrder(this.orders[i]);
      }
    }

    if (updatedCount > 0) {
      this.save(STORAGE_KEYS.ORDERS, this.orders);
      this.notify();
    }
    return updatedCount;
  }

  // Process Import idempotently and feed the database directly
  public async processImport(
    analysis: ImportAnalysis, 
    responsavel?: string | UserProfile,
    onDbProgress?: (progress: DatabaseSaveProgress) => void,
    signal?: AbortSignal
  ): Promise<ImportRecord> {
    const now = new Date().toISOString();
    const importId = `imp-${Date.now()}`;
    const userNome = typeof responsavel === 'object' && responsavel !== null ? responsavel.nome : (responsavel || this.currentUser.nome);

    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    const affectedOrders: Order[] = [];
    const modifiedOrders: Order[] = [];
    const newAuditLogs: AuditLog[] = [];

    // O(1) Fast lookup index by code to eliminate quadratic O(N^2) lag on 3,000+ orders
    const existingOrdersByCode = new Map<string, Order>();
    this.orders.forEach(o => {
      if (o.codigo) {
        existingOrdersByCode.set(o.codigo.toUpperCase(), o);
      }
    });

    const newOrdersToPrepend: Order[] = [];

    for (const item of analysis.items) {
      if (item.action === 'ERRO' || !item.row) {
        errorCount++;
        continue;
      }

      const row = item.row;

      // Ensure code strictly starts with SOL-2026-
      let code = (row.codigo || '').trim().toUpperCase();
      if (!code.startsWith('SOL-2026-')) {
        const digits = code.replace(/\D/g, '');
        if (digits) {
          code = `SOL-2026-${digits.padStart(5, '0')}`;
        } else {
          // Reject non-standard orders
          errorCount++;
          continue;
        }
      }
      row.codigo = code;

      // Fast O(1) check: if code already exists in memory or in batch, treat as update to prevent duplicate
      const existingInOrders = existingOrdersByCode.get(code);
      if (item.action === 'NOVO' && existingInOrders) {
        item.action = 'ATUALIZAR';
      }

      if (item.action === 'NOVO') {
        newCount++;
        const cleanCodeSlug = code.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const orderId = existingInOrders?.id || `ord-${cleanCodeSlug}`;
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

        newOrdersToPrepend.push(newOrder);
        existingOrdersByCode.set(code, newOrder);
        affectedOrders.push(newOrder);
      } else if (item.action === 'ATUALIZAR' || item.action === 'SEM_ALTERACAO') {
        const current = existingOrdersByCode.get(row.codigo.toUpperCase());
        if (!current) continue;

        let hasChanged = false;

        // Status update: strictly maintain the status from the spreadsheet
        if (row.status && (current.status_origem !== row.status || current.status_operacional !== row.status)) {
          const audit = this.addAuditLog({
            pedido_id: current.id,
            codigo_pedido: current.codigo,
            usuario: `Importação (${userNome})`,
            data_hora: now,
            campo_alterado: 'Status via Planilha',
            valor_anterior: `${current.status_operacional} (${current.status_origem})`,
            novo_valor: row.status,
          });
          newAuditLogs.push(audit);

          current.status_origem = (row.status as OrderStatus);
          current.status_operacional = (row.status as OrderStatus);
          hasChanged = true;
        }

        // Quantidade de itens
        if (row.itens && current.quantidade_itens !== row.itens) {
          current.quantidade_itens = row.itens;
          hasChanged = true;
        }

        // Unidade / Hospital
        if (row.unidade && current.unidade !== row.unidade) {
          current.unidade = row.unidade;
          hasChanged = true;
        }

        // Tipo de pedido
        if (row.tipo && current.tipo !== row.tipo) {
          current.tipo = row.tipo;
          hasChanged = true;
        }

        // Solicitante
        if (row.solicitante && current.solicitante !== row.solicitante) {
          current.solicitante = row.solicitante;
          hasChanged = true;
        }

        // CPF
        if (row.cpf && row.cpf !== '—' && current.cpf !== row.cpf) {
          current.cpf = row.cpf;
          hasChanged = true;
        }

        // Programa
        if (row.programa && current.programa !== row.programa) {
          current.programa = row.programa;
          hasChanged = true;
        }

        // Datas operacionais da planilha
        if (row.data_solicitacao && current.data_solicitacao !== row.data_solicitacao) {
          current.data_solicitacao = row.data_solicitacao;
          current.data_inicio = row.data_solicitacao;
          hasChanged = true;
        }

        if (row.data_aprovacao && current.data_aprovacao !== row.data_aprovacao) {
          current.data_aprovacao = row.data_aprovacao;
          hasChanged = true;
        }

        if (row.data_inicio_separacao && current.data_inicio_separacao !== row.data_inicio_separacao) {
          current.data_inicio_separacao = row.data_inicio_separacao;
          hasChanged = true;
        }

        if (row.data_expedicao && current.data_expedicao !== row.data_expedicao) {
          current.data_expedicao = row.data_expedicao;
          hasChanged = true;
        }

        if (row.data_prevista_entrega && current.data_prevista_entrega !== row.data_prevista_entrega) {
          current.data_prevista_entrega = row.data_prevista_entrega;
          hasChanged = true;
        }

        // Operadores e timestamps
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

        // Histórico de eventos
        if (row.historico && row.historico !== current.historico_original) {
          current.historico_original = row.historico;
          const newParsedEvents = parseHistoryToEvents(current.id, row.historico, row.solicitante);
          current.eventos = newParsedEvents;
          hasChanged = true;
        }

        current.importacao_id = importId;
        current.atualizado_em = now;

        if (hasChanged) {
          updateCount++;
          affectedOrders.push(current);
          modifiedOrders.push(current);
        } else {
          unchangedCount++;
          // Still track for local state
          affectedOrders.push(current);
        }
      }
    }

    // Prepend all new orders in a single fast operation, or clone array so React triggers re-render
    if (newOrdersToPrepend.length > 0) {
      this.orders = [...newOrdersToPrepend, ...this.orders];
    } else {
      this.orders = [...this.orders];
    }

    const isNonConcluded = (newCount === 0 && updateCount === 0 && unchangedCount === 0) || (errorCount >= analysis.totalFound);
    const isPartial = errorCount > 0 && !isNonConcluded;
    const importStatus: ImportStatus = isNonConcluded ? 'NAO_CONCLUIDA' : (isPartial ? 'PARCIAL' : 'CONCLUIDA');
    
    const motivoStatus = isNonConcluded
      ? `Importação não concluída: Todos os ${errorCount} registros continham erros de formatação ou não seguiam o padrão SOL-2026.`
      : (isPartial 
          ? `Concluída parcialmente: ${newCount} novos, ${updateCount} atualizados e ${errorCount} pedidos com erro.`
          : `Concluída com sucesso (${analysis.totalFound} pedidos sincronizados).`);

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
      status: importStatus,
      motivo_status: motivoStatus,
      tempo_processamento_ms: analysis.tempoProcessamentoMs,
    };

    this.importRecords.unshift(record);
    this.save(STORAGE_KEYS.ORDERS, this.orders);
    idbSet(STORAGE_KEYS.ORDERS, this.orders).catch(err => console.warn('IndexedDB orders save note:', err));
    this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
    this.notify();
    
    // Select records to persist to remote database:
    // If only specific rows are new or changed, persist only them for maximum speed.
    // If all rows are new (e.g. initial upload of 3,500 rows) or full sync needed, persist all.
    const ordersToPersistInDatabase = (newOrdersToPrepend.length > 0 || modifiedOrders.length > 0)
      ? [...newOrdersToPrepend, ...modifiedOrders]
      : (this.orders.length <= analysis.totalFound ? affectedOrders : []);

    // DIRECTLY FEED THE DATABASE (Firestore & Supabase) with real-time progress and cancellation
    let isDbSuccess = false;
    let isDbPartial = false;
    let actualSavedCount = 0;
    let dbErrorMsg: string | undefined = undefined;

    try {
      const dbResult = await dbSync.saveImportedData(
        ordersToPersistInDatabase, 
        record, 
        newAuditLogs, 
        onDbProgress, 
        signal
      );
      isDbSuccess = dbResult.success;
      isDbPartial = Boolean(dbResult.partial);
      actualSavedCount = dbResult.count;
      if (!dbResult.success) {
        dbErrorMsg = dbResult.error || 'Falha ao persistir registros no banco de dados.';
      }
    } catch (e: any) {
      console.warn('Erro ao alimentar banco de dados na importação:', e);
      dbErrorMsg = e?.message || 'Falha de comunicação durante gravação no banco de dados.';
    }

    if (!isDbSuccess) {
      record.status = 'NAO_CONCLUIDA';
      record.motivo_status = `Gravação no banco de dados NÃO foi concluída: ${dbErrorMsg}. Foram gravados ${actualSavedCount} de ${ordersToPersistInDatabase.length} pedidos.`;
      this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
      this.notify();
      throw new Error(record.motivo_status);
    } else if (isDbPartial || record.status === 'PARCIAL') {
      record.status = 'PARCIAL';
      record.motivo_status = `Concluída parcialmente: ${actualSavedCount} pedidos gravados no banco de dados. ${record.erros > 0 ? `${record.erros} com erro na planilha.` : ''}`;
      this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
      this.notify();
    } else {
      record.status = 'CONCLUIDA';
      this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
      this.notify();
    }

    this.notify();
    return record;
  }

  // Record an import that failed, was cancelled, or could not be concluded
  public recordFailedImport(params: {
    fileName: string;
    totalFound?: number;
    motivo: string;
    status?: ImportStatus;
    usuario?: string;
    duracaoMs?: number;
  }): ImportRecord {
    const now = new Date().toISOString();
    const importId = `imp-${Date.now()}`;
    const record: ImportRecord = {
      id: importId,
      arquivo: params.fileName,
      data_importacao: now,
      usuario: params.usuario || this.currentUser.nome,
      quantidade_registros: params.totalFound || 0,
      novos: 0,
      atualizados: 0,
      sem_alteracao: 0,
      erros: params.totalFound || 0,
      status: params.status || 'NAO_CONCLUIDA',
      motivo_status: params.motivo,
      tempo_processamento_ms: params.duracaoMs,
    };

    this.importRecords.unshift(record);
    this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
    this.notify();
    dbSync.saveImportRecord(record).catch(e => console.warn('Erro ao salvar registro de importação não concluída no banco:', e));
    return record;
  }

  // Audit logging helper
  private addAuditLog(entry: Omit<AuditLog, 'id'>): AuditLog {
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
    return log;
  }

  // Schedule CRUD
  public addSchedule(scheduleData: Omit<Schedule, 'id'>): Schedule {
    const id = `sch-${Date.now()}`;
    const newSch: Schedule = { ...scheduleData, id };
    this.schedules.push(newSch);

    if (this.settings.auto_vincular_cronograma) {
      let linked = false;
      this.orders.forEach(order => {
        if (!order.cronograma_id && order.cronograma_vinculo !== 'NENHUM') {
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
        if (!order.cronograma_id && order.cronograma_vinculo !== 'NENHUM') {
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
      // Do not re-link orders explicitly marked as NENHUM (manually unlinked)
      if (!order.cronograma_id && order.cronograma_vinculo !== 'NENHUM') {
        const match = this.findMatchingSchedule(order.unidade, order.programa, order.tipo);
        if (match) {
          order.cronograma_id = match.id;
          order.cronograma_vinculo = 'AUTOMÁTICO';
          if (!order.data_prevista_entrega && match.data_entrega) {
            order.data_prevista_entrega = match.data_entrega;
          }
          linkedCount++;
        }
      }
    });

    if (linkedCount > 0) {
      this.save(STORAGE_KEYS.ORDERS, this.orders);
    }
    return { linkedCount };
  }

  /**
   * Desvincula todos os pedidos de um determinado dia do calendário e cronograma.
   * Remove datas previstas de entrega/etapas e remove o vínculo com cronograma de todos os pedidos agendados para aquele dia.
   *
   * @param dayOrDate Número do dia (ex: 24) ou string de data (ex: "2026-09-24", "24/09/2026")
   * @param monthNumber Número do mês (padrão 9 para Setembro)
   * @param options Configurações adicionais de desvinculação
   */
  public async unlinkOrdersOfDay(
    dayOrDate: number | string,
    monthNumber?: number,
    options?: {
      clearSchedule?: boolean;
      clearDeliveryDate?: boolean;
      clearStageDates?: boolean;
      responsavel?: string | UserProfile;
      motivo?: string;
    }
  ): Promise<{
    success: boolean;
    unlinkedCount: number;
    affectedOrders: Order[];
    dateFormatted: string;
  }> {
    let day = 0;
    let month = monthNumber || (new Date().getMonth() + 1);

    if (typeof dayOrDate === 'string') {
      const clean = dayOrDate.trim();
      if (clean.includes('-')) {
        const parts = clean.split('T')[0].split(' ')[0].split('-');
        if (parts[0].length === 4) {
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        } else {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
        }
      } else if (clean.includes('/')) {
        const parts = clean.split(' ')[0].split('/');
        if (parts[2] && parts[2].length === 4) {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
        } else {
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        }
      } else {
        day = parseInt(clean, 10);
      }
    } else {
      day = dayOrDate;
    }

    if (!day || isNaN(day) || !month || isNaN(month)) {
      return { success: false, unlinkedCount: 0, affectedOrders: [], dateFormatted: '' };
    }

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateFormatted = `${dayStr}/${monthStr}/2026`;

    const matchesDay = (dateVal?: string | null): boolean => {
      if (!dateVal) return false;
      const clean = dateVal.trim();
      if (clean.includes('-')) {
        const parts = clean.split('T')[0].split(' ')[0].split('-');
        if (parts.length >= 3) {
          if (parts[0].length === 4) {
            return parseInt(parts[1], 10) === month && parseInt(parts[2], 10) === day;
          } else {
            return parseInt(parts[1], 10) === month && parseInt(parts[0], 10) === day;
          }
        }
      } else if (clean.includes('/')) {
        const parts = clean.split(' ')[0].split('/');
        if (parts.length >= 3) {
          if (parts[2].length === 4) {
            return parseInt(parts[1], 10) === month && parseInt(parts[0], 10) === day;
          } else {
            return parseInt(parts[1], 10) === month && parseInt(parts[2], 10) === day;
          }
        }
      }
      return false;
    };

    const schedulesMap = new Map<string, Schedule>();
    this.schedules.forEach(s => schedulesMap.set(s.id, s));

    const clearSchedule = options?.clearSchedule !== false;
    const clearDeliveryDate = options?.clearDeliveryDate !== false;
    const clearStageDates = options?.clearStageDates !== false;
    const userNome = typeof options?.responsavel === 'object' && options?.responsavel !== null
      ? options.responsavel.nome
      : (options?.responsavel || this.currentUser.nome);

    const nowIso = new Date().toISOString();
    const nowBr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const motivo = options?.motivo || `Desvinculação de todos os pedidos agendados para o dia ${dateFormatted}`;

    const affectedOrders: Order[] = [];

    this.orders.forEach(order => {
      const sch = order.cronograma_id ? schedulesMap.get(order.cronograma_id) : null;

      const matchDelivery = matchesDay(order.data_prevista_entrega) || (sch ? matchesDay(sch.data_entrega) : false);
      const matchSeparation = matchesDay(order.data_inicio_separacao) || (sch ? matchesDay(sch.data_separacao) : false);
      const matchExpedition = matchesDay(order.data_expedicao) || (sch ? matchesDay(sch.data_expedicao) : false);
      const matchApproval = matchesDay(order.data_aprovacao) || (sch ? matchesDay(sch.data_limite_aprovacao) : false);
      const matchSolicitation = matchesDay(order.data_solicitacao) || (sch ? matchesDay(sch.data_limite_solicitacao) : false);
      const matchInicio = matchesDay(order.data_inicio);

      const belongsToDay = matchDelivery || matchSeparation || matchExpedition || matchApproval || matchSolicitation || matchInicio;

      if (belongsToDay) {
        if (clearDeliveryDate || matchDelivery) {
          order.data_prevista_entrega = undefined;
        }

        if (clearSchedule) {
          order.cronograma_id = null;
          order.cronograma_vinculo = 'NENHUM';
          order.data_prevista_entrega = undefined;
          order.data_inicio_separacao = undefined;
          order.data_expedicao = undefined;
          order.data_inicio = undefined;
          order.data_aprovacao = undefined;
          order.data_solicitacao = undefined;
          order.validada_em = undefined;
          order.separado_em = undefined;
          order.expedido_em = undefined;
        }

        if (clearStageDates) {
          if (matchesDay(order.data_inicio_separacao)) {
            order.data_inicio_separacao = undefined;
          }
          if (matchesDay(order.data_expedicao)) {
            order.data_expedicao = undefined;
          }
          if (matchesDay(order.data_inicio)) {
            order.data_inicio = undefined;
          }
          if (matchesDay(order.data_aprovacao)) {
            order.data_aprovacao = undefined;
          }
          if (matchesDay(order.data_solicitacao)) {
            order.data_solicitacao = undefined;
          }
        }

        // Always clean any exact day stage matches to avoid sticking to this day
        if (matchesDay(order.data_inicio_separacao)) order.data_inicio_separacao = undefined;
        if (matchesDay(order.data_expedicao)) order.data_expedicao = undefined;
        if (matchesDay(order.data_inicio)) order.data_inicio = undefined;
        if (matchesDay(order.data_aprovacao)) order.data_aprovacao = undefined;
        if (matchesDay(order.data_solicitacao)) order.data_solicitacao = undefined;

        order.atualizado_em = nowIso;

        // Register event
        const unlinkedEvent: OrderEvent = {
          id: `evt-${order.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          pedido_id: order.id,
          tipo_evento: 'Desvinculação do Dia',
          status: order.status_operacional,
          data_evento: nowBr,
          responsavel: userNome,
          origem: 'SISTEMA',
          observacao: motivo,
        };
        order.eventos = [...(order.eventos || []), unlinkedEvent];

        // Register audit log
        this.addAuditLog({
          pedido_id: order.id,
          codigo_pedido: order.codigo,
          usuario: userNome,
          data_hora: nowIso,
          campo_alterado: 'Desvinculação do Dia',
          valor_anterior: `Agendado no dia ${dateFormatted}`,
          novo_valor: 'Desvinculado do dia e cronograma',
        });

        affectedOrders.push(order);
      }
    });

    if (affectedOrders.length > 0) {
      this.save(STORAGE_KEYS.ORDERS, this.orders);
      this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
      // Persist to Supabase in batch
      dbSync.saveOrders(affectedOrders);
      this.notify();
    }

    return {
      success: true,
      unlinkedCount: affectedOrders.length,
      affectedOrders,
      dateFormatted,
    };
  }

  /**
   * Desvincula um pedido individual de agendamento e cronograma
   */
  public async unlinkOrder(
    orderId: string,
    responsavel?: string | UserProfile,
    motivo?: string
  ): Promise<boolean> {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return false;

    const order = this.orders[idx];
    const userNome = typeof responsavel === 'object' && responsavel !== null
      ? responsavel.nome
      : (responsavel || this.currentUser.nome);

    const nowIso = new Date().toISOString();
    const nowBr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    order.cronograma_id = null;
    order.cronograma_vinculo = 'NENHUM';
    order.data_prevista_entrega = undefined;
    order.data_inicio_separacao = undefined;
    order.data_expedicao = undefined;
    order.data_inicio = undefined;
    order.data_aprovacao = undefined;
    order.data_solicitacao = undefined;
    order.validada_em = undefined;
    order.separado_em = undefined;
    order.expedido_em = undefined;
    order.atualizado_em = nowIso;

    const unlinkedEvent: OrderEvent = {
      id: `evt-${order.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pedido_id: order.id,
      tipo_evento: 'Desvinculação Manual',
      status: order.status_operacional,
      data_evento: nowBr,
      responsavel: userNome,
      origem: 'SISTEMA',
      observacao: motivo || 'Pedido desvinculado manualmente do cronograma e calendário',
    };
    order.eventos = [...(order.eventos || []), unlinkedEvent];

    this.addAuditLog({
      pedido_id: order.id,
      codigo_pedido: order.codigo,
      usuario: userNome,
      data_hora: nowIso,
      campo_alterado: 'Desvinculação',
      valor_anterior: 'Agendado',
      novo_valor: 'Desvinculado',
    });

    this.save(STORAGE_KEYS.ORDERS, this.orders);
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
    dbSync.saveOrder(order);
    this.notify();
    return true;
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

  public updateUnit(id: string, partial: Partial<HospitalUnit>, updateAssociatedOrders: boolean = false) {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      const oldUnit = this.units[idx];
      this.units[idx] = { ...this.units[idx], ...partial };
      this.save(STORAGE_KEYS.UNITS, this.units);
      dbSync.saveUnit(this.units[idx]);

      // If requested or if sigla changed, update associated orders
      if (updateAssociatedOrders && partial.sigla && partial.sigla.toUpperCase() !== oldUnit.sigla.toUpperCase()) {
        const oldSiglaUpper = oldUnit.sigla.toUpperCase();
        const newSiglaUpper = partial.sigla.toUpperCase();
        let affected = 0;
        this.orders.forEach(o => {
          if (o.unidade && o.unidade.toUpperCase() === oldSiglaUpper) {
            o.unidade = newSiglaUpper;
            dbSync.saveOrder(o);
            affected++;
          }
        });
        if (affected > 0) {
          this.save(STORAGE_KEYS.ORDERS, this.orders);
        }
      }

      this.notify();
      return this.units[idx];
    }
    return null;
  }

  public deleteUnit(id: string): boolean {
    const unit = this.units.find(u => u.id === id);
    if (!unit) return false;

    this.units = this.units.filter(u => u.id !== id);
    this.save(STORAGE_KEYS.UNITS, this.units);
    dbSync.deleteUnit(id);
    this.notify();
    return true;
  }

  // Strictly reload directly from the database backend
  public async resetToDefault() {
    return await this.loadBackendData();
  }

  public async reloadStrictFromBackend() {
    return await this.loadBackendData();
  }

  public static readonly DATABASE_SECURITY_PASSWORD = 'Sai453@12';

  /**
   * Limpa o banco de dados mediante autenticação com a trava de segurança (senha: Sai453@12)
   * Modos suportados:
   * - 'wipe_orders': Zera todos os pedidos e histórico de importações (mantém unidades e cronogramas)
   * - 'reseed_clean': Limpa e restaura a base oficial padrão da SESAU
   * - 'wipe_all': Limpeza total do sistema (pedidos, histórico, logs e cronogramas customizados)
   */
  public async clearDatabaseWithPassword(
    password: string,
    mode: 'wipe_orders' | 'reseed_clean' | 'wipe_all' = 'wipe_orders',
    responsavel?: string
  ): Promise<{ success: boolean; message: string; count?: number }> {
    if (password !== AppStore.DATABASE_SECURITY_PASSWORD) {
      throw new Error('Senha de segurança incorreta! Acesso negado. A operação de limpeza foi cancelada.');
    }

    const previousCount = this.orders.length;
    const userNome = responsavel || this.currentUser.nome;
    const nowIso = new Date().toISOString();

    if (mode === 'reseed_clean') {
      const cleanOrders = generateSeedOrders();
      cleanOrders.forEach(o => {
        o.unidade = cleanUnitName(o.unidade);
      });
      this.orders = cleanOrders;
      this.units = [...CANONICAL_UNITS];
      this.schedules = [...INITIAL_SCHEDULES];
      this.importRecords = [];
    } else if (mode === 'wipe_all') {
      this.orders = [];
      this.importRecords = [];
      this.auditLogs = [];
      this.units = [...CANONICAL_UNITS];
      this.schedules = [...INITIAL_SCHEDULES];
    } else {
      // 'wipe_orders': zera todos os pedidos e histórico de importações
      this.orders = [];
      this.importRecords = [];
      this.units = [...CANONICAL_UNITS];
    }

    // Persist changes to local storage
    this.save(STORAGE_KEYS.ORDERS, this.orders);
    this.save(STORAGE_KEYS.IMPORTS, this.importRecords);
    this.save(STORAGE_KEYS.UNITS, this.units);
    this.save(STORAGE_KEYS.SCHEDULES, this.schedules);
    if (mode === 'wipe_all') {
      this.save(STORAGE_KEYS.AUDIT, this.auditLogs);
    }

    // Register security audit log
    this.addAuditLog({
      pedido_id: 'SEGURANCA',
      codigo_pedido: 'LIMPEZA-BANCO',
      usuario: userNome,
      data_hora: nowIso,
      campo_alterado: 'Trava de Segurança – Limpeza do Banco',
      valor_anterior: `${previousCount} pedidos armazenados`,
      novo_valor: mode === 'reseed_clean' ? 'Base Oficial SESAU Restaurada' : 'Banco de Dados Zerado (0 pedidos)',
    });
    this.save(STORAGE_KEYS.AUDIT, this.auditLogs);

    // Mirror deletion to backend (Supabase + Firestore)
    await dbSync.clearBackendDatabase(mode);

    // If reseed_clean, push the clean base to Supabase
    if (mode === 'reseed_clean') {
      await dbSync.pushAllToSupabase(this.orders, this.schedules, this.units);
    }

    this.notify();

    return {
      success: true,
      message: mode === 'reseed_clean'
        ? `Banco de dados limpo e restaurado com sucesso para a base padrão oficial SESAU (${this.orders.length} pedidos e ${this.units.length} unidades).`
        : `Banco de dados limpo com sucesso! ${previousCount} pedidos e seus históricos foram excluídos. O banco está zerado e pronto para novas operações.`,
      count: previousCount,
    };
  }

  // Cleans the database, purges legacy dirty units, normalizes all unit references
  public async cleanDatabase(reseedCleanOrders = true): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Reset units to canonical catalog
      this.units = [...CANONICAL_UNITS];
      this.save(STORAGE_KEYS.UNITS, this.units);

      // 2. Normalize existing orders or reseed clean orders
      if (reseedCleanOrders) {
        const cleanOrders = generateSeedOrders();
        cleanOrders.forEach(o => {
          o.unidade = cleanUnitName(o.unidade);
        });
        this.orders = cleanOrders;
      } else {
        this.orders = this.orders.map(o => ({
          ...o,
          unidade: cleanUnitName(o.unidade),
        }));
      }
      this.save(STORAGE_KEYS.ORDERS, this.orders);

      // 3. Clear import history
      this.importRecords = [];
      this.save(STORAGE_KEYS.IMPORTS, this.importRecords);

      // 4. Mirror to Supabase & Firestore
      await dbSync.pushAllToSupabase(this.orders, this.schedules, this.units);

      this.notify();
      return {
        success: true,
        message: `Banco de dados higienizado com sucesso! ${this.units.length} unidades oficiais da rede SESAU restabelecidas e ${this.orders.length} pedidos validados sem resíduos.`,
      };
    } catch (err: any) {
      console.error('cleanDatabase error:', err);
      return {
        success: false,
        message: err.message || 'Falha ao higienizar banco de dados.',
      };
    }
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
