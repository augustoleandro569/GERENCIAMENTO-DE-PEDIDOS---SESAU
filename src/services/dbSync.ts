import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  limit,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getSupabaseClient, getSavedSupabaseConfig } from '../lib/supabase';
import { Order, Schedule, HospitalUnit, AuditLog, OrderEvent, ImportRecord } from '../types';
import { parseHistoryToEvents } from '../utils/historyParser';

export interface DatabaseStatus {
  firestoreConnected: boolean;
  firestoreSyncing: boolean;
  lastFirestoreSync?: Date;
  supabaseConnected: boolean;
  supabaseSyncing: boolean;
  lastSupabaseSync?: Date;
  activeProvider: 'firestore' | 'supabase' | 'both' | 'local';
  totalBackendOrders?: number;
}

type SyncStatusListener = (status: DatabaseStatus) => void;

/**
 * Firestore strictly forbids `undefined` values in documents and throws an exception.
 * This helper converts any `undefined` values to `null` recursively to ensure clean writes.
 */
export function sanitizeForFirestore<T>(data: T): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item));
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      sanitized[key] = null;
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeForFirestore(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class DatabaseSyncService {
  private statusListeners: Set<SyncStatusListener> = new Set();
  private isInitializing = false;
  private realtimeChannel: any = null;
  private onRemoteOrderChange?: (payload: any) => void;
  private onRemoteScheduleChange?: (payload: any) => void;

  private status: DatabaseStatus = {
    firestoreConnected: false,
    firestoreSyncing: false,
    supabaseConnected: false,
    supabaseSyncing: false,
    activeProvider: 'supabase',
  };

  public getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus() {
    this.statusListeners.forEach(l => l(this.getStatus()));
  }

  // Register real-time change callback for store
  public setChangeListeners(
    onOrderChange: (payload: any) => void,
    onScheduleChange: (payload: any) => void
  ) {
    this.onRemoteOrderChange = onOrderChange;
    this.onRemoteScheduleChange = onScheduleChange;
  }

  // Strictly loads all data from Supabase backend
  public async syncStrictFromSupabase(): Promise<{
    success: boolean;
    orders: Order[];
    schedules: Schedule[];
    units: HospitalUnit[];
    message?: string;
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        success: false,
        orders: [],
        schedules: [],
        units: [],
        message: 'Cliente Supabase não configurado ou credenciais inválidas.',
      };
    }

    this.status.supabaseSyncing = true;
    this.notifyStatus();

    try {
      // 1. Fetch Orders with pagination to retrieve all imported records without truncation
      const rawOrders: any[] = [];
      const seenOrderIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error: ordErr } = await supabase
          .from('pedidos')
          .select('*')
          .order('criado_no_sistema_em', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (ordErr) {
          throw new Error(`Erro ao buscar pedidos no Supabase: ${ordErr.message}`);
        }
        if (!page || page.length === 0) break;
        for (const ord of page) {
          if (ord && ord.id && !seenOrderIds.has(ord.id)) {
            seenOrderIds.add(ord.id);
            rawOrders.push(ord);
          }
        }
        if (page.length < pageSize || rawOrders.length >= 10000) break;
        from += pageSize;
      }

      // 2. Fetch Schedules
      const { data: rawSchedules, error: schErr } = await supabase
        .from('cronogramas')
        .select('*')
        .order('nome', { ascending: true });

      if (schErr) {
        console.warn('Cronogramas fetch note:', schErr.message);
      }

      // 3. Fetch Units
      const { data: rawUnits, error: unitErr } = await supabase
        .from('unidades_hospitalares')
        .select('*')
        .order('sigla', { ascending: true });

      if (unitErr) {
        console.warn('Unidades fetch note:', unitErr.message);
      }

      // 4. Fetch Events to enrich orders
      let eventsMap = new Map<string, OrderEvent[]>();
      try {
        const { data: rawEvents } = await supabase
          .from('eventos_pedidos')
          .select('*')
          .order('data_evento', { ascending: true })
          .limit(5000);

        if (rawEvents && rawEvents.length > 0) {
          rawEvents.forEach((ev: any) => {
            const list = eventsMap.get(ev.pedido_id) || [];
            list.push({
              id: ev.id,
              pedido_id: ev.pedido_id,
              tipo_evento: ev.tipo_evento,
              status: ev.status,
              data_evento: ev.data_evento,
              responsavel: ev.responsavel,
              origem: ev.origem || 'SISTEMA',
              observacao: ev.observacao,
            });
            eventsMap.set(ev.pedido_id, list);
          });
        }
      } catch (evErr) {
        console.warn('Eventos fetch note:', evErr);
      }

      // Format Orders
      const formattedOrders: Order[] = (rawOrders || []).map((o: any) => {
        let eventos = eventsMap.get(o.id) || [];
        if (eventos.length === 0 && o.historico_original) {
          eventos = parseHistoryToEvents(o.id, o.historico_original, o.solicitante);
        }

        return {
          id: o.id,
          codigo: o.codigo,
          origem: o.origem || 'IMPORTAÇÃO',
          tipo: o.tipo || 'Mensal',
          solicitante: o.solicitante || 'Não Informado',
          cpf: o.cpf || '',
          programa: o.programa || 'Hospitalar',
          unidade: o.unidade || '',
          quantidade_itens: Number(o.quantidade_itens) || 1,
          criado_em: o.criado_em || '',
          data_inicio: o.data_inicio || '',
          data_solicitacao: o.data_solicitacao || '',
          data_aprovacao: o.data_aprovacao || '',
          data_inicio_separacao: o.data_inicio_separacao || '',
          data_expedicao: o.data_expedicao || '',
          data_prevista_entrega: o.data_prevista_entrega || '',
          status_origem: o.status_origem || o.status_operacional || 'Aguardando Aprovação',
          status_operacional: o.status_operacional || 'Aguardando Aprovação',
          validador: o.validador || undefined,
          validada_em: o.validada_em || undefined,
          separador: o.separador || undefined,
          separado_em: o.separado_em || undefined,
          conferente: o.conferente || undefined,
          conferido_em: o.conferido_em || undefined,
          expedidor: o.expedidor || undefined,
          expedido_em: o.expedido_em || undefined,
          entregador: o.entregador || undefined,
          entregue_em: o.entregue_em || undefined,
          historico_original: o.historico_original || '',
          cronograma_id: o.cronograma_id || undefined,
          cronograma_vinculo: o.cronograma_vinculo || 'NENHUM',
          prioridade: o.prioridade || 'Normal',
          observacoes: o.observacoes || undefined,
          importacao_id: o.importacao_id || undefined,
          criado_no_sistema_em: o.criado_no_sistema_em,
          atualizado_em: o.atualizado_em,
          eventos: eventos,
        };
      });

      // Format Schedules
      const formattedSchedules: Schedule[] = (rawSchedules || []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        competencia: s.competencia,
        unidade: s.unidade,
        programa: s.programa,
        tipo_pedido: s.tipo_pedido,
        data_limite_solicitacao: s.data_limite_solicitacao || '',
        data_limite_aprovacao: s.data_limite_aprovacao || '',
        data_separacao: s.data_separacao || '',
        data_expedicao: s.data_expedicao || '',
        data_entrega: s.data_entrega || '',
        observacao: s.observacao || '',
        ativo: s.ativo !== false,
      }));

      // Format Units
      const formattedUnits: HospitalUnit[] = (rawUnits || []).map((u: any) => ({
        id: u.id,
        sigla: u.sigla,
        nome: u.nome,
        municipio: u.municipio || 'Alagoas',
        tipo: u.tipo || 'Hospital',
        ativa: u.ativa !== false,
      }));

      // Setup Realtime Subscription if not active
      this.setupSupabaseRealtime(supabase);

      this.status.supabaseConnected = true;
      this.status.supabaseSyncing = false;
      this.status.lastSupabaseSync = new Date();
      this.status.totalBackendOrders = formattedOrders.length;
      this.status.activeProvider = 'supabase';
      this.notifyStatus();

      return {
        success: true,
        orders: formattedOrders,
        schedules: formattedSchedules,
        units: formattedUnits,
      };
    } catch (err: any) {
      console.error('Supabase strict sync error:', err);
      this.status.supabaseSyncing = false;
      this.status.supabaseConnected = false;
      this.notifyStatus();
      return {
        success: false,
        orders: [],
        schedules: [],
        units: [],
        message: err.message || String(err),
      };
    }
  }

  // Setup Postgres real-time listeners for instant synchronization
  private setupSupabaseRealtime(supabase: any) {
    if (this.realtimeChannel) return;

    try {
      this.realtimeChannel = supabase
        .channel('public-hospi-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos' },
          (payload: any) => {
            if (this.onRemoteOrderChange) {
              this.onRemoteOrderChange(payload);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cronogramas' },
          (payload: any) => {
            if (this.onRemoteScheduleChange) {
              this.onRemoteScheduleChange(payload);
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this.status.supabaseConnected = true;
            this.notifyStatus();
          }
        });
    } catch (e) {
      console.warn('Realtime channel subscription note:', e);
    }
  }

  // Initialize Firestore listeners as secondary / fallback cloud sync
  public async initFirestore(
    onRemoteOrders: (orders: Order[]) => void,
    onRemoteSchedules: (schedules: Schedule[]) => void,
    onRemoteUnits: (units: HospitalUnit[]) => void,
    onRemoteImports?: (imports: ImportRecord[]) => void
  ) {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      // 1. Attach real-time listener for Orders in Firestore
      onSnapshot(
        collection(db, 'orders'),
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteList: Order[] = [];
            snapshot.forEach((d) => {
              remoteList.push(d.data() as Order);
            });
            onRemoteOrders(remoteList);
          }
          this.status.firestoreConnected = true;
          this.status.lastFirestoreSync = new Date();
          this.notifyStatus();
        },
        (error) => {
          // Gracefully log without breaking the app
          handleFirestoreError(error, OperationType.LIST, 'orders');
        }
      );

      // 2. Attach real-time listener for Schedules
      onSnapshot(
        collection(db, 'schedules'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Schedule[] = [];
            snapshot.forEach((d) => list.push(d.data() as Schedule));
            onRemoteSchedules(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'schedules');
        }
      );

      // 3. Attach real-time listener for Hospital Units
      onSnapshot(
        collection(db, 'hospital_units'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: HospitalUnit[] = [];
            snapshot.forEach((d) => list.push(d.data() as HospitalUnit));
            onRemoteUnits(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'hospital_units');
        }
      );

      // 4. Attach real-time listener for Import Records if handler provided
      if (onRemoteImports) {
        onSnapshot(
          collection(db, 'import_records'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: ImportRecord[] = [];
              snapshot.forEach((d) => list.push(d.data() as ImportRecord));
              // Sort newest first
              list.sort((a, b) => new Date(b.data_importacao).getTime() - new Date(a.data_importacao).getTime());
              onRemoteImports(list);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, 'import_records');
          }
        );
      }

      this.status.firestoreConnected = true;
      this.status.lastFirestoreSync = new Date();
      this.notifyStatus();
    } catch (err) {
      console.warn('Firestore initialization note:', err);
    }
  }

  // Check Supabase connection
  public async checkSupabaseConnection(): Promise<boolean> {
    const supabase = getSupabaseClient();
    const config = getSavedSupabaseConfig();
    if (!supabase || !config.url) {
      this.status.supabaseConnected = false;
      this.notifyStatus();
      return false;
    }

    try {
      const { error } = await supabase.from('pedidos').select('id').limit(1);
      if (!error || error.code === 'PGRST116') {
        this.status.supabaseConnected = true;
        this.notifyStatus();
        return true;
      }
      this.status.supabaseConnected = false;
      this.notifyStatus();
      return false;
    } catch {
      this.status.supabaseConnected = false;
      this.notifyStatus();
      return false;
    }
  }

  // Save single Order directly to Supabase & Firestore
  public async saveOrder(order: Order): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('pedidos').upsert({
          id: order.id,
          codigo: order.codigo,
          origem: order.origem,
          tipo: order.tipo,
          solicitante: order.solicitante,
          cpf: order.cpf,
          programa: order.programa,
          unidade: order.unidade,
          quantidade_itens: order.quantidade_itens,
          criado_em: order.criado_em,
          status_origem: order.status_origem,
          status_operacional: order.status_operacional,
          validador: order.validador,
          validada_em: order.validada_em,
          separador: order.separador,
          separado_em: order.separado_em,
          conferente: order.conferente,
          conferido_em: order.conferido_em,
          expedidor: order.expedidor,
          expedido_em: order.expedido_em,
          entregador: order.entregador,
          entregue_em: order.entregue_em,
          historico_original: order.historico_original,
          cronograma_id: order.cronograma_id ?? null,
          cronograma_vinculo: order.cronograma_vinculo || 'NENHUM',
          data_inicio: order.data_inicio ?? null,
          data_solicitacao: order.data_solicitacao ?? null,
          data_aprovacao: order.data_aprovacao ?? null,
          data_inicio_separacao: order.data_inicio_separacao ?? null,
          data_expedicao: order.data_expedicao ?? null,
          data_prevista_entrega: order.data_prevista_entrega ?? null,
          prioridade: order.prioridade,
          observacoes: order.observacoes,
          importacao_id: order.importacao_id,
          atualizado_em: new Date().toISOString(),
        });

        // Also sync order events to eventos_pedidos
        if (order.eventos && order.eventos.length > 0) {
          await supabase.from('eventos_pedidos').upsert(
            order.eventos.map(e => ({
              id: e.id,
              pedido_id: e.pedido_id || order.id,
              tipo_evento: e.tipo_evento,
              status: e.status,
              data_evento: e.data_evento,
              responsavel: e.responsavel,
              origem: e.origem || 'SISTEMA',
              observacao: e.observacao,
            }))
          );
        }
      } catch (err) {
        console.warn('Supabase order upsert note:', err);
      }
    }

    // Also mirror to Firestore if active
    const path = `orders/${order.id}`;
    try {
      await setDoc(doc(db, 'orders', order.id), sanitizeForFirestore(order), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Bulk save multiple Orders efficiently (used in batch updates like unlinking a day)
  public async saveOrders(orders: Order[]): Promise<void> {
    if (!orders || orders.length === 0) return;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const payload = orders.map(order => ({
          id: order.id,
          codigo: order.codigo,
          origem: order.origem,
          tipo: order.tipo,
          solicitante: order.solicitante,
          cpf: order.cpf,
          programa: order.programa,
          unidade: order.unidade,
          quantidade_itens: order.quantidade_itens,
          criado_em: order.criado_em,
          status_origem: order.status_origem,
          status_operacional: order.status_operacional,
          validador: order.validador,
          validada_em: order.validada_em,
          separador: order.separador,
          separado_em: order.separado_em,
          conferente: order.conferente,
          conferido_em: order.conferido_em,
          expedidor: order.expedidor,
          expedido_em: order.expedido_em,
          entregador: order.entregador,
          entregue_em: order.entregue_em,
          historico_original: order.historico_original,
          cronograma_id: order.cronograma_id ?? null,
          cronograma_vinculo: order.cronograma_vinculo || 'NENHUM',
          data_inicio: order.data_inicio ?? null,
          data_solicitacao: order.data_solicitacao ?? null,
          data_aprovacao: order.data_aprovacao ?? null,
          data_inicio_separacao: order.data_inicio_separacao ?? null,
          data_expedicao: order.data_expedicao ?? null,
          data_prevista_entrega: order.data_prevista_entrega ?? null,
          prioridade: order.prioridade,
          observacoes: order.observacoes,
          importacao_id: order.importacao_id,
          atualizado_em: new Date().toISOString(),
        }));

        for (let i = 0; i < payload.length; i += 100) {
          const chunk = payload.slice(i, i + 100);
          await supabase.from('pedidos').upsert(chunk);
        }

        const eventsToUpsert = orders.flatMap(o => (o.eventos || []).map(e => ({
          id: e.id,
          pedido_id: e.pedido_id || o.id,
          tipo_evento: e.tipo_evento,
          status: e.status,
          data_evento: e.data_evento,
          responsavel: e.responsavel,
          origem: e.origem || 'SISTEMA',
          observacao: e.observacao,
        })));

        if (eventsToUpsert.length > 0) {
          for (let i = 0; i < eventsToUpsert.length; i += 100) {
            const chunk = eventsToUpsert.slice(i, i + 100);
            await supabase.from('eventos_pedidos').upsert(chunk);
          }
        }
      } catch (err) {
        console.warn('Supabase bulk saveOrders note:', err);
      }
    }

    // Also mirror to Firestore using batched writes for reliability
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const chunk = orders.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const o of chunk) {
          batch.set(doc(db, 'orders', o.id), sanitizeForFirestore(o), { merge: true });
        }
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore bulk saveOrders note:', fsErr);
    }
  }

  // Save single Import Record to Firestore and Supabase
  public async saveImportRecord(record: ImportRecord): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('importacoes').upsert({
          id: record.id,
          arquivo: record.arquivo,
          data_importacao: record.data_importacao,
          usuario: record.usuario,
          quantidade_registros: record.quantidade_registros,
          novos: record.novos,
          atualizados: record.atualizados,
          sem_alteracao: record.sem_alteracao,
          erros: record.erros,
        });
      } catch (err) {
        console.warn('Supabase import record upsert note:', err);
      }
    }

    try {
      await setDoc(doc(db, 'import_records', record.id), sanitizeForFirestore(record), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `import_records/${record.id}`);
    }
  }

  /**
   * Directly feeds the database with all affected orders, the import record, and any audit logs
   * generated from a spreadsheet import.
   * Uses batched writes to Firestore (atomic chunks of up to 400 operations)
   * and bulk upsert to Supabase if active.
   */
  public async saveImportedData(
    ordersToSave: Order[],
    importRecord: ImportRecord,
    auditLogsToSave: AuditLog[] = []
  ): Promise<{ success: boolean; count: number; message: string }> {
    let savedOrdersCount = 0;
    this.status.firestoreSyncing = true;
    this.notifyStatus();

    // 1. Persist directly to Firestore using writeBatch
    try {
      // Save Import Record
      if (importRecord && importRecord.id) {
        const recordDocRef = doc(db, 'import_records', String(importRecord.id));
        await setDoc(recordDocRef, sanitizeForFirestore(importRecord), { merge: true });
      }

      // Save orders in batches of 400 (Firestore maximum is 500 per batch)
      if (ordersToSave && ordersToSave.length > 0) {
        const BATCH_SIZE = 400;
        for (let i = 0; i < ordersToSave.length; i += BATCH_SIZE) {
          const chunk = ordersToSave.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);

          for (const order of chunk) {
            if (!order || !order.id) continue;
            const orderDocRef = doc(db, 'orders', String(order.id));
            batch.set(orderDocRef, sanitizeForFirestore(order), { merge: true });
          }

          await batch.commit();
          savedOrdersCount += chunk.length;
        }
      }

      // Save audit logs in batch if any
      if (auditLogsToSave && auditLogsToSave.length > 0) {
        const BATCH_SIZE = 400;
        for (let i = 0; i < auditLogsToSave.length; i += BATCH_SIZE) {
          const chunk = auditLogsToSave.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          for (const log of chunk) {
            if (!log || !log.id) continue;
            const logDocRef = doc(db, 'audit_logs', String(log.id));
            batch.set(logDocRef, sanitizeForFirestore(log), { merge: true });
          }
          await batch.commit();
        }
      }

      this.status.firestoreConnected = true;
      this.status.lastFirestoreSync = new Date();
    } catch (fsErr) {
      console.error('Firestore saveImportedData error:', fsErr);
      handleFirestoreError(fsErr, OperationType.WRITE, 'orders/bulk_import');
    }

    // 2. Also upsert into Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase && ordersToSave && ordersToSave.length > 0) {
      try {
        const payload = ordersToSave.map(order => ({
          id: order.id,
          codigo: order.codigo,
          origem: order.origem || 'IMPORTAÇÃO',
          tipo: order.tipo,
          solicitante: order.solicitante,
          cpf: order.cpf,
          programa: order.programa,
          unidade: order.unidade,
          quantidade_itens: order.quantidade_itens,
          criado_em: order.criado_em,
          status_origem: order.status_origem,
          status_operacional: order.status_operacional,
          validador: order.validador,
          validada_em: order.validada_em,
          separador: order.separador,
          separado_em: order.separado_em,
          conferente: order.conferente,
          conferido_em: order.conferido_em,
          expedidor: order.expedidor,
          expedido_em: order.expedido_em,
          entregador: order.entregador,
          entregue_em: order.entregue_em,
          historico_original: order.historico_original,
          cronograma_id: order.cronograma_id ?? null,
          cronograma_vinculo: order.cronograma_vinculo || 'NENHUM',
          data_inicio: order.data_inicio ?? null,
          data_solicitacao: order.data_solicitacao ?? null,
          data_aprovacao: order.data_aprovacao ?? null,
          data_inicio_separacao: order.data_inicio_separacao ?? null,
          data_expedicao: order.data_expedicao ?? null,
          data_prevista_entrega: order.data_prevista_entrega ?? null,
          prioridade: order.prioridade,
          observacoes: order.observacoes,
          importacao_id: order.importacao_id || importRecord?.id,
          atualizado_em: order.atualizado_em || new Date().toISOString(),
        }));

        for (let i = 0; i < payload.length; i += 100) {
          const chunk = payload.slice(i, i + 100);
          await supabase.from('pedidos').upsert(chunk);
        }

        // Also sync events
        const eventsToSync: any[] = [];
        ordersToSave.forEach(ord => {
          if (ord.eventos && ord.eventos.length > 0) {
            ord.eventos.forEach(ev => {
              eventsToSync.push({
                id: ev.id,
                pedido_id: ev.pedido_id || ord.id,
                tipo_evento: ev.tipo_evento,
                status: ev.status,
                data_evento: ev.data_evento,
                responsavel: ev.responsavel,
                origem: ev.origem || 'IMPORTAÇÃO',
                observacao: ev.observacao || null,
              });
            });
          }
        });

        if (eventsToSync.length > 0) {
          for (let i = 0; i < eventsToSync.length; i += 200) {
            const evChunk = eventsToSync.slice(i, i + 200);
            await supabase.from('eventos_pedidos').upsert(evChunk);
          }
        }

        if (importRecord) {
          await supabase.from('importacoes').upsert({
            id: importRecord.id,
            arquivo: importRecord.arquivo,
            data_importacao: importRecord.data_importacao,
            usuario: importRecord.usuario,
            quantidade_registros: importRecord.quantidade_registros,
            novos: importRecord.novos,
            atualizados: importRecord.atualizados,
            sem_alteracao: importRecord.sem_alteracao,
            erros: importRecord.erros,
          });
        }
      } catch (sbErr) {
        console.warn('Supabase saveImportedData upsert note:', sbErr);
      }
    }

    this.status.firestoreSyncing = false;
    this.notifyStatus();

    return {
      success: true,
      count: savedOrdersCount,
      message: `${savedOrdersCount} pedidos gravados no banco de dados com sucesso.`,
    };
  }

  // Save single Schedule
  public async saveSchedule(schedule: Schedule): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cronogramas').upsert({
          id: schedule.id,
          nome: schedule.nome,
          competencia: schedule.competencia,
          unidade: schedule.unidade,
          programa: schedule.programa,
          tipo_pedido: schedule.tipo_pedido,
          data_limite_solicitacao: schedule.data_limite_solicitacao,
          data_limite_aprovacao: schedule.data_limite_aprovacao,
          data_separacao: schedule.data_separacao,
          data_expedicao: schedule.data_expedicao,
          data_entrega: schedule.data_entrega,
          observacao: schedule.observacao,
          ativo: schedule.ativo,
        });
      } catch (err) {
        console.warn('Supabase schedule upsert note:', err);
      }
    }

    try {
      await setDoc(doc(db, 'schedules', schedule.id), sanitizeForFirestore(schedule), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${schedule.id}`);
    }
  }

  // Delete Schedule
  public async deleteSchedule(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cronogramas').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete schedule note:', err);
      }
    }

    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schedules/${id}`);
    }
  }

  // Save single Unit
  public async saveUnit(unit: HospitalUnit): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('unidades_hospitalares').upsert({
          id: unit.id,
          sigla: unit.sigla,
          nome: unit.nome,
          municipio: unit.municipio,
          tipo: unit.tipo,
          ativa: unit.ativa,
        });
      } catch (err) {
        console.warn('Supabase unit upsert note:', err);
      }
    }

    try {
      await setDoc(doc(db, 'hospital_units', unit.id), sanitizeForFirestore(unit), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `hospital_units/${unit.id}`);
    }
  }

  // Save Audit Log
  public async saveAuditLog(log: AuditLog): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('logs_auditoria').upsert({
          id: log.id,
          pedido_id: log.pedido_id,
          codigo_pedido: log.codigo_pedido,
          usuario: log.usuario,
          data_hora: log.data_hora,
          campo_alterado: log.campo_alterado,
          valor_anterior: log.valor_anterior,
          novo_valor: log.novo_valor,
        });
      } catch (err) {
        console.warn('Supabase audit log upsert note:', err);
      }
    }

    try {
      await setDoc(doc(db, 'audit_logs', log.id), sanitizeForFirestore(log), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `audit_logs/${log.id}`);
    }
  }

  // Full export/push to Supabase
  public async pushAllToSupabase(
    orders: Order[],
    schedules: Schedule[],
    units: HospitalUnit[]
  ): Promise<{ success: boolean; message: string; count: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Supabase não está configurado.', count: 0 };
    }

    this.status.supabaseSyncing = true;
    this.notifyStatus();

    try {
      // 1. Sync units
      const allUnitsMap = new Map<string, any>();
      units.forEach(u => {
        allUnitsMap.set(u.sigla.toUpperCase(), {
          id: u.id,
          sigla: u.sigla,
          nome: u.nome,
          municipio: u.municipio || 'Alagoas',
          tipo: u.tipo || 'Hospital',
          ativa: u.ativa ?? true,
        });
      });

      orders.forEach(o => {
        const sigla = (o.unidade || '').trim();
        if (sigla && !allUnitsMap.has(sigla.toUpperCase())) {
          allUnitsMap.set(sigla.toUpperCase(), {
            id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sigla: sigla,
            nome: sigla,
            municipio: 'Alagoas',
            tipo: 'Hospital',
            ativa: true,
          });
        }
      });

      const fullUnitsList = Array.from(allUnitsMap.values());
      if (fullUnitsList.length > 0) {
        await supabase.from('unidades_hospitalares').upsert(fullUnitsList);
      }

      // 2. Sync schedules
      const validScheduleIds = new Set<string>();
      if (schedules.length > 0) {
        schedules.forEach(s => validScheduleIds.add(s.id));
        await supabase.from('cronogramas').upsert(
          schedules.map(s => ({
            id: s.id,
            nome: s.nome,
            competencia: s.competencia,
            unidade: s.unidade,
            programa: s.programa,
            tipo_pedido: s.tipo_pedido,
            data_limite_solicitacao: s.data_limite_solicitacao,
            data_limite_aprovacao: s.data_limite_aprovacao,
            data_separacao: s.data_separacao,
            data_expedicao: s.data_expedicao,
            data_entrega: s.data_entrega,
            observacao: s.observacao,
            ativo: s.ativo,
          }))
        );
      }

      // 3. Sync orders in chunks of 100
      let syncedOrders = 0;
      const CHUNK_SIZE = 100;
      const allEventsToSync: any[] = [];

      for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
        const chunk = orders.slice(i, i + CHUNK_SIZE);
        const mapped = chunk.map(o => {
          if (o.eventos && o.eventos.length > 0) {
            o.eventos.forEach(ev => {
              allEventsToSync.push({
                id: ev.id,
                pedido_id: ev.pedido_id || o.id,
                tipo_evento: ev.tipo_evento,
                status: ev.status,
                data_evento: ev.data_evento,
                responsavel: ev.responsavel,
                origem: ev.origem || 'SISTEMA',
                observacao: ev.observacao || null,
              });
            });
          }

          return {
            id: o.id,
            codigo: o.codigo,
            origem: o.origem,
            tipo: o.tipo,
            solicitante: o.solicitante,
            cpf: o.cpf,
            programa: o.programa,
            unidade: o.unidade,
            quantidade_itens: o.quantidade_itens,
            criado_em: o.criado_em,
            status_origem: o.status_origem,
            status_operacional: o.status_operacional,
            validador: o.validador,
            validada_em: o.validada_em,
            separador: o.separador,
            separado_em: o.separado_em,
            conferente: o.conferente,
            conferido_em: o.conferido_em,
            expedidor: o.expedidor,
            expedido_em: o.expedido_em,
            entregador: o.entregador,
            entregue_em: o.entregue_em,
            historico_original: o.historico_original,
            cronograma_id: (o.cronograma_id && validScheduleIds.has(o.cronograma_id)) ? o.cronograma_id : null,
            cronograma_vinculo: o.cronograma_vinculo,
            data_inicio: o.data_inicio,
            data_solicitacao: o.data_solicitacao,
            data_aprovacao: o.data_aprovacao,
            data_inicio_separacao: o.data_inicio_separacao,
            data_expedicao: o.data_expedicao,
            data_prevista_entrega: o.data_prevista_entrega,
            prioridade: o.prioridade,
            observacoes: o.observacoes,
            importacao_id: o.importacao_id,
          };
        });

        const { error } = await supabase.from('pedidos').upsert(mapped);
        if (error) {
          throw new Error(`Erro ao enviar pedidos: ${error.message}`);
        }
        syncedOrders += chunk.length;
      }

      // 4. Sync events in chunks of 200
      for (let i = 0; i < allEventsToSync.length; i += 200) {
        const evChunk = allEventsToSync.slice(i, i + 200);
        await supabase.from('eventos_pedidos').upsert(evChunk);
      }

      this.status.supabaseConnected = true;
      this.status.supabaseSyncing = false;
      this.status.lastSupabaseSync = new Date();
      this.notifyStatus();

      return {
        success: true,
        message: `${syncedOrders} pedidos e configurações sincronizados com o Supabase com sucesso!`,
        count: syncedOrders,
      };
    } catch (err: any) {
      this.status.supabaseSyncing = false;
      this.notifyStatus();
      return { success: false, message: err.message || String(err), count: 0 };
    }
  }

  // Batch upload items into Firestore
  public async bulkUploadToFirestore(orders: Order[], schedules: Schedule[], units: HospitalUnit[]): Promise<void> {
    if (orders.length === 0) return;
    this.status.firestoreSyncing = true;
    this.notifyStatus();

    try {
      if (schedules.length > 0) {
        const schBatch = writeBatch(db);
        schedules.forEach(s => schBatch.set(doc(db, 'schedules', s.id), s));
        await schBatch.commit();
      }

      if (units.length > 0) {
        const unitBatch = writeBatch(db);
        units.forEach(u => unitBatch.set(doc(db, 'hospital_units', u.id), u));
        await unitBatch.commit();
      }

      const CHUNK_SIZE = 400;
      for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
        const chunk = orders.slice(i, i + CHUNK_SIZE);
        const orderBatch = writeBatch(db);
        chunk.forEach(o => orderBatch.set(doc(db, 'orders', o.id), o));
        await orderBatch.commit();
      }

      this.status.firestoreConnected = true;
      this.status.firestoreSyncing = false;
      this.status.lastFirestoreSync = new Date();
      this.notifyStatus();
    } catch (error) {
      this.status.firestoreSyncing = false;
      this.notifyStatus();
      handleFirestoreError(error, OperationType.WRITE, 'bulk_upload');
    }
  }

  /**
   * Cleans and deletes database records from Supabase and Firestore.
   * mode:
   *  - 'wipe_orders': Deletes all orders, events, and imports (keeps schedules & units)
   *  - 'reseed_clean': Deletes corrupted orders and prepares for clean seed
   *  - 'wipe_all': Complete database reset (orders, events, imports, audit logs)
   */
  public async clearBackendDatabase(
    mode: 'wipe_orders' | 'reseed_clean' | 'wipe_all' = 'wipe_orders'
  ): Promise<{ success: boolean; message: string; clearedOrdersCount: number }> {
    this.status.supabaseSyncing = true;
    this.status.firestoreSyncing = true;
    this.notifyStatus();

    let deletedOrdersCount = 0;

    // 1. Delete records from Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // Delete events first in batches to avoid foreign key errors and timeouts
        let evEmpty = false;
        let evLoops = 0;
        while (!evEmpty && evLoops < 50) {
          evLoops++;
          const { data: evPage, error: evErr } = await supabase
            .from('eventos_pedidos')
            .select('id')
            .limit(2500);

          if (evErr) {
            console.warn('Supabase fetch eventos error:', evErr.message);
            await supabase.from('eventos_pedidos').delete().neq('id', '___safe_delete___');
            break;
          }
          if (!evPage || evPage.length === 0) {
            evEmpty = true;
            break;
          }
          const ids = evPage.map(r => r.id);
          const { error: delErr } = await supabase.from('eventos_pedidos').delete().in('id', ids);
          if (delErr) {
            console.warn('Supabase chunk delete eventos error:', delErr.message);
            break;
          }
          if (evPage.length < 2500) break;
        }

        // Delete orders in batches
        let ordEmpty = false;
        let ordLoops = 0;
        while (!ordEmpty && ordLoops < 50) {
          ordLoops++;
          const { data: ordPage, error: ordErr } = await supabase
            .from('pedidos')
            .select('id')
            .limit(1000);

          if (ordErr) {
            console.warn('Supabase fetch pedidos error:', ordErr.message);
            await supabase.from('pedidos').delete().neq('id', '___safe_delete___');
            break;
          }
          if (!ordPage || ordPage.length === 0) {
            ordEmpty = true;
            break;
          }
          const ids = ordPage.map(r => r.id);
          const { error: delErr } = await supabase.from('pedidos').delete().in('id', ids);
          if (delErr) {
            console.warn('Supabase chunk delete pedidos error:', delErr.message);
            break;
          }
          deletedOrdersCount += ids.length;
          if (ordPage.length < 1000) break;
        }

        // Delete import records
        try {
          await supabase.from('importacoes').delete().neq('id', '___safe_delete___');
        } catch (impErr) {
          console.warn('Supabase clear importacoes note:', impErr);
        }

        // If wipe_all, also clear audit logs
        if (mode === 'wipe_all') {
          try {
            await supabase.from('logs_auditoria').delete().neq('id', '___safe_delete___');
          } catch (audErr) {
            console.warn('Supabase clear logs_auditoria note:', audErr);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase clearBackendDatabase top error:', sbErr);
      }
    }

    // 2. Delete documents from Firestore
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      if (!ordersSnap.empty) {
        const BATCH_SIZE = 400;
        for (let i = 0; i < ordersSnap.docs.length; i += BATCH_SIZE) {
          const chunk = ordersSnap.docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      const importSnap = await getDocs(collection(db, 'import_records'));
      if (!importSnap.empty) {
        const batch = writeBatch(db);
        importSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      if (mode === 'wipe_all') {
        const auditSnap = await getDocs(collection(db, 'audit_logs'));
        if (!auditSnap.empty) {
          const batch = writeBatch(db);
          auditSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (fsErr) {
      console.warn('Firestore clearBackendDatabase note:', fsErr);
    }

    this.status.supabaseSyncing = false;
    this.status.firestoreSyncing = false;
    this.status.lastSupabaseSync = new Date();
    this.status.lastFirestoreSync = new Date();
    this.notifyStatus();

    return {
      success: true,
      message: `Banco de dados limpo com sucesso! ${deletedOrdersCount > 0 ? `${deletedOrdersCount} pedidos foram excluídos.` : 'Registros excluídos com sucesso.'}`,
      clearedOrdersCount: deletedOrdersCount,
    };
  }
}

export const dbSync = new DatabaseSyncService();
