import React, { useState } from 'react';
import { Database, Copy, Check, X, ExternalLink, Terminal, ShieldCheck, Zap } from 'lucide-react';
import { SUPABASE_SETUP_SQL } from '../../lib/supabase';
import { showToast } from './Toast';

interface SupabaseSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_PATCH_SQL = `-- SCRIPT DE ATUALIZAÇÃO / CORREÇÃO RÁPIDA - SUPABASE SESAU
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- Este script corrige a gravação de planilhas de grande porte (3.000+ pedidos)

-- 1. Garante que a coluna 'codigo' possui índice único para atualização automática (Upsert de alta velocidade)
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_codigo_key ON public.pedidos (codigo);

-- 2. Adiciona colunas de auditoria na tabela de importações caso ainda não existam
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'CONCLUIDA';
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS motivo_status TEXT;
ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS tempo_processamento_ms INTEGER;

-- 3. Ajusta a chave estrangeira para permitir importações em lote sem bloqueio de integridade
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS fk_pedidos_importacoes;
ALTER TABLE public.pedidos ADD CONSTRAINT fk_pedidos_importacoes 
  FOREIGN KEY (importacao_id) REFERENCES public.importacoes(id) ON DELETE SET NULL;

-- 4. Garante permissão total de leitura e escrita (RLS) para o sistema web
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_pedidos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita pedidos') THEN
    CREATE POLICY "Acesso público leitura e escrita pedidos" ON public.pedidos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita importacoes') THEN
    CREATE POLICY "Acesso público leitura e escrita importacoes" ON public.importacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público leitura e escrita eventos') THEN
    CREATE POLICY "Acesso público leitura e escrita eventos" ON public.eventos_pedidos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

export const SupabaseSqlModal: React.FC<SupabaseSqlModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'patch' | 'complete'>('patch');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentSql = activeTab === 'patch' ? SUPABASE_PATCH_SQL : SUPABASE_SETUP_SQL;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentSql);
      setCopied(true);
      showToast('success', 'SQL Copiado!', 'O script foi copiado para a sua área de transferência.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('error', 'Falha ao copiar', 'Selecione o texto manualmente e use Ctrl+C.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Comandos SQL para o Banco Supabase
              </h2>
              <p className="text-xs text-slate-500">
                Execute no <strong>SQL Editor</strong> do painel Supabase para destravar gravações e atualizar colunas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="p-5 border-b border-slate-100 bg-blue-50/50 space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-bold text-blue-900">
            <Zap className="w-4 h-4 text-blue-600" />
            <span>Passo a Passo Rápido:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
            <li>Acesse o painel do seu projeto no Supabase (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline font-mono inline-flex items-center gap-1">supabase.com/dashboard <ExternalLink className="w-3 h-3" /></a>).</li>
            <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong>.</li>
            <li>Clique em <strong>New Query</strong>, cole o código abaixo e clique no botão verde <strong>RUN</strong>.</li>
          </ol>
        </div>

        {/* Tab switch */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('patch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'patch'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Script de Correção Rápida (Recomendado)
              </span>
            </button>
            <button
              onClick={() => setActiveTab('complete')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'complete'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Script Completo de Instalação (Todas as Tabelas)
              </span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar SQL'}</span>
          </button>
        </div>

        {/* Code View */}
        <div className="p-5 flex-1 overflow-auto bg-slate-950 font-mono text-xs text-emerald-400">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {currentSql}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {activeTab === 'patch' 
              ? 'Ajusta índices de unicidade e foreign keys sem apagar nenhum registro existente.' 
              : 'Cria todas as 6 tabelas (pedidos, cronogramas, unidades, eventos, importações, auditoria).'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
