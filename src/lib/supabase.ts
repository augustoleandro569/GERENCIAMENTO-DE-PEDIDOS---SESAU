import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_STORAGE_KEY = 'gp_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
}

const DEFAULT_SUPABASE_URL = 'https://rcujjqjsharoqozbshjc.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_adCVh2UTk53J0uV5nDO8Dw_pxYFdSOV';

export function formatSupabaseUrl(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}.supabase.co`;
}

export function isValidHttpUrl(str: unknown): boolean {
  if (!str || typeof str !== 'string') return false;
  const formatted = formatSupabaseUrl(str);
  try {
    const parsed = new URL(formatted);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSavedSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const urlStr = formatSupabaseUrl(typeof parsed?.url === 'string' ? parsed.url : '');
      const keyStr = typeof parsed?.anonKey === 'string' ? parsed.anonKey.trim() : '';
      if (isValidHttpUrl(urlStr) && keyStr) {
        return {
          url: urlStr,
          anonKey: keyStr,
          autoSync: true,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse Supabase config from localStorage', e);
  }

  // Fallback to env variables if available or configured default
  const envUrlRaw = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKeyRaw = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  const finalUrl = formatSupabaseUrl(envUrlRaw) || DEFAULT_SUPABASE_URL;
  const finalKey = envKeyRaw || DEFAULT_SUPABASE_KEY;

  return {
    url: finalUrl,
    anonKey: finalKey,
    autoSync: true,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  try {
    const sanitized: SupabaseConfig = {
      url: isValidHttpUrl(config.url) ? config.url.trim() : '',
      anonKey: (config.anonKey || '').trim(),
      autoSync: Boolean(config.autoSync && isValidHttpUrl(config.url) && config.anonKey?.trim()),
    };
    localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(sanitized));
    // Reset client cache
    cachedClient = null;
  } catch (e) {
    console.warn('Failed to save Supabase config to localStorage', e);
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getSavedSupabaseConfig();
  if (config.url && config.anonKey && isValidHttpUrl(config.url)) {
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return cachedClient;
    } catch {
      cachedClient = null;
      return null;
    }
  }
  return null;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  const trimmedUrl = (url || '').trim();
  const trimmedKey = (key || '').trim();

  if (!trimmedUrl || !trimmedKey) {
    return { success: false, message: 'URL e Chave Anônima do Supabase são obrigatórias.' };
  }

  if (!isValidHttpUrl(trimmedUrl)) {
    return {
      success: false,
      message: 'A URL do Supabase é inválida. Ela deve começar com https:// (exemplo: https://xyzcompany.supabase.co)',
    };
  }

  try {
    const tempClient = createClient(trimmedUrl, trimmedKey);
    // Attempt a light ping/query
    const { error } = await tempClient.from('pedidos').select('id').limit(1);
    if (error && error.code === 'PGRST116') {
      // Table doesn't exist yet, but connection authenticated!
      return { success: true, message: 'Conectado com sucesso ao Supabase! (Tabela pedidos ainda não criada)' };
    }
    if (error && error.message && error.message.includes('relation "public.pedidos" does not exist')) {
      return { success: true, message: 'Conectado com sucesso ao Supabase! (Execute o script SQL fornecido para criar as tabelas)' };
    }
    if (error) {
      return { success: false, message: `Erro retornado pelo Supabase: ${error.message}` };
    }
    return { success: true, message: 'Conexão com o Supabase estabelecida com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Falha na requisição: ${err.message || String(err)}` };
  }
}

