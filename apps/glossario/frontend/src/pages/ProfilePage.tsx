import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Save } from 'lucide-react';
import api from '../services/api';

const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const res = await api.patch('/users/profile', { full_name: fullName });
      setUser(res.data);
      setSuccess('Perfil atualizado com sucesso!');
    } catch {
      setError('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-azul-escuro p-8 text-center border-b-4 border-laranja font-black italic uppercase tracking-tighter">
          <h2 className="text-white text-2xl flex items-center justify-center gap-2">
            <User size={24} /> Meu Perfil
          </h2>
          <p className="text-blue-200 text-sm mt-2 normal-case font-medium not-italic tracking-normal">Gerencie seus dados e contribuições</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-bold">{success}</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold">{error}</div>}

          <div>
            {/* [THEME-MIGRATION] label nome completo — light theme */}
            <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1 normal-case tracking-normal">Nome Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition-all outline-none"
            />
          </div>
          <div>
            {/* [THEME-MIGRATION] label e-mail — light theme */}
            <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1 normal-case tracking-normal">E-mail</label>
            {/* [THEME-MIGRATION] campo e-mail desabilitado — light theme */}
            <input type="email" value={user?.email || ''} disabled className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-secondary)] text-gray-400 font-medium italic cursor-not-allowed" />
            <p className="text-[10px] text-gray-400 mt-1 italic">O e-mail não pode ser alterado por segurança.</p>
          </div>
          <div>
            {/* [THEME-MIGRATION] label usuário — light theme */}
            <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1 normal-case tracking-normal">Usuário (@)</label>
            {/* [THEME-MIGRATION] placeholder usuário — light theme */}
            <input type="text" value={user?.username || ''} placeholder="@seu_usuario" disabled className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-400 font-medium cursor-not-allowed placeholder:text-[var(--color-input-placeholder)]" />
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            {/* [THEME-MIGRATION] label papel — light theme */}
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)] normal-case tracking-normal">Papel</label>
            <span className="bg-blue-50 text-azul-escuro px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100 shadow-sm">
              {user?.role}
            </span>
          </div>

          {/* [THEME-MIGRATION] botão salvar alterações — light theme */}
          <button type="submit" disabled={loading} className="w-full bg-azul-escuro hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 tracking-normal disabled:opacity-50">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Loader2 = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default ProfilePage;
