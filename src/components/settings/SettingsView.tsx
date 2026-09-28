import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { OrderStatus, UserRole } from '../../types';
import { 
  Settings, 
  Shield, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Layers, 
  Sliders, 
  AlertTriangle 
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    programs, 
    orderTypes, 
    currentUser, 
    setCurrentUser, 
    resetToDefault,
    auditLogs 
  } = useStore();

  const [horasAlerta, setHorasAlerta] = useState(settings.horas_alerta_atencao);
  const [autoLink, setAutoLink] = useState(settings.auto_vincular_cronograma);
  const [saveFeedback, setSaveFeedback] = useState(false);

  const handleSaveSettings = () => {
    updateSettings({
      horas_alerta_atencao: Number(horasAlerta) || 24,
      auto_vincular_cronograma: autoLink,
    });
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 3000);
  };

  const handleResetData = () => {
    if (confirm('Tem certeza que deseja restaurar o banco de dados para a carga inicial com 631 pedidos e cronogramas padrão? Todas as alterações manuais serão resetadas.')) {
      resetToDefault();
      alert('Banco de dados restaurado com sucesso para a base inicial!');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Configurações do Sistema
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>Parâmetros de SLA, mapeamento de status e controle de acesso</span>
          </div>
        </div>

        {saveFeedback && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Configurações salvas!
          </span>
        )}
      </div>

      {/* Section 1: SLA & Prazos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Controle de Prazos e Alertas (SLA)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Antecedência para Alerta de "Atenção" (em horas):
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={horasAlerta}
              onChange={(e) => setHorasAlerta(parseInt(e.target.value, 10) || 24)}
              className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Pedidos a menos de {horasAlerta} horas ({Math.round(horasAlerta / 24)} dias) do limite do cronograma são marcados como <strong>Atenção</strong>.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Vinculação Automática de Cronograma:
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={autoLink}
                onChange={(e) => setAutoLink(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-xs text-slate-800 font-medium">
                Vincular automaticamente cronogramas vigentes por Unidade + Programa + Tipo ao importar ou cadastrar pedidos
              </span>
            </label>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            Salvar Parâmetros
          </button>
        </div>
      </div>

      {/* Section 2: Perfis de Segurança & Controle de Acesso */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Shield className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Perfis de Acesso & Segurança (RBAC)
          </h3>
        </div>

        <p className="text-xs text-slate-600">
          O sistema opera com 4 níveis de controle de acesso hierárquico:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              role: 'ADMIN',
              title: 'Administrador Geral',
              desc: 'Controle irrestrito: importação, configurações, exclusões e cadastros.',
            },
            {
              role: 'MANAGER',
              title: 'Gestor Logístico',
              desc: 'Gerenciamento de cronogramas, relatórios executivos e auditoria.',
            },
            {
              role: 'OPERATOR',
              title: 'Operador de Linha',
              desc: 'Acompanhamento e avanço dos status operacionais dos pedidos.',
            },
            {
              role: 'VIEWER',
              title: 'Visualizador / Auditor',
              desc: 'Apenas consulta pública e relatórios, sem permissão de alteração.',
            },
          ].map((r) => (
            <div
              key={r.role}
              onClick={() => setCurrentUser({
                ...currentUser,
                role: r.role as UserRole,
                cargo: r.title,
              })}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                currentUser.role === r.role
                  ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-800">{r.role}</span>
                {currentUser.role === r.role && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                    Perfil Ativo
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">{r.title}</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Banco de Dados & Reset */}
      <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-xs space-y-3 bg-rose-50/10">
        <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold text-rose-900">
            Zona de Manutenção & Carga Inicial
          </h3>
        </div>

        <p className="text-xs text-slate-600">
          Se desejar retornar o sistema ao estado original com os <strong>631 pedidos de teste</strong>, 45 unidades de Alagoas e cronogramas predefinidos, clique no botão abaixo.
        </p>

        <button
          onClick={handleResetData}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>Restaurar Base Inicial (631 Pedidos)</span>
        </button>
      </div>
    </div>
  );
};
