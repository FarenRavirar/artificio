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
      <div className="bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--line)] overflow-hidden">
        <div className="bg-[var(--navy-block-bg)] p-8 text-center border-b-4 border-[var(--artificio-brand)] font-black italic uppercase tracking-tighter">
          <h2 className="text-[var(--navy-block-fg)] text-2xl flex items-center justify-center gap-2">
            <User size={24} /> Meu Perfil
          </h2>
          <p className="text-[var(--state-info-fg)] text-sm mt-2 normal-case font-medium not-italic tracking-normal">Gerencie seus dados e contribuições</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {success && <div className="bg-[var(--state-success-bg)] border border-[var(--state-success-line)] text-[var(--state-success-fg)] px-4 py-3 rounded-xl text-sm font-bold">{success}</div>}
          {error && <div className="bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)] text-[var(--state-danger-fg)] px-4 py-3 rounded-xl text-sm font-bold">{error}</div>}

          <div>
            {/* [THEME-MIGRATION] label nome completo — light theme */}
            <label className="block text-[12px] font-medium text-[var(--fg-muted)] mb-1 normal-case tracking-normal">Nome Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-[var(--surface)] text-[var(--fg)] border border-[var(--line)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent transition-all outline-none"
            />
          </div>
          <div>
            {/* [THEME-MIGRATION] label e-mail — light theme */}
            <label className="block text-[12px] font-medium text-[var(--fg-muted)] mb-1 normal-case tracking-normal">E-mail</label>
            {/* [THEME-MIGRATION] campo e-mail desabilitado — light theme */}
            <input type="email" value={user?.email || ''} disabled className="w-full border border-[var(--line)] rounded-xl px-4 py-3 text-sm bg-[var(--surface-subtle)] text-[var(--fg-muted)] font-medium italic cursor-not-allowed" />
            <p className="text-[10px] text-[var(--fg-muted)] mt-1 italic">O e-mail não pode ser alterado por segurança.</p>
          </div>
          <div>
            {/* [THEME-MIGRATION] label usuário — light theme */}
            <label className="block text-[12px] font-medium text-[var(--fg-muted)] mb-1 normal-case tracking-normal">Usuário (@)</label>
            {/* [THEME-MIGRATION] placeholder usuário — light theme */}
            <input type="text" value={user?.username || ''} placeholder="@seu_usuario" disabled className="w-full border border-[var(--line)] rounded-xl px-4 py-3 text-sm bg-[var(--surface-subtle)] text-[var(--fg-muted)] font-medium cursor-not-allowed placeholder:text-[var(--fg-muted)]" />
          </div>
          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
            {/* [THEME-MIGRATION] label papel — light theme */}
            <label className="text-[12px] font-medium text-[var(--fg-muted)] normal-case tracking-normal">Papel</label>
            <span className="bg-[var(--state-info-bg)] text-[var(--fg)] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-[var(--state-info-line)] shadow-sm">
              {user?.role}
            </span>
          </div>

          {/* [THEME-MIGRATION] botão salvar alterações — light theme */}
          <button type="submit" disabled={loading} className="w-full bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 tracking-normal disabled:opacity-50">
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
