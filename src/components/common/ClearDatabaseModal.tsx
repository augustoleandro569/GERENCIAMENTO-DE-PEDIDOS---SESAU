import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Database,
  Server,
  X
} from 'lucide-react';

interface ClearDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ClearDatabaseModal: React.FC<ClearDatabaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { orders, units, dbStatus, clearDatabaseWithPassword, currentUser } = useStore();

  const [mode, setMode] = useState<'wipe_orders' | 'reseed_clean' | 'wipe_all'>('wipe_orders');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setError(null);

    // Strict security lock verification
    if (!password) {
      setError('Por favor, informe a senha de segurança para desbloquear a operação.');
      return;
    }

    if (password !== 'Sai453@12') {
      setError('Senha de segurança incorreta! Acesso negado. A chave informada não confere com a credencial autorizada.');
      return;
    }

    if (!confirmedCheckbox) {
      setError('Você deve marcar a caixa de confirmação de ciência antes de continuar.');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await clearDatabaseWithPassword(password, mode, currentUser?.nome);
      if (res.success) {
        setSuccessResult(res.message);
        if (onSuccess) {
          onSuccess(res.message);
        }
      } else {
        setError(res.message || 'Falha ao executar a limpeza do banco de dados.');
      }
    } catch (err: unknown) {
      console.error('Error clearing database:', err);
      setError(err instanceof Error ? err.message : 'Erro ao limpar banco de dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setPassword('');
    setError(null);
    setSuccessResult(null);
    setConfirmedCheckbox(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Limpeza do Banco de Dados
                </h3>
                <span className="text-[10px] font-mono uppercase font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Trava de Segurança
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Operação administrativa crítica protegida por senha de segurança.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Operação Concluída com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                {successResult}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Main Form View */
          <>
            {/* Status Info Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Pedidos no Banco:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{orders.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Unidades de Saúde:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{units.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Provedor Ativo:</span>
                <span className="font-mono font-bold text-blue-700 text-sm uppercase">
                  {dbStatus.supabaseConnected ? 'Supabase' : dbStatus.firestoreConnected ? 'Firestore' : 'Local'}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {/* Option Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Selecione a Ação de Limpeza:
              </label>

              {/* Option 1: Wipe Orders (Recommended) */}
              <div
                onClick={() => setMode('wipe_orders')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === 'wipe_orders'
                    ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="clear_mode"
                    checked={mode === 'wipe_orders'}
                    onChange={() => setMode('wipe_orders')}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Zerar Banco de Dados (Excluir Todos os Pedidos)</span>
                      </div>
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Exclui todos os <strong>{orders.length} pedidos</strong>, histórico de movimentações e importações do Supabase, Firestore e armazenamento local. Deixa o sistema zerado e limpo para carregar uma nova planilha sem registros antigos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Reseed Clean */}
              <div
                onClick={() => setMode('reseed_clean')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === 'reseed_clean'
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="clear_mode"
                    checked={mode === 'reseed_clean'}
                    onChange={() => setMode('reseed_clean')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Restaurar Base Inicial Oficial SESAU</span>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Base Padrão
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Limpa os pedidos corrompidos e restabelece a base oficial de 631 pedidos e 67 unidades de saúde homologadas da rede estadual.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 3: Wipe All */}
              <div
                onClick={() => setMode('wipe_all')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === 'wipe_all'
                    ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="clear_mode"
                    checked={mode === 'wipe_all'}
                    onChange={() => setMode('wipe_all')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Limpeza Total / Reset de Fábrica</span>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Reset Total
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Apaga pedidos, histórico de importações, logs de auditoria e redefine os cronogramas ao estado original.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trava de Segurança - Senha de Segurança */}
            <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Senha de Segurança Obrigatória:</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Trava de proteção ativa
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Insira a senha de segurança..."
                  className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 font-bold placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-slate-600">
                Esta ação apagará dados permanentemente. Apenas usuários autorizados com a senha de segurança configurada podem prosseguir.
              </p>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmedCheckbox}
                onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 font-medium">
                Confirmo que tenho autorização e estou ciente de que a limpeza excluirá os registros selecionados do banco de dados (Supabase, Firestore e navegador).
              </span>
            </label>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecute}
                disabled={isProcessing || !password || !confirmedCheckbox}
                className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Limpando Banco de Dados...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Destravar e Limpar Banco</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
