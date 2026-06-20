import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { redirectToLogin } from '@artificio/auth/client';
import api from '../services/api';
import { apiErrorMessage } from '../lib/api-error';
import { KeyRound, Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

const TOKEN_KEY = 'glossario_migration_token';

type Step = 'form' | 'connect' | 'claiming' | 'done' | 'error';

/**
 * Fluxo de reivindicação (spec 015) — para quem se cadastrou no glossário antigo
 * com email NÃO-Google:
 *   1) valida identidade legada (email + senha antiga) → migration_token (10min)
 *   2) conecta a conta Google (OAuth via accounts.)
 *   3) vincula e herda termos/votos/comentários/notificações
 * A senha legada NÃO cria sessão; só prova posse da conta antiga.
 */
const MigrationPage: React.FC = () => {
  const { user, loading, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [completed, setCompleted] = useState(false);

  const doClaim = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStep('form');
      return;
    }
    setStep('claiming');
    setError('');
    try {
      await api.post('/migration/claim', { migration_token: token });
      sessionStorage.removeItem(TOKEN_KEY);
      setCompleted(true);
      await refresh();
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível concluir a migração. Tente novamente.'));
      setStep('error');
    }
  }, [refresh]);

  // Ao montar / voltar do Google: com token + sessão Google → conclui; com token
  // sem sessão → pede conexão Google; sem token → começa pelo formulário.
  useEffect(() => {
    if (loading || completed) return;
    let active = true;
    // IIFE async: defere o setState para fora do caminho síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      const hasToken = !!sessionStorage.getItem(TOKEN_KEY);
      if (!hasToken) {
        setStep('form');
        return;
      }
      if (user) {
        await doClaim();
      } else {
        setStep('connect');
      }
    })();
    return () => { active = false; };
  }, [loading, user, completed, doClaim]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/migration/verify', { email, password });
      sessionStorage.setItem(TOKEN_KEY, data.migration_token);
      if (user) {
        await doClaim();
      } else {
        setStep('connect');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível validar suas credenciais legadas.'));
    } finally {
      setSubmitting(false);
    }
  };

  const connectGoogle = () => redirectToLogin(`${window.location.origin}/migrar`);

  return (
    <div className="flex items-center justify-center p-8 bg-[var(--surface-subtle)]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden border border-[var(--line)]">
        <div className="bg-[var(--navy-block-bg)] p-8 text-center border-b-4 border-[var(--artificio-brand)]">
          <h2 className="text-2xl font-black text-[var(--navy-block-fg)] italic uppercase tracking-tighter">Migrar Conta Antiga</h2>
          <p className="text-[var(--state-info-fg)] text-sm mt-2">Sem perder seus termos, votos e comentários</p>
        </div>

        <div className="p-8">
          {error && step !== 'error' && (
            <div className="bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)] text-[var(--state-danger-fg)] px-4 py-3 rounded-lg text-sm font-medium mb-6">
              {error}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex items-start gap-3 text-sm text-[var(--fg-muted)]">
                <KeyRound size={20} className="text-[var(--artificio-brand)] shrink-0 mt-0.5" />
                <p>Confirme a senha que você usava no glossário antigo. Isso só prova que a conta é sua — não cria login.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--fg)] mb-1 uppercase tracking-widest">E-mail do cadastro antigo</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent outline-none transition-all placeholder-[var(--fg-muted)]"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--fg)] mb-1 uppercase tracking-widest">Senha antiga</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent outline-none transition-all placeholder-[var(--fg-muted)]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {submitting ? 'Validando...' : 'Validar identidade'}
              </button>

              <p className="text-center text-[var(--fg-muted)] text-sm">
                Já usa Google?{' '}
                <Link to="/login" className="text-[var(--artificio-brand)] font-bold hover:underline">
                  Entrar normalmente
                </Link>
              </p>
            </form>
          )}

          {step === 'connect' && (
            <div className="space-y-6 text-center">
              <CheckCircle2 size={48} className="text-[var(--state-success-fg)] mx-auto" />
              <div>
                <p className="font-bold text-[var(--fg)] text-lg mb-1">Identidade confirmada</p>
                <p className="text-[var(--fg-muted)] text-sm">
                  Agora conecte sua conta Google. Ela passará a ser o login desta conta e herdará tudo que você adicionou.
                </p>
              </div>
              <button
                type="button"
                onClick={connectGoogle}
                className="w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                Conectar conta Google
              </button>
            </div>
          )}

          {step === 'claiming' && (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--fg)]">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p className="font-semibold">Vinculando sua conta e herdando seu conteúdo...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <CheckCircle2 size={48} className="text-[var(--state-success-fg)] mx-auto" />
              <div>
                <p className="font-bold text-[var(--fg)] text-lg mb-1">Migração concluída!</p>
                <p className="text-[var(--fg-muted)] text-sm">
                  Sua conta Google agora controla os termos, votos e comentários que você já tinha. A partir de agora, entre só com o Google.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest"
              >
                Ir para o glossário
              </Link>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-6 text-center">
              <AlertTriangle size={48} className="text-[var(--state-danger-fg)] mx-auto" />
              <div>
                <p className="font-bold text-[var(--fg)] text-lg mb-1">Não deu certo</p>
                <p className="text-[var(--fg-muted)] text-sm">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(TOKEN_KEY);
                  setCompleted(false);
                  setError('');
                  setStep('form');
                }}
                className="w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest"
              >
                Tentar de novo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationPage;
