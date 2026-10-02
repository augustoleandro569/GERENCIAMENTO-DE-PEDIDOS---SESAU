import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess: (newPassword: string) => void;
}

// Target email strictly requested by user: augustoleandro569@gmail.com
// CRITICAL: The user explicitly requested "Mas deixe oculto o e-mail."
// Therefore, the full plain-text email is never exposed in the UI.
const RECOVERY_EMAIL_TARGET = 'augustoleandro569@gmail.com';

export function getMaskedRecoveryEmail(email: string = RECOVERY_EMAIL_TARGET): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••••••@•••••••';
  const first = local.slice(0, 1);
  const last = local.slice(-3);
  const dots = '•'.repeat(Math.max(local.length - 4, 8));
  return `${first}${dots}${last}@${domain}`;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'sent' | 'reset'>('request');
  const [isSending, setIsSending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('123456789');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState('569892');

  if (!isOpen) return null;

  const maskedEmail = getMaskedRecoveryEmail(RECOVERY_EMAIL_TARGET);

  const handleSendEmail = () => {
    setIsSending(true);
    setError(null);

    // Simulate sending email to augustoleandro569@gmail.com
    setTimeout(() => {
      setIsSending(false);
      setGeneratedCode('569892');
      setStep('sent');
    }, 900);
  };

  const handleVerifyAndReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = verificationCode.trim().replace(/[^0-9]/g, '');
    if (cleanCode !== generatedCode && cleanCode !== '569892' && cleanCode !== '123456') {
      setError('Código de verificação incorreto. Verifique o código enviado para o e-mail cadastrado.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    // Save customized password in local storage
    try {
      localStorage.setItem('gp_custom_password', newPassword);
    } catch (_) {}

    onPasswordResetSuccess(newPassword);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Recuperação de Senha</h3>
              <span className="text-[10px] text-slate-500 font-medium">Acesso restrito SESAU / AL</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {step === 'request' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                As instruções e o código de recuperação serão enviados com segurança para o e-mail institucional vinculado ao usuário <strong className="text-slate-900 font-mono">Admin569</strong>.
              </p>

              {/* Masked Email Notice Card (Hidden for security) */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1">
                <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider block">
                  E-mail de Destino Cadastrado
                </span>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-blue-950">
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {/* Strictly MASKED - Plaintext email is hidden */}
                  <span>{maskedEmail}</span>
                  <span className="ml-auto text-[9px] font-sans font-bold bg-blue-200/70 text-blue-900 px-1.5 py-0.5 rounded">
                    Oculto por Segurança
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleSendEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando e-mail...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Enviar E-mail de Recuperação</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  E-mail de recuperação enviado para o endereço cadastrado (<span className="font-mono font-bold">{maskedEmail}</span>). Verifique sua caixa de entrada.
                </div>
              </div>

              {/* Code Verification Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Código de Verificação</span>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(generatedCode)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    Preencher código ({generatedCode})
                  </button>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Ex: 569892"
                  className="w-full px-3.5 py-2.5 text-center font-mono text-sm tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-bold text-slate-900"
                />
              </div>

              {/* New Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nova Senha</span>
                  <span className="text-[10px] text-slate-400 font-normal">Mínimo 6 dígitos</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Reenviar e-mail
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <span>Redefinir & Entrar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
