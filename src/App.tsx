/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrdersView } from './components/orders/OrdersView';
import { ScheduleView } from './components/schedules/ScheduleView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ImportView } from './components/import/ImportView';
import { OrderDetailModal } from './components/orders/OrderDetailModal';
import { NewOrderModal } from './components/orders/NewOrderModal';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { Order } from './types';
import { useStore } from './hooks/useStore';
import { 
  ClipboardList, 
  Calendar, 
  BarChart3, 
  Upload, 
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
  const [activeTab, setActiveTab] = useState<'pedidos' | 'cronograma' | 'dashboard' | 'importar'>('pedidos');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [ordersFilterPreset, setOrdersFilterPreset] = useState<{ status?: string; tipo?: string; unidade?: string } | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const { orders, reloadStrictFromBackend, dbStatus } = useStore();

  const handleReloadFromBackend = async () => {
    setIsSyncing(true);
    try {
      const res = await reloadStrictFromBackend();
      if (res.success) {
        addToast('success', 'Backend Sincronizado', `${res.count} pedidos reais carregados estritamente do banco de dados.`);
      } else {
        addToast('error', 'Falha ao sincronizar', res.message || 'Verifique a conexão com o Supabase.');
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
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  const urgentCount = orders.filter(o => o.tipo === 'Emergencial' && o.status_operacional !== 'Entregue').length;

  const handleNavigateFromDashboard = (preset?: { status?: string; tipo?: string; unidade?: string }) => {
    setOrdersFilterPreset(preset);
    setActiveTab('pedidos');
  };

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans antialiased text-slate-800">
      {/* Sleek, Rounded Top Header */}
      <header className="sticky top-2 z-30 px-3 sm:px-6 max-w-6xl w-full mx-auto transition-all">
        <div className="bg-white/85 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-sm px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setActiveTab('pedidos')}
              className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              SES
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-900 text-sm tracking-tight">
                Gestão de Pedidos
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Abastecimento Hospitalar
              </span>
            </div>
          </div>

          {/* Minimalist Tab Navigation - Rounded Pill Switcher */}
          <nav className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200/60 shadow-inner">
            {[
              { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, badge: orders.length },
              { id: 'cronograma', label: 'Cronograma', icon: Calendar, badge: null },
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-white text-blue-900 font-bold shadow-xs scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 bg-slate-200/70'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReloadFromBackend}
              disabled={isSyncing}
              title="Sincronizar e carregar dados diretamente do Supabase"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Supabase</span>
              <span className="font-mono font-bold text-[11px] bg-emerald-200/60 px-1.5 py-0.2 rounded-full">
                {orders.length}
              </span>
              <RefreshCw className={`w-3 h-3 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {urgentCount > 0 && (
              <button
                onClick={() => {
                  setOrdersFilterPreset({ tipo: 'Emergencial' });
                  setActiveTab('pedidos');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50/90 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all hover:-translate-y-0.5 active:scale-95 shadow-2xs cursor-pointer"
                title="Ver pedidos emergenciais ativos"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>{urgentCount} Urgentes</span>
              </button>
            )}

            <button
              onClick={() => setIsNewOrderOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/20 active:scale-95 rounded-full shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Pedido</span>
            </button>
          </div>
        </div>

        {/* Mobile Submenu - Rounded Full Pills */}
        <div className="flex md:hidden mt-2 p-1.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-xs gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'pedidos', label: `Pedidos (${orders.length})` },
            { id: 'cronograma', label: 'Cronograma' },
            { id: 'dashboard', label: 'Painel Geral' },
            { id: 'importar', label: 'Importar' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-5">
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
          <span>SESAU Alagoas · Gestão Integrada de Abastecimento · Banco de Dados Conectado</span>
          <button
            onClick={handleReloadFromBackend}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sincronizar com Backend ({orders.length} pedidos no Supabase)</span>
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
