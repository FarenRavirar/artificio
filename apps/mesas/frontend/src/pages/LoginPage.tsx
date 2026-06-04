import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { applySeo } from '../utils/seo';
import { startSsoLogin } from '../utils/auth';

export const LoginPage = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    applySeo(
      'Entrar | Artifício Mesas',
      'Acesse sua conta Artifício Mesas com Google OAuth para publicar e encontrar mesas de RPG.'
    );
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      navigate(user?.role === 'gm' || user?.role === 'admin' ? '/painel' : '/', {
        replace: true,
      });
    }
  }, [isLoading, isAuthenticated, user?.role, navigate]);

  const handleLoginClick = () => {
    startSsoLogin();
  };

  return (
    <main className="relative min-h-[calc(100vh-8rem)] overflow-hidden bg-[var(--color-artificio-blue)] text-white px-6 py-14">
      <div className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-artificio-orange)]/15 blur-[120px] pointer-events-none" />

      <section className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-artificio-orange)]/20 text-[var(--color-artificio-orange)]">
          <ShieldCheck className="h-7 w-7" />
        </div>

        <h1 className="mb-3 text-3xl font-black tracking-tight">Entrar no Artifício Mesas</h1>
        <p className="mb-8 max-w-md text-sm text-white/70">
          Faça login com Google para acessar seu onboarding, painel e recursos da comunidade.
        </p>

        <button
          id="login-btn-google"
          onClick={handleLoginClick}
          className="group relative mb-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[var(--color-artificio-orange)] to-[var(--color-artificio-orange-hover)] px-6 py-3 font-semibold text-white shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <span className="absolute inset-0 w-0 bg-white/15 transition-all duration-300 group-hover:w-full" />
          <LogIn className="relative h-4 w-4" />
          <span className="relative">Entrar com Google</span>
        </button>

        <Link
          to="/"
          id="login-link-home"
          className="text-sm text-white/60 transition-colors hover:text-[var(--color-artificio-orange)]"
        >
          Voltar para a página inicial
        </Link>
      </section>
    </main>
  );
};
