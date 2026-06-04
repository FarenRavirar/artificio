import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * @deprecated
 * Esta página não é mais usada no fluxo OAuth com cookie HttpOnly.
 * O callback agora seta o cookie diretamente e redireciona para o frontend.
 * Mantida apenas para compatibilidade com rotas antigas.
 */
export const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.warn('[AuthCallback] Página deprecated - redirecionando para home');
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-artificio-blue)] text-white">
      <div className="flex flex-col items-center space-y-4 animate-pulse">
        <div className="w-12 h-12 border-4 border-[var(--color-artificio-orange)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium tracking-widest text-[#a8b8d8]">REDIRECIONANDO...</p>
      </div>
    </div>
  );
};
