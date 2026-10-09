/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrdersView } from './components/orders/OrdersView';
import { ScheduleView } from './components/schedules/ScheduleView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ImportView } from './components/import/ImportView';
import { UnitsView } from './components/units/UnitsView';
import { LoginView } from './components/auth/LoginView';
import { OrderDetailModal } from './components/orders/OrderDetailModal';
import { NewOrderModal } from './components/orders/NewOrderModal';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { Order } from './types';
import { useStore } from './hooks/useStore';
import { SesauLogo } from './components/common/Logo';
import { 
  ClipboardList, 
  Calendar, 
  BarChart3, 
  Upload, 
  Building2,
  FileText,
  Plus, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  Zap,
  Database,
  RefreshCw,
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
  Lock,
  UserCheck,
  ChevronDown,
  User
} from 'lucide-react';

type ActiveTab = 'login' | 'pedidos' | 'cronograma' | 'unidades' | 'dashboard' | 'importar';

export default function App() {
  // A primeira página ao entrar no sistema deve ser a de login
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('login');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [ordersFilterPreset, setOrdersFilterPreset] = useState<{ status?: string; tipo?: string; unidade?: string } | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const { orders, units, reloadStrictFromBackend, dbStatus, currentUser, setCurrentUser } = useStore();

  const handleLoginSuccess = (user: { username: string; role: 'ADMIN' }) => {
    setIsAuthenticated(true);
    try {
      localStorage.setItem('sesau_auth_session', JSON.stringify({
        user: 'Admin569',
        timestamp: new Date().toISOString(),
      }));
    } catch (_) {}

    setCurrentUser({
      id: 'usr-admin569',
      nome: 'Admin569',
      email: 'admin569@sesau.al.gov.br',
      cargo: 'Administrador de Abastecimento Hospitalar',
      role: 'ADMIN',
      unidade_padrao: 'SESAU Central',
    });

    setActiveTab('pedidos');
    addToast('success', 'Acesso Autorizado', 'Bem-vindo ao SIGAH SESAU Alagoas, Admin569!');

    // Pull latest data from cloud backend immediately upon login to ensure cross-device consistency
    reloadStrictFromBackend().catch((err) => console.warn('Post-login sync note:', err));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('sesau_auth_session');
    } catch (_) {}
    setActiveTab('login');
    addToast('info', 'Sessão Encerrada', 'Você saiu do sistema com segurança.');
  };

  const handleTabChange = (tabId: ActiveTab) => {
    if (!isAuthenticated && tabId !== 'login') {
      addToast('info', 'Acesso Restrito', 'Efetue login com o usuário Admin569 para acessar esta seção.');
      setActiveTab('login');
      return;
    }
    setActiveTab(tabId);
    if (tabId === 'pedidos') {
      setOrdersFilterPreset(undefined);
    }
  };

  const handleReloadFromBackend = async () => {
    setIsSyncing(true);
    try {
      const res = await reloadStrictFromBackend();
      if (res.success) {
        addToast('success', 'Dados Atualizados', `${res.count} pedidos sincronizados com sucesso.`);
      } else {
        addToast('error', 'Falha ao atualizar', res.message || 'Verifique a conexão.');
      }
    } catch (err: any) {
      addToast('error', 'Erro', err.message || 'Falha ao recarregar dados.');
    } finally {
      setIsSyncing(false);
    }
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `t-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  React.useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        addToast(detail.type, detail.title, detail.message);
      }
    };

    window.addEventListener('app-toast', handleToastEvent);

    // Auto-refresh from backend when user focuses tab/window to see changes made on other computers
    const handleWindowFocus = () => {
      if (isAuthenticated) {
        reloadStrictFromBackend().catch(() => {});
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    // Periodic sync check every 45s while active
    const syncTimer = setInterval(() => {
      if (isAuthenticated && document.visibilityState === 'visible') {
        reloadStrictFromBackend().catch(() => {});
      }
    }, 45000);

    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(syncTimer);
    };
  }, [isAuthenticated]);

  const handleNavigateFromDashboard = (preset?: { status?: string; tipo?: string; unidade?: string }) => {
    setOrdersFilterPreset(preset);
    setActiveTab('pedidos');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Header - Edge-to-edge container aligned with main content (z-40 to overlay page cards) */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
          {/* Official SESAU Vector Logo & Wordmark */}
          <SesauLogo 
            size="md"
            onClick={() => {
              handleTabChange(isAuthenticated ? 'pedidos' : 'login');
            }}
          />

          {/* Clean Sharp Tab Navigation (Desktop) - Hidden on login view */}
          {isAuthenticated && activeTab !== 'login' && (
            <nav className="hidden lg:flex items-center justify-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 mx-auto">
              {[
                { id: 'pedidos' as const, label: 'Pedidos', icon: ClipboardList, badge: orders.length },
                { id: 'cronograma' as const, label: 'Cronograma', icon: Calendar, badge: null },
                { id: 'unidades' as const, label: 'Unidades', icon: Building2, badge: units.length },
                { id: 'dashboard' as const, label: 'Painel Geral', icon: BarChart3, badge: null },
                { id: 'importar' as const, label: 'Importar Planilha', icon: Upload, badge: null },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
                      isActive
                        ? 'bg-white text-blue-900 border border-slate-200/80 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== null && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-100 text-blue-800' : 'text-slate-700 bg-slate-200'}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Actions & Primary CTA */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5 shrink-0">
            {!isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Acesso Restrito</span>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('login');
                    const userInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                    userInput?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
              </div>
            ) : (
              <>
                {/* ÚNICO BOTÃO CENTRALIZADO: Sessão, Perfil e Sair (Sobrepondo com z-50) */}
                <div className="relative z-50">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 border border-slate-200/90 text-xs cursor-pointer transition-all shadow-2xs shrink-0 select-none text-center"
                    title="Sessão Admin569 · Clique para gerenciar sessão ou sair"
                  >
                    <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-slate-900 font-mono text-xs leading-none">Admin569</span>
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-1.5 py-0.5 rounded-full leading-none inline-flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      ADMIN
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isUserMenuOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>

                  {/* Dropdown Menu com Sessão e Sair - Sobrepondo com shadow-2xl e z-50 */}
                  {isUserMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsUserMenuOpen(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-4 py-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-xs font-mono">Admin569</span>
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">ADMIN</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">Sessão Administrativa SESAU</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => {
                              setActiveTab('login');
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <User className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Ver Dados da Sessão</span>
                          </button>

                          <div className="h-px bg-slate-100 my-1" />

                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Sair (Encerrar Sessão)</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile / Tablet Submenu - Hidden on login view */}
        {isAuthenticated && activeTab !== 'login' && (
          <div className="flex lg:hidden border-t border-slate-100 bg-slate-50/90 px-4 py-2 gap-1.5 overflow-x-auto text-xs items-center">
            {[
              { id: 'pedidos' as const, label: `Pedidos (${orders.length})` },
              { id: 'cronograma' as const, label: 'Cronograma' },
              { id: 'unidades' as const, label: `Unidades (${units.length})` },
              { id: 'dashboard' as const, label: 'Painel Geral' },
              { id: 'importar' as const, label: 'Importar' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {item.label}
              </button>
            ))}

            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 ml-auto shrink-0"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'login' && (
          <LoginView
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onNavigateToOrders={() => setActiveTab('pedidos')}
          />
        )}

        {isAuthenticated && activeTab === 'pedidos' && (
          <OrdersView
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
            onOpenImport={() => setActiveTab('importar')}
            initialFilter={ordersFilterPreset}
          />
        )}

        {isAuthenticated && activeTab === 'cronograma' && (
          <ScheduleView onSelectOrder={(ord) => setSelectedOrder(ord)} />
        )}

        {isAuthenticated && activeTab === 'unidades' && (
          <UnitsView />
        )}

        {isAuthenticated && activeTab === 'dashboard' && (
          <DashboardView
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onNavigateToOrders={handleNavigateFromDashboard}
          />
        )}

        {isAuthenticated && activeTab === 'importar' && (
          <ImportView />
        )}
      </main>

      {/* Slender Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-3 px-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px]">
          <span>Linus Soluções · SESAU Alagoas · Gestão Integrada de Abastecimento Hospitalar</span>
          <button
            onClick={handleReloadFromBackend}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Atualizar Pedidos ({orders.length})</span>
          </button>
        </div>
      </footer>

      {/* Modais */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
      />
    </div>
  );
}
