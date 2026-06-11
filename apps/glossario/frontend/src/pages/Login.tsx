import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogIn, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-8 bg-cinza-fundo">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-azul-escuro p-8 text-center border-b-4 border-laranja">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Acessar Glossário</h2>
          <p className="text-blue-200 text-sm mt-2">Entre com sua conta de contribuinte</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Usuário ou E-mail</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
              placeholder="usuário_ou_email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Senha</label>
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
            disabled={loading}
            className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-laranja font-bold hover:underline">
              Cadastre-se aqui
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
