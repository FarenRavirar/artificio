import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, KeyRound } from 'lucide-react';

/**
 * Entrada do glossário (spec 015). Login único = Google via accounts. (D018).
 * Quem se cadastrou no glossário antigo com email NÃO-Google entra pelo fluxo
 * de reivindicação (/migrar).
 */
const Login: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="flex items-center justify-center p-8 bg-[var(--surface-subtle)]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden border border-[var(--line)]">
        <div className="bg-[var(--navy-block-bg)] p-8 text-center border-b-4 border-[var(--artificio-brand)]">
          <h2 className="text-2xl font-black text-[var(--navy-block-fg)] italic uppercase tracking-tighter">Acessar Glossário</h2>
          <p className="text-[var(--state-info-fg)] text-sm mt-2">Entre com sua conta Google</p>
        </div>

        <div className="p-8 space-y-6">
          <button
            type="button"
            onClick={login}
            className="w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>

          <div className="border-t border-[var(--line)] pt-6">
            <div className="flex items-start gap-3 bg-[rgba(255,87,34,0.05)] border border-[rgba(255,87,34,0.20)] rounded-xl p-4">
              <KeyRound size={20} className="text-[var(--artificio-brand)] shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--fg-muted)]">
                <p className="font-bold text-[var(--fg)] mb-1">
                  Cadastrou com email/senha no glossário antigo e seu email não é Google?
                </p>
                <p className="mb-2">
                  Migre sua conta sem perder os termos, votos e comentários que você já adicionou.
                </p>
                <Link to="/migrar" className="text-[var(--artificio-brand)] font-bold hover:underline">
                  Entre por aqui →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
