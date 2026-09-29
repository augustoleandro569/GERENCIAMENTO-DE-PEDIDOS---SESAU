import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CalendarClock, 
  FileSpreadsheet, 
  Building2, 
  BarChart3, 
  Settings,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../../hooks/useStore';

export type ActiveModule = 
  | 'dashboard'
  | 'pedidos'
  | 'cronograma'
  | 'importacao'
  | 'unidades'
  | 'relatorios'
  | 'configuracoes';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  const { orders, schedules, units } = useStore();

  const totalOrders = orders.length;
  const delayedOrUrgent = orders.filter(
    o => o.tipo === 'Emergencial' || o.prioridade === 'Urgente'
  ).length;

  const navItems = [
    {
      id: 'dashboard' as ActiveModule,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'pedidos' as ActiveModule,
      label: 'Pedidos',
      icon: ClipboardList,
      badge: totalOrders,
    },
    {
      id: 'cronograma' as ActiveModule,
      label: 'Cronograma',
      icon: CalendarClock,
      badge: schedules.length,
    },
    {
      id: 'importacao' as ActiveModule,
      label: 'Importações',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'unidades' as ActiveModule,
      label: 'Unidades',
      icon: Building2,
      badge: units.length,
    },
    {
      id: 'relatorios' as ActiveModule,
      label: 'Relatórios',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'configuracoes' as ActiveModule,
      label: 'Configurações',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center text-white shadow-md border border-blue-400/20 shrink-0">
            <svg viewBox="0 0 36 36" fill="none" className="w-4 h-4 text-white">
              <path d="M15 7C15 6.44772 15.4477 6 16 6H20C20.5523 6 21 6.44772 21 7V13H27C27.5523 13 28 13.4477 28 14V18C28 18.5523 27.5523 19 27 19H21V25C21 25.5523 20.5523 26 20 26H16C15.4477 26 15 25.5523 15 25V19H9C8.44772 19 8 18.5523 8 18V14C8 13.4477 8.44772 13 9 13H15V7Z" fill="white" />
              <circle cx="18" cy="16" r="3.2" fill="#10B981" />
              <path d="M16.5 16L17.5 17.2L19.5 14.8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>SESAU ALAGOAS</span>
              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800">OFICIAL</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Logística & Suprimentos
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Módulos Operacionais
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-blue-700/80 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Ops Indicator Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Status Geral</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operante
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Alertas / Emergência</span>
            <span className="text-rose-400 font-mono font-bold flex items-center gap-1">
              {delayedOrUrgent > 0 && <AlertCircle className="w-3 h-3 text-rose-400" />}
              {delayedOrUrgent}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
