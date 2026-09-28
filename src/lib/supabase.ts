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
export const SUPABASE_SETUP_SQL = `-- SCRIPT DE CRIAÇÃO DAS TABELAS NO SUPABASE
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

-- Habilitar RLS (Row Level Security) e permitir acesso público/anon
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_hospitalares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público leitura e escrita pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público leitura e escrita cronogramas" ON public.cronogramas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público leitura e escrita unidades" ON public.unidades_hospitalares FOR ALL USING (true) WITH CHECK (true);
`;
