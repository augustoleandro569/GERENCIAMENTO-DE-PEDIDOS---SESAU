import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { UserRole } from '../../types';
import { SesauLogo } from '../common/Logo';
import { 
  Search, 
  Bell, 
  Shield, 
  User, 
  AlertCircle, 
  CheckCircle,
  FileSpreadsheet,
  Plus
} from 'lucide-react';

interface HeaderProps {
  onOpenNewOrder: () => void;
  onOpenImport: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewOrder,
  onOpenImport,
  searchTerm,
  onSearchChange,
}) => {
  const { currentUser, setCurrentUser, orders } = useStore();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Calculate alerts
  const urgentOrders = orders.filter(o => o.tipo === 'Emergencial' && o.status_operacional !== 'Entregue');
  const awaitingApproval = orders.filter(o => o.status_operacional === 'Aguardando Aprovação');

  const handleRoleChange = (role: UserRole) => {
    setCurrentUser({
      ...currentUser,
      role,
      cargo: role === 'ADMIN' ? 'Coordenador Geral (Acesso Total)' :
             role === 'MANAGER' ? 'Gerente de Abastecimento' :
             role === 'OPERATOR' ? 'Operador de Logística' : 'Auditor (Visualizador)',
    });
    setShowRoleMenu(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
      {/* Zone 1: Breadcrumb & Title */}
      <SesauLogo size="sm" />

      {/* Zone 2: Global Search Bar */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por código (ex: SOL-2026-03074), unidade, solicitante ou CPF..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Zone 3: Quick Actions, Notifications & User */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenImport}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
          <span>Importar Planilha</span>
        </button>

        <button
          onClick={onOpenNewOrder}
          disabled={currentUser.role === 'VIEWER'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Pedido</span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Notificações Operacionais"
          >
            <Bell className="w-4 h-4" />
            {(urgentOrders.length > 0 || awaitingApproval.length > 0) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Alertas Operacionais</span>
                <span className="text-[11px] text-slate-400 font-mono">Tempo Real</span>
              </div>
              <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
                {urgentOrders.length > 0 && (
                  <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-rose-900">
                        {urgentOrders.length} Pedidos Emergenciais Ativos
                      </p>
                      <p className="text-[11px] text-rose-700">
                        Unidades aguardando despacho rápido (ex: {urgentOrders[0].unidade}).
                      </p>
                    </div>
                  </div>
                )}
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">
                      {awaitingApproval.length} Pedidos Aguardando Aprovação
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Verifique o cronograma para aprovações antes do prazo limite.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="w-full mt-1 py-1 text-center text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
              {currentUser.nome.charAt(0)}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.nome}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Shield className="w-2.5 h-2.5 text-blue-600" />
                <span className="font-mono font-medium">{currentUser.role}</span>
              </div>
            </div>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50">
              <div className="pb-2 border-b border-slate-100 mb-2">
                <p className="text-xs font-bold text-slate-900">{currentUser.nome}</p>
                <p className="text-[11px] text-slate-500">{currentUser.cargo}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{currentUser.email}</p>
              </div>

              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                Simular Perfil de Acesso:
              </div>

              <div className="space-y-1">
                {(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      currentUser.role === r
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{r}</span>
                    {currentUser.role === r && <span className="text-[10px] font-mono">Ativo</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
