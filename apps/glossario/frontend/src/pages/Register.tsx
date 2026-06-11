import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { UserPlus, Loader2 } from 'lucide-react';

const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      const { data } = await api.post('/auth/register', { 
        full_name: fullName, 
        username,
        email, 
        password 
      });
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-8 bg-cinza-fundo">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-azul-escuro p-8 text-center border-b-4 border-laranja font-black italic uppercase tracking-tighter">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Criar Conta</h2>
          <p className="text-blue-200 text-sm mt-2 normal-case font-medium not-italic tracking-normal">Junte-se à comunidade de tradução</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Nome Completo</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
              placeholder="Digite seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Nome de Usuário (@)</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
              placeholder="escolha_um_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">E-mail</label>
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
            <label className="block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest">Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
            {loading ? 'Criando Conta...' : 'Cadastrar Agora'}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-laranja font-bold hover:underline">
              Faça login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
