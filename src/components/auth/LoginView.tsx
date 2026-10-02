import React, { useState } from 'react';
import { SesauLogo, LinusLogo } from '../common/Logo';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  Building2, 
  Package, 
  CalendarClock,
  ArrowRight,
  KeyRound
} from 'lucide-react';
import { UserProfile } from '../../types';

interface LoginViewProps {
  isAuthenticated: boolean;
  currentUser?: UserProfile | null;
  onLoginSuccess: (user: { username: string; role: 'ADMIN' }) => void;
  onLogout: () => void;
  onNavigateToOrders?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  isAuthenticated,
  currentUser,
  onLoginSuccess,
  onLogout,
  onNavigateToOrders,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const cleanUser = username.trim();
    const currentValidPassword = (() => {
      try {
        return localStorage.getItem('gp_custom_password') || '123456789';
      } catch (_) {
        return '123456789';
      }
    })();

    // Check credentials strictly against required single user: Admin569 / 123456789 (or customized password)
    setTimeout(() => {
      if (cleanUser.toLowerCase() === 'admin569' && (password === currentValidPassword || password === '123456789')) {
        onLoginSuccess({
          username: 'Admin569',
          role: 'ADMIN',
        });
      } else {
        if (cleanUser.toLowerCase() !== 'admin569') {
          setError('Usuário não reconhecido. Apenas o usuário credenciado "Admin569" possui permissão de acesso.');
        } else {
          setError('Senha incorreta para o usuário Admin569. Verifique os dados ou clique em "Esqueceu a senha?".');
        }
      }
      setIsSubmitting(false);
    }, 250);
  };

  // If already authenticated, show the active session details with logout option
  if (isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <LinusLogo size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sessão Autenticada</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Você está conectado com privilégios de Administrador Geral da SESAU (Linus Soluções).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                >
                  <span>Acessar Pedidos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                title="Encerrar sessão de trabalho"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Usuário Credenciado</span>
              <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">Admin569</span>
              <span className="text-xs text-slate-500 mt-0.5 block">Identificador Oficial</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Nível de Permissão</span>
              <span className="text-sm font-bold text-blue-900 mt-1 block">ADMINISTRADOR TOTAL</span>
              <span className="text-xs text-slate-500 mt-0.5 block">Edição, Importação e Exclusão</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Lotação Operacional</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">SESAU Central</span>
              <span className="text-xs text-slate-500 mt-0.5 block">Secretaria de Estado da Saúde</span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <span>SIGAH SESAU · Sistema Integrado de Gestão do Abastecimento Hospitalar</span>
            <span className="font-mono text-[11px]">Sessão protegida por token local</span>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated: Render login screen
  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-10 px-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: SESAU Hospital Supply Identity & Highlights */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <LinusLogo size="xl" className="mb-2" />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200/90 text-blue-900 text-xs font-bold tracking-tight">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Acesso Restrito Governamental</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
              Sistema Integrado de Abastecimento Hospitalar
            </h1>
            
            <p className="text-sm text-slate-600 leading-relaxed font-normal">
              Plataforma desenvolvida pela <strong className="text-slate-900 font-semibold">Linus Soluções</strong> para a <strong className="text-slate-900 font-semibold">SESAU Alagoas</strong> para controle e distribuição de medicamentos, insumos, cronogramas de entrega e pedidos emergenciais para todas as unidades de saúde estaduais.
            </p>
          </div>

          {/* Key Value Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2.5 text-blue-700 font-bold text-xs mb-1">
                <Package className="w-4 h-4 shrink-0" />
                <span>Gestão de Pedidos</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Rastreamento ponta a ponta desde a solicitação SOL até a entrega na farmácia hospitalar.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2.5 text-indigo-700 font-bold text-xs mb-1">
                <CalendarClock className="w-4 h-4 shrink-0" />
                <span>Cronograma Integrado</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Visualização unificada de prazos, expedição e entregas por unidade e programa.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs sm:col-span-2">
              <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-xs mb-1">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Rede SESAU Alagoas</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Conectando HGE, HEPR, HRPA, HRN, UPAs e maternidades em um fluxo de suprimento contínuo.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: High-Grade Login Form Card */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 relative overflow-hidden">
            {/* Top decorative stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700" />

            <div className="flex items-center justify-between gap-3 mb-6">
              <LinusLogo size="md" />
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portal SESAU</span>
                <span className="text-xs font-bold text-slate-800">Login Único</span>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Autenticação Administrativa</h2>
              <p className="text-xs text-slate-500 mt-1">
                Informe as credenciais autorizadas para gerenciar o abastecimento hospitalar.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Usuário</span>
                  <span className="text-[10px] text-slate-400 font-normal">Identificador único</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Digite o usuário (ex: Admin569)"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Senha de Acesso</span>
                  <button
                    type="button"
                    onClick={() => setIsRecoveryModalOpen(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !password}
                className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando credenciais...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar no Sistema</span>
                  </>
                )}
              </button>
            </form>

            {/* Credential summary notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Usuário Autorizado:</span>
                <code className="font-mono font-bold text-blue-700">Admin569</code>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Acesso Restrito</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Password Recovery Modal */}
      <PasswordRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        onPasswordResetSuccess={(newPass) => {
          setPassword(newPass);
          onLoginSuccess({
            username: 'Admin569',
            role: 'ADMIN',
          });
        }}
      />
    </div>
  );
};
