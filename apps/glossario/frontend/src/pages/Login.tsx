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
    <div className="flex items-center justify-center p-8 bg-cinza-fundo">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-azul-escuro p-8 text-center border-b-4 border-laranja">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Acessar Glossário</h2>
          <p className="text-blue-200 text-sm mt-2">Entre com sua conta Google</p>
        </div>

        <div className="p-8 space-y-6">
          <button
            type="button"
            onClick={login}
            className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-start gap-3 bg-laranja/5 border border-laranja/20 rounded-xl p-4">
              <KeyRound size={20} className="text-laranja shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-bold text-azul-escuro mb-1">
                  Cadastrou com email/senha no glossário antigo e seu email não é Google?
                </p>
                <p className="mb-2">
                  Migre sua conta sem perder os termos, votos e comentários que você já adicionou.
                </p>
                <Link to="/migrar" className="text-laranja font-bold hover:underline">
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
