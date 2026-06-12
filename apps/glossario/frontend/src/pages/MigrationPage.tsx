import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { redirectToLogin } from '@artificio/auth/client';
import api from '../services/api';
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
      await refresh();
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Não foi possível concluir a migração. Tente novamente.');
      setStep('error');
    }
  }, [refresh]);

  // Ao montar / voltar do Google: com token + sessão Google → conclui; com token
  // sem sessão → pede conexão Google; sem token → começa pelo formulário.
  useEffect(() => {
    if (loading) return;
    const hasToken = !!sessionStorage.getItem(TOKEN_KEY);
    if (!hasToken) {
      setStep('form');
      return;
    }
    if (user) {
      void doClaim();
    } else {
      setStep('connect');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

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
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Não foi possível validar suas credenciais legadas.');
    } finally {
      setSubmitting(false);
    }
  };

  const connectGoogle = () => redirectToLogin(`${window.location.origin}/migrar`);

  return (
    <div className="flex items-center justify-center p-8 bg-cinza-fundo">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-azul-escuro p-8 text-center border-b-4 border-laranja">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Migrar Conta Antiga</h2>
          <p className="text-blue-200 text-sm mt-2">Sem perder seus termos, votos e comentários</p>
        </div>

        <div className="p-8">
          {error && step !== 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium mb-6">
              {error}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <KeyRound size={20} className="text-laranja shrink-0 mt-0.5" />
                <p>Confirme a senha que você usava no glossário antigo. Isso só prova que a conta é sua — não cria login.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">E-mail do cadastro antigo</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Senha antiga</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {submitting ? 'Validando...' : 'Validar identidade'}
              </button>

              <p className="text-center text-gray-500 text-sm">
                Já usa Google?{' '}
                <Link to="/login" className="text-laranja font-bold hover:underline">
                  Entrar normalmente
                </Link>
              </p>
            </form>
          )}

          {step === 'connect' && (
            <div className="space-y-6 text-center">
              <CheckCircle2 size={48} className="text-green-500 mx-auto" />
              <div>
                <p className="font-bold text-azul-escuro text-lg mb-1">Identidade confirmada</p>
                <p className="text-gray-600 text-sm">
                  Agora conecte sua conta Google. Ela passará a ser o login desta conta e herdará tudo que você adicionou.
                </p>
              </div>
              <button
                type="button"
                onClick={connectGoogle}
                className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                Conectar conta Google
              </button>
            </div>
          )}

          {step === 'claiming' && (
            <div className="flex flex-col items-center justify-center py-8 text-azul-escuro">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p className="font-semibold">Vinculando sua conta e herdando seu conteúdo...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <CheckCircle2 size={48} className="text-green-500 mx-auto" />
              <div>
                <p className="font-bold text-azul-escuro text-lg mb-1">Migração concluída!</p>
                <p className="text-gray-600 text-sm">
                  Sua conta Google agora controla os termos, votos e comentários que você já tinha. A partir de agora, entre só com o Google.
                </p>
              </div>
              <Link
                to="/"
                className="inline-block w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest"
              >
                Ir para o glossário
              </Link>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-6 text-center">
              <AlertTriangle size={48} className="text-red-500 mx-auto" />
              <div>
                <p className="font-bold text-azul-escuro text-lg mb-1">Não deu certo</p>
                <p className="text-gray-600 text-sm">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(TOKEN_KEY);
                  setError('');
                  setStep('form');
                }}
                className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest"
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
