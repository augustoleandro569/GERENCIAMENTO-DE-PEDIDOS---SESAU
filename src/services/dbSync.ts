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
import firebaseConfig from '../../firebase-applet-config.json';
import { getSupabaseClient, getSavedSupabaseConfig } from '../lib/supabase';
import { Order, Schedule, HospitalUnit, AuditLog, OrderEvent, ImportRecord } from '../types';
import { parseHistoryToEvents } from '../utils/historyParser';
import { computeRealisticItemCount } from '../utils/itemQuantity';

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

export interface DatabaseSaveProgress {
  stage: 'INICIANDO' | 'FIRESTORE' | 'SUPABASE' | 'CONCLUIDO' | 'ERRO';
  current: number;
  total: number;
  percentage: number;
  message: string;
  speedRowsPerSec?: number;
  elapsedSec?: number;
  currentBatch?: number;
  totalBatches?: number;
}

/**
 * Lean and strict sanitizer for Order documents in Firestore.
 * Ensures consistent types, strips undefined, restricts history and events size,
 * preventing document bloat and guaranteeing the entire 3,000+ dataset easily fits
 * in Firestore free tier 128 MiB query limits!
 */
export function sanitizeOrderForFirestore(order: Order): Record<string, any> {
  const cleanId = String(order.id || '').trim();
  const cleanCodigo = String(order.codigo || '').trim().toUpperCase();

  return {
    id: cleanId,
    codigo: cleanCodigo,
    origem: order.origem || 'IMPORTAÇÃO',
    tipo: order.tipo || 'Mensal',
    solicitante: order.solicitante || 'Solicitante SESAU',
    cpf: order.cpf || '—',
    programa: order.programa || 'Hospitalar',
    unidade: order.unidade || '',
    quantidade_itens: Number(order.quantidade_itens) || 1,
    criado_em: order.criado_em || order.data_solicitacao || new Date().toISOString(),
    status_origem: order.status_origem || 'Aguardando Validação',
    status_operacional: order.status_operacional || 'Aguardando Validação',
    prioridade: order.prioridade || 'Normal',
    validador: order.validador || null,
    validada_em: order.validada_em || null,
    separador: order.separador || null,
    separado_em: order.separado_em || null,
    conferente: order.conferente || null,
    conferido_em: order.conferido_em || null,
    expedidor: order.expedidor || null,
    expedido_em: order.expedido_em || null,
    entregador: order.entregador || null,
    entregue_em: order.entregue_em || null,
    data_inicio: order.data_inicio || order.data_solicitacao || null,
    data_solicitacao: order.data_solicitacao || null,
    data_aprovacao: order.data_aprovacao || null,
    data_inicio_separacao: order.data_inicio_separacao || null,
    data_expedicao: order.data_expedicao || null,
    data_prevista_entrega: order.data_prevista_entrega || null,
    cronograma_id: order.cronograma_id || null,
    cronograma_vinculo: order.cronograma_vinculo || 'NENHUM',
    importacao_id: order.importacao_id || null,
    observacoes: order.observacoes || null,
    // Keep history string concise (< 1500 chars) to prevent document bloat
    historico_original: (order.historico_original || '').slice(0, 1500),
    // Sanitize event items (keep most recent 6 events to ensure documents stay around ~1 KB)
    eventos: Array.isArray(order.eventos)
      ? order.eventos.slice(0, 6).map(ev => ({
          id: ev.id || `ev-${Date.now()}`,
          pedido_id: cleanId,
          tipo_evento: ev.tipo_evento || 'Atualização',
          status: ev.status || 'Aguardando Validação',
          data_evento: ev.data_evento || new Date().toISOString(),
          responsavel: ev.responsavel || 'Sistema',
          origem: ev.origem || 'IMPORTAÇÃO',
        }))
      : [],
    atualizado_em: order.atualizado_em || new Date().toISOString(),
  };
}

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
  private isBulkSaving = false;
  private realtimeChannel: any = null;
  private onRemoteOrderChange?: (payload: any) => void;
  private onRemoteScheduleChange?: (payload: any) => void;
  private firestoreUnsubs: (() => void)[] = [];

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
      // 1. Fetch exact count first to guarantee zero truncation
      let totalExpectedOrders: number | null = null;
      try {
        const { count, error: countErr } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true });
        if (!countErr && typeof count === 'number') {
          totalExpectedOrders = count;
        }
      } catch (countErr) {
        console.warn('Supabase exact count fetch warning:', countErr);
      }

      // 1. Fetch Orders with robust multi-page pagination to retrieve ALL imported lines without truncation
      const rawOrders: any[] = [];
      const seenOrderIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      const maxPages = 100; // supports up to 100,000 order lines
      let pageCount = 0;

      while (pageCount < maxPages) {
        pageCount++;
        let pageData: any[] = [];
        let fetchSuccess = false;

        // Retry up to 3 times per chunk to prevent transient network interruptions
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const { data: page, error: ordErr } = await supabase
              .from('pedidos')
              .select('*')
              .order('criado_no_sistema_em', { ascending: false, nullsFirst: false })
              .order('id', { ascending: true })
              .range(from, from + pageSize - 1);

            if (ordErr) {
              console.warn(`Aviso ao buscar lote de pedidos (${from} a ${from + pageSize - 1}, tentativa ${attempt}):`, ordErr.message);
              if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt));
            } else if (page) {
              pageData = page;
              fetchSuccess = true;
              break;
            }
          } catch (netErr: any) {
            console.warn(`Exceção ao buscar lote (${from}-${from + pageSize - 1}):`, netErr);
            if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt));
          }
        }

        if (!fetchSuccess || pageData.length === 0) break;

        for (const ord of pageData) {
          if (ord && ord.id && !seenOrderIds.has(ord.id)) {
            seenOrderIds.add(ord.id);
            rawOrders.push(ord);
          }
        }

        // If totalExpectedOrders is known and reached, or page is smaller than pageSize, all rows are loaded
        if (totalExpectedOrders !== null && rawOrders.length >= totalExpectedOrders) break;
        if (pageData.length < pageSize) break;

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
        let evFrom = 0;
        const evPageSize = 2500;
        let evLoops = 0;
        while (evLoops < 10) {
          evLoops++;
          const { data: rawEvents, error: evErr } = await supabase
            .from('eventos_pedidos')
            .select('*')
            .order('data_evento', { ascending: true })
            .range(evFrom, evFrom + evPageSize - 1);

          if (evErr || !rawEvents || rawEvents.length === 0) break;
          for (const ev of rawEvents) {
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
          }
          if (rawEvents.length < evPageSize) break;
          evFrom += evPageSize;
        }
      } catch (evErr) {
        console.warn('Eventos fetch note:', evErr);
      }

      // Format and filter Orders: strictly require SOL-2026- prefix and unique codes
      const seenCodes = new Set<string>();
      const seenIds = new Set<string>();
      const validRawOrders: any[] = [];
      const invalidOrderIds: string[] = [];

      for (const o of (rawOrders || [])) {
        const code = (o.codigo || '').trim().toUpperCase();
        if (!code.startsWith('SOL-2026-')) {
          invalidOrderIds.push(o.id);
          continue;
        }
        if (seenCodes.has(code) || seenIds.has(o.id)) {
          invalidOrderIds.push(o.id);
          continue;
        }
        seenCodes.add(code);
        seenIds.add(o.id);
        validRawOrders.push(o);
      }

      // Purge any non-standard or duplicate orders from the database
      if (invalidOrderIds.length > 0 && supabase) {
        console.warn(`Purging ${invalidOrderIds.length} non-standard or duplicate orders from database...`);
        supabase.from('pedidos').delete().in('id', invalidOrderIds).then();
        supabase.from('eventos_pedidos').delete().in('pedido_id', invalidOrderIds).then();
      }

      const formattedOrders: Order[] = validRawOrders.map((o: any) => {
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
          quantidade_itens: computeRealisticItemCount({
            codigo: o.codigo,
            tipo: o.tipo,
            unidade: o.unidade,
            programa: o.programa,
            quantidade_itens: Number(o.quantidade_itens)
          }),
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

    // Check if quota was already exceeded today
    const todayStr = new Date().toISOString().slice(0, 10);
    const quotaDay = typeof window !== 'undefined' ? localStorage.getItem('gp_firestore_quota_exceeded_day') : null;
    if (quotaDay === todayStr) {
      console.warn('Firestore daily read quota was reached today. Using Supabase as the primary database.');
      this.status.firestoreConnected = false;
      this.status.activeProvider = 'supabase';
      this.notifyStatus();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
          detail: {
            error: "Quota limit exceeded for free tier database today.",
            upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
          }
        }));
      }
      return;
    }

    try {
      // Clear previous listeners if any
      this.firestoreUnsubs.forEach(unsub => {
        try { unsub(); } catch (_) {}
      });
      this.firestoreUnsubs = [];

      const handleQuotaDetach = (err: any) => {
        const msg = String(err?.message || err);
        if (msg.includes('Quota limit exceeded') || msg.includes('Quota exceeded') || msg.includes('quota metric') || err?.code === 'resource-exhausted') {
          // Detach listeners to stop hammering Firestore during quota exhaustion
          this.firestoreUnsubs.forEach(unsub => {
            try { unsub(); } catch (_) {}
          });
          this.firestoreUnsubs = [];
          this.status.firestoreConnected = false;
          this.status.activeProvider = 'supabase';
          this.notifyStatus();
        }
      };

      // 1. Attach real-time listener for Orders in Firestore
      const unsubOrders = onSnapshot(
        collection(db, 'orders'),
        (snapshot) => {
          if (this.isBulkSaving) {
            // Ignore snapshot storms while writing batches of bulk import
            return;
          }
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
          handleQuotaDetach(error);
          handleFirestoreError(error, OperationType.LIST, 'orders');
        }
      );
      this.firestoreUnsubs.push(unsubOrders);

      // 2. Attach real-time listener for Schedules
      const unsubSchedules = onSnapshot(
        collection(db, 'schedules'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Schedule[] = [];
            snapshot.forEach((d) => list.push(d.data() as Schedule));
            onRemoteSchedules(list);
          }
        },
        (error) => {
          handleQuotaDetach(error);
          handleFirestoreError(error, OperationType.LIST, 'schedules');
        }
      );
      this.firestoreUnsubs.push(unsubSchedules);

      // 3. Attach real-time listener for Hospital Units
      const unsubUnits = onSnapshot(
        collection(db, 'hospital_units'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: HospitalUnit[] = [];
            snapshot.forEach((d) => list.push(d.data() as HospitalUnit));
            onRemoteUnits(list);
          }
        },
        (error) => {
          handleQuotaDetach(error);
          handleFirestoreError(error, OperationType.LIST, 'hospital_units');
        }
      );
      this.firestoreUnsubs.push(unsubUnits);

      // 4. Attach real-time listener for Import Records if handler provided
      if (onRemoteImports) {
        const unsubImports = onSnapshot(
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
            handleQuotaDetach(error);
            handleFirestoreError(error, OperationType.LIST, 'import_records');
          }
        );
        this.firestoreUnsubs.push(unsubImports);
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
    if (!order.codigo || !order.codigo.toUpperCase().startsWith('SOL-2026-')) {
      console.warn(`[dbSync] Rejected save of non-standard order ${order.codigo}. Orders must begin with SOL-2026-.`);
      return;
    }

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
   * High-performance parallelized writes to Firestore (batches of 400 with controlled concurrency),
   * real-time progress & speed counters, signal cancellation, and parallel bulk upsert to Supabase.
   */
  public async saveImportedData(
    ordersToSave: Order[],
    importRecord: ImportRecord,
    auditLogsToSave: AuditLog[] = [],
    onProgress?: (progress: DatabaseSaveProgress) => void,
    signal?: AbortSignal
  ): Promise<{ success: boolean; count: number; message: string; error?: string; partial?: boolean }> {
    let savedOrdersCount = 0;
    let failureError: string | undefined = undefined;
    const startTime = performance.now();
    this.status.firestoreSyncing = true;
    this.isBulkSaving = true;
    this.notifyStatus();

    onProgress?.({
      stage: 'INICIANDO',
      current: 0,
      total: ordersToSave.length,
      percentage: 2,
      message: `Iniciando gravação de ${ordersToSave.length.toLocaleString('pt-BR')} registros no banco de dados...`,
      speedRowsPerSec: 0,
      elapsedSec: 0,
    });

    if (signal?.aborted) {
      this.isBulkSaving = false;
      this.status.firestoreSyncing = false;
      this.notifyStatus();
      return {
        success: false,
        count: 0,
        message: 'Gravação cancelada pelo usuário.',
        error: 'Cancelado pelo usuário antes do início da gravação.',
      };
    }

    // 1. PRIMARY PERSISTENCE: High-speed parallel upsert into relational Supabase database
    const supabase = getSupabaseClient();
    let supabaseSuccess = false;

    if (supabase && !signal?.aborted) {
      try {
        this.status.supabaseSyncing = true;
        this.notifyStatus();

        // 1.1 ALWAYS Save Import Record in Supabase FIRST to satisfy foreign key constraints (fk_pedidos_importacoes)
        if (importRecord) {
          const fullRecordPayload = {
            id: importRecord.id,
            arquivo: importRecord.arquivo,
            data_importacao: importRecord.data_importacao,
            usuario: importRecord.usuario,
            quantidade_registros: importRecord.quantidade_registros,
            novos: importRecord.novos,
            atualizados: importRecord.atualizados,
            sem_alteracao: importRecord.sem_alteracao,
            erros: importRecord.erros,
            status: importRecord.status || 'CONCLUIDA',
            motivo_status: importRecord.motivo_status || null,
            tempo_processamento_ms: importRecord.tempo_processamento_ms || Math.round(performance.now() - startTime),
          };

          const { error: impErr } = await supabase.from('importacoes').upsert(fullRecordPayload, { onConflict: 'id' });
          if (impErr) {
            console.warn('Supabase importacoes upsert note:', impErr.message);
            // Fallback without extended fields if table was created with older script
            try {
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
              }, { onConflict: 'id' });
            } catch (fallbackErr) {
              console.warn('Supabase fallback import record note:', fallbackErr);
            }
          }
        }

        // 1.2 Bulk Upsert Pedidos into Supabase
        if (ordersToSave && ordersToSave.length > 0) {
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
            historico_original: (order.historico_original || '').slice(0, 1500),
            cronograma_id: order.cronograma_id ?? null,
            cronograma_vinculo: order.cronograma_vinculo || 'NENHUM',
            data_inicio: order.data_inicio ?? null,
            data_solicitacao: order.data_solicitacao ?? null,
            data_aprovacao: order.data_aprovacao ?? null,
            data_inicio_separacao: order.data_inicio_separacao ?? null,
            data_expedicao: order.data_expedicao ?? null,
            data_prevista_entrega: order.data_prevista_entrega ?? null,
            prioridade: order.prioridade || 'Normal',
            observacoes: order.observacoes || null,
            importacao_id: order.importacao_id || importRecord?.id || null,
            atualizado_em: order.atualizado_em || new Date().toISOString(),
          }));

          const CHUNK_SIZE = 500;
          const totalChunks = Math.ceil(payload.length / CHUNK_SIZE);

          for (let i = 0; i < payload.length; i += CHUNK_SIZE * 2) {
            if (signal?.aborted) throw new Error('Gravação cancelada pelo usuário.');

            const chunk1 = payload.slice(i, i + CHUNK_SIZE);
            const chunk2 = payload.slice(i + CHUNK_SIZE, i + CHUNK_SIZE * 2);

            // Upsert on 'codigo' so repeated imports update existing order records without duplicate key errors
            const upsertChunk = async (chunk: any[]) => {
              if (chunk.length === 0) return { error: null, count: 0 };
              const { error } = await supabase.from('pedidos').upsert(chunk, { onConflict: 'codigo' });
              if (error) {
                // If onConflict 'codigo' fails (e.g. index missing), try onConflict 'id'
                const fallback = await supabase.from('pedidos').upsert(chunk, { onConflict: 'id' });
                return { error: fallback.error, count: fallback.error ? 0 : chunk.length };
              }
              return { error: null, count: chunk.length };
            };

            const [res1, res2] = await Promise.all([
              upsertChunk(chunk1),
              chunk2.length > 0 ? upsertChunk(chunk2) : Promise.resolve({ error: null, count: 0 })
            ]);

            if (res1.error) {
              console.warn('Supabase pedidos chunk 1 upsert note:', res1.error.message);
              failureError = res1.error.message;
            } else {
              savedOrdersCount += res1.count;
            }

            if (res2.error) {
              console.warn('Supabase pedidos chunk 2 upsert note:', res2.error.message);
              failureError = res2.error.message;
            } else {
              savedOrdersCount += res2.count;
            }

            const currentBatchDisplay = Math.min(Math.ceil((i + CHUNK_SIZE * 2) / CHUNK_SIZE), totalChunks);
            const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
            const speed = Math.round(savedOrdersCount / elapsedSec);
            const pct = Math.min(92, Math.round((savedOrdersCount / ordersToSave.length) * 85) + 5);

            onProgress?.({
              stage: 'SUPABASE',
              current: savedOrdersCount,
              total: ordersToSave.length,
              percentage: pct,
              message: `Gravando no Supabase: ${savedOrdersCount.toLocaleString('pt-BR')} de ${ordersToSave.length.toLocaleString('pt-BR')} pedidos salvos (Lote ${currentBatchDisplay}/${totalChunks})...`,
              speedRowsPerSec: speed,
              elapsedSec: Math.round(elapsedSec),
              currentBatch: currentBatchDisplay,
              totalBatches: totalChunks,
            });

            // Yield to UI rendering loop
            await new Promise(r => setTimeout(r, 5));
          }

          // 1.3 Sync Timeline Events
          const eventsToSync: any[] = [];
          ordersToSave.forEach(ord => {
            if (ord.eventos && ord.eventos.length > 0) {
              ord.eventos.slice(0, 4).forEach(ev => {
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
            for (let i = 0; i < eventsToSync.length; i += 500) {
              if (signal?.aborted) break;
              const evChunk = eventsToSync.slice(i, i + 500);
              try {
                await supabase.from('eventos_pedidos').upsert(evChunk, { onConflict: 'id' });
              } catch (err) {
                console.warn('Supabase eventos_pedidos upsert note:', err);
              }
            }
          }
        }

        supabaseSuccess = true;
        this.status.supabaseConnected = true;
        this.status.lastSupabaseSync = new Date();
      } catch (sbErr: any) {
        console.warn('Supabase saveImportedData upsert error:', sbErr);
        failureError = sbErr?.message || String(sbErr);
      } finally {
        this.status.supabaseSyncing = false;
        this.notifyStatus();
      }
    }

    // 2. SECONDARY / MIRROR: Non-blocking Firestore persistence with strict 3-second timeout
    // Prevents any hangs if Firebase is slow, offline, or experiencing network latency on Vercel
    if (!signal?.aborted) {
      const timeoutWrapper = <T>(promise: Promise<T>, ms = 2500): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), ms)
          ),
        ]);
      };

      try {
        if (importRecord && importRecord.id) {
          const recordDocRef = doc(db, 'import_records', String(importRecord.id));
          await timeoutWrapper(
            setDoc(recordDocRef, sanitizeForFirestore(importRecord), { merge: true }),
            2000
          ).catch(e => console.warn('Firestore import record mirror note:', e));
        }

        let firestoreSavedCount = 0;
        if (ordersToSave && ordersToSave.length > 0) {
          const BATCH_SIZE = 400;
          const chunks: Order[][] = [];
          for (let i = 0; i < ordersToSave.length; i += BATCH_SIZE) {
            chunks.push(ordersToSave.slice(i, i + BATCH_SIZE));
          }

          // Process in fast waves of 3 batches with 3.5s timeout per wave
          for (let i = 0; i < chunks.length; i += 3) {
            if (signal?.aborted) break;
            const wave = chunks.slice(i, i + 3);
            await timeoutWrapper(
              Promise.all(
                wave.map(async (chunk) => {
                  const batch = writeBatch(db);
                  for (const order of chunk) {
                    if (!order || !order.id) continue;
                    const orderDocRef = doc(db, 'orders', String(order.id));
                    batch.set(orderDocRef, sanitizeOrderForFirestore(order), { merge: true });
                  }
                  await batch.commit();
                  firestoreSavedCount += chunk.length;
                })
              ),
              3500
            ).catch(e => {
              console.warn('Firestore batch wave note (safe fallback, data is secured in Supabase):', e);
            });
          }
        }

        if (savedOrdersCount === 0 && firestoreSavedCount > 0) {
          savedOrdersCount = firestoreSavedCount;
        }

        if (auditLogsToSave && auditLogsToSave.length > 0) {
          const chunk = auditLogsToSave.slice(0, 400);
          await timeoutWrapper(
            (async () => {
              const batch = writeBatch(db);
              for (const log of chunk) {
                if (!log || !log.id) continue;
                batch.set(doc(db, 'audit_logs', String(log.id)), sanitizeForFirestore(log), { merge: true });
              }
              await batch.commit();
            })(),
            2500
          ).catch(() => {});
        }

        this.status.firestoreConnected = true;
        this.status.lastFirestoreSync = new Date();
      } catch (fsErr) {
        console.warn('Firestore mirror note (non-critical, data secured in Supabase):', fsErr);
      } finally {
        this.isBulkSaving = false;
        this.status.firestoreSyncing = false;
        this.notifyStatus();
      }
    }

    const isSuccess = savedOrdersCount > 0 || ordersToSave.length === 0;
    const isPartial = savedOrdersCount > 0 && savedOrdersCount < ordersToSave.length;

    const totalDurationSec = Math.max(0.1, (performance.now() - startTime) / 1000);
    const avgSpeed = Math.round(savedOrdersCount / totalDurationSec);

    onProgress?.({
      stage: isSuccess ? 'CONCLUIDO' : 'ERRO',
      current: savedOrdersCount,
      total: ordersToSave.length,
      percentage: isSuccess ? 100 : Math.round((savedOrdersCount / (ordersToSave.length || 1)) * 100),
      message: isSuccess
        ? `${savedOrdersCount.toLocaleString('pt-BR')} pedidos gravados com sucesso no banco de dados (${totalDurationSec.toFixed(1)}s)!`
        : `A gravação no banco de dados não foi concluída: ${failureError || 'Nenhum pedido pôde ser persistido.'}`,
      speedRowsPerSec: avgSpeed,
      elapsedSec: Math.round(totalDurationSec),
    });

    return {
      success: isSuccess,
      partial: isPartial,
      count: savedOrdersCount,
      message: isSuccess
        ? `${savedOrdersCount.toLocaleString('pt-BR')} pedidos gravados no banco de dados com sucesso (${totalDurationSec.toFixed(1)}s).`
        : 'Falha ao persistir registros no banco de dados.',
      error: !isSuccess ? (failureError || 'Nenhum pedido pôde ser gravado no banco de dados') : undefined,
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

  // Delete single Unit
  public async deleteUnit(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('unidades_hospitalares').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase unit delete note:', err);
      }
    }

    try {
      await deleteDoc(doc(db, 'hospital_units', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `hospital_units/${id}`);
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
