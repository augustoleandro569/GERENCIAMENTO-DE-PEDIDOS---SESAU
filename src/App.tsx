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
  Plus, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  Zap,
  Database,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'cronograma' | 'unidades' | 'dashboard' | 'importar'>('pedidos');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [ordersFilterPreset, setOrdersFilterPreset] = useState<{ status?: string; tipo?: string; unidade?: string } | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const { orders, units, reloadStrictFromBackend, dbStatus, currentUser } = useStore();

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
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
    };
  }, []);

  const urgentCount = orders.filter(o => o.tipo === 'Emergencial' && o.status_operacional !== 'Entregue').length;

  const handleNavigateFromDashboard = (preset?: { status?: string; tipo?: string; unidade?: string }) => {
    setOrdersFilterPreset(preset);
    setActiveTab('pedidos');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Header - Edge-to-edge container aligned with main content */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
          {/* Official SESAU Vector Logo & Wordmark */}
          <SesauLogo 
            size="md"
            onClick={() => {
              setActiveTab('pedidos');
              setOrdersFilterPreset(undefined);
            }}
          />

          {/* Clean Sharp Tab Navigation (Desktop) */}
          <nav className="hidden lg:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            {[
              { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, badge: orders.length },
              { id: 'cronograma', label: 'Cronograma', icon: Calendar, badge: null },
              { id: 'unidades', label: 'Unidades', icon: Building2, badge: units.length },
              { id: 'dashboard', label: 'Painel Geral', icon: BarChart3, badge: null },
              { id: 'importar', label: 'Importar Planilha', icon: Upload, badge: null },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as typeof activeTab);
                    if (tab.id === 'pedidos') setOrdersFilterPreset(undefined);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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

          {/* Actions & Primary CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {urgentCount > 0 && (
              <button
                onClick={() => {
                  setOrdersFilterPreset({ tipo: 'Emergencial' });
                  setActiveTab('pedidos');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-all hover:-translate-y-0.5 active:scale-95 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                title="Ver pedidos emergenciais ativos"
              >
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0" />
                <span>{urgentCount} Urgentes</span>
              </button>
            )}

            {/* Subtle Divider */}
            <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* Primary Action Button: Novo Pedido */}
            <button
              onClick={() => setIsNewOrderOpen(true)}
              disabled={currentUser.role === 'VIEWER'}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer whitespace-nowrap shrink-0 border border-blue-700 disabled:opacity-50 disabled:pointer-events-none"
              title="Registrar Novo Pedido Manual (Falta / Emergencial / Extraordinário)"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span>Novo Pedido</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Submenu - Clean Strip */}
        <div className="flex lg:hidden border-t border-slate-100 bg-slate-50/90 px-4 py-2 gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'pedidos', label: `Pedidos (${orders.length})` },
            { id: 'cronograma', label: 'Cronograma' },
            { id: 'unidades', label: `Unidades (${units.length})` },
            { id: 'dashboard', label: 'Painel Geral' },
            { id: 'importar', label: 'Importar' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'pedidos' && (
          <OrdersView
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
            onOpenImport={() => setActiveTab('importar')}
            initialFilter={ordersFilterPreset}
          />
        )}

        {activeTab === 'cronograma' && (
          <ScheduleView onSelectOrder={(ord) => setSelectedOrder(ord)} />
        )}

        {activeTab === 'unidades' && (
          <UnitsView />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectOrder={(ord) => setSelectedOrder(ord)}
            onNavigateToOrders={handleNavigateFromDashboard}
          />
        )}

        {activeTab === 'importar' && (
          <ImportView />
        )}
      </main>

      {/* Slender Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-3 px-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px]">
          <span>SESAU Alagoas · Secretaria de Estado da Saúde · Gestão Integrada de Abastecimento</span>
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