// SQL Schema for Supabase SQL Editor
export const SUPABASE_SETUP_SQL = `-- SCRIPT OFICIAL SESAU - BANCO DE DADOS COMPLETO NO SUPABASE
-- Cole este script no SQL Editor do seu painel Supabase (https://supabase.com/dashboard)

-- 1. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  origem TEXT DEFAULT 'MANUAL',
  tipo TEXT NOT NULL,
  solicitante TEXT,
  cpf TEXT,
  programa TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade_itens INTEGER DEFAULT 1,
  criado_em TEXT,
  status_origem TEXT,
  status_operacional TEXT NOT NULL,
  validador TEXT,
  validada_em TEXT,
  separador TEXT,
  separado_em TEXT,
  conferente TEXT,
  conferido_em TEXT,
  expedidor TEXT,
  expedido_em TEXT,
  entregador TEXT,
  entregue_em TEXT,
  historico_original TEXT,
  cronograma_id TEXT,
  cronograma_vinculo TEXT,
  data_inicio TEXT,
  data_solicitacao TEXT,
  data_aprovacao TEXT,
  data_inicio_separacao TEXT,
  data_expedicao TEXT,
  data_prevista_entrega TEXT,
  prioridade TEXT DEFAULT 'Normal',
  observacoes TEXT,
  importacao_id TEXT,
  criado_no_sistema_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Cronogramas
CREATE TABLE IF NOT EXISTS public.cronogramas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  competencia TEXT NOT NULL,
  unidade TEXT NOT NULL,
  programa TEXT NOT NULL,
  tipo_pedido TEXT NOT NULL,
  data_limite_solicitacao TEXT,
  data_limite_aprovacao TEXT,
  data_separacao TEXT,
  data_expedicao TEXT,
  data_entrega TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Unidades Hospitalares
CREATE TABLE IF NOT EXISTS public.unidades_hospitalares (
  id TEXT PRIMARY KEY,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  municipio TEXT,
  tipo TEXT DEFAULT 'Hospital',
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Eventos e Linha do Tempo dos Pedidos
CREATE TABLE IF NOT EXISTS public.eventos_pedidos (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  tipo_evento TEXT,
  status TEXT,
  data_evento TEXT,
  responsavel TEXT,
  origem TEXT DEFAULT 'SISTEMA',
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Histórico de Importações
CREATE TABLE IF NOT EXISTS public.importacoes (
  id TEXT PRIMARY KEY,
  arquivo TEXT NOT NULL,
  data_importacao TEXT NOT NULL,
  usuario TEXT NOT NULL,
  quantidade_registros INTEGER DEFAULT 0,
  novos INTEGER DEFAULT 0,
  atualizados INTEGER DEFAULT 0,
  sem_alteracao INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  status TEXT DEFAULT 'CONCLUIDA',
  motivo_status TEXT,
  tempo_processamento_ms INTEGER,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Migração não-destrutiva caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'CONCLUIDA';
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS motivo_status TEXT;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS tempo_processamento_ms INTEGER;

-- 6. Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id TEXT PRIMARY KEY,
  pedido_id TEXT,
  codigo_pedido TEXT,
  usuario TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  novo_valor TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 7. Chaves Estrangeiras (Relacionamentos entre as tabelas no Supabase)
DO $$ BEGIN
  -- Conexão: pedidos.importacao_id -> importacoes.id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_pedidos_importacoes' AND table_name = 'pedidos') THEN
    UPDATE public.pedidos SET importacao_id = NULL WHERE importacao_id IS NOT NULL AND importacao_id NOT IN (SELECT id FROM public.importacoes);
    ALTER TABLE public.pedidos ADD CONSTRAINT fk_pedidos_importacoes FOREIGN KEY (importacao_id) REFERENCES public.importacoes(id) ON DELETE SET NULL;
  END IF;

  -- Conexão: pedidos.cronograma_id -> cronogramas.id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_pedidos_cronogramas' AND table_name = 'pedidos') THEN
    UPDATE public.pedidos SET cronograma_id = NULL WHERE cronograma_id IS NOT NULL AND cronograma_id NOT IN (SELECT id FROM public.cronogramas);
    ALTER TABLE public.pedidos ADD CONSTRAINT fk_pedidos_cronogramas FOREIGN KEY (cronograma_id) REFERENCES public.cronogramas(id) ON DELETE SET NULL;
  END IF;

  -- Conexão: eventos_pedidos.pedido_id -> pedidos.id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_eventos_pedidos' AND table_name = 'eventos_pedidos') THEN
    DELETE FROM public.eventos_pedidos WHERE pedido_id NOT IN (SELECT id FROM public.pedidos);
    ALTER TABLE public.eventos_pedidos ADD CONSTRAINT fk_eventos_pedidos FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;

  -- Conexão: logs_auditoria.pedido_id -> pedidos.id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_logs_auditoria_pedidos' AND table_name = 'logs_auditoria') THEN
    UPDATE public.logs_auditoria SET pedido_id = NULL WHERE pedido_id IS NOT NULL AND pedido_id NOT IN (SELECT id FROM public.pedidos);
    ALTER TABLE public.logs_auditoria ADD CONSTRAINT fk_logs_auditoria_pedidos FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Habilitar RLS (Row Level Security) e permitir acesso público/anon
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_hospitalares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita pedidos') THEN
    CREATE POLICY "Acesso público leitura e escrita pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita cronogramas') THEN
    CREATE POLICY "Acesso público leitura e escrita cronogramas" ON public.cronogramas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita unidades') THEN
    CREATE POLICY "Acesso público leitura e escrita unidades" ON public.unidades_hospitalares FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita eventos') THEN
    CREATE POLICY "Acesso público leitura e escrita eventos" ON public.eventos_pedidos FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita importacoes') THEN
    CREATE POLICY "Acesso público leitura e escrita importacoes" ON public.importacoes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita auditoria') THEN
    CREATE POLICY "Acesso público leitura e escrita auditoria" ON public.logs_auditoria FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Índices de Alta Performance para busca e ordenação rápida
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_no_sistema_em ON public.pedidos (criado_no_sistema_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_operacional ON public.pedidos (status_operacional);
CREATE INDEX IF NOT EXISTS idx_pedidos_unidade ON public.pedidos (unidade);
CREATE INDEX IF NOT EXISTS idx_eventos_pedidos_pedido_id ON public.eventos_pedidos (pedido_id);
CREATE INDEX IF NOT EXISTS idx_eventos_pedidos_data_evento ON public.eventos_pedidos (data_evento);

-- Ativar Sincronização em Tempo Real (Supabase Realtime)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cronogramas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
`;
