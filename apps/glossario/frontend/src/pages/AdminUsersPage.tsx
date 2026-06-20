import React, { useEffect, useState } from 'react';
import { Users, ShieldX, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface Member {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  banned: boolean;
  created_at: string;
}

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/admin');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void (async () => { await fetchUsers(); })(); }, []);

  const toggleBan = async (id: string, banned: boolean) => {
    await api.post(`/users/admin/${id}/ban`, { banned: !banned });
    fetchUsers();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-[var(--fg)] flex items-center gap-2"><Users size={24} /> Gestão de Membros</h1>
        <button onClick={fetchUsers} className="flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--line)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--fg-muted)]">Carregando membros...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">Membro</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">Desde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-b border-[var(--line)] hover:bg-[var(--surface-subtle)] transition-colors ${u.banned ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-[var(--fg)]">{u.full_name}</div>
                    <div className="text-xs text-[var(--fg-muted)]">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--fg-muted)]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${u.role === 'admin' ? 'bg-[var(--state-warning-bg)] text-[var(--artificio-brand)]' : 'bg-[var(--state-info-bg)] text-[var(--fg)]'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase ${u.banned ? 'bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)]' : 'bg-[var(--state-success-bg)] text-[var(--state-success-fg)]'}`}>
                      {u.banned ? 'Banido' : 'Ativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBan(u.id, u.banned)}
                      title={u.banned ? 'Desbanir' : 'Banir'}
                      className={`p-2 rounded-lg transition-colors ${u.banned ? 'text-[var(--state-success-fg)] hover:bg-[var(--state-success-bg)]' : 'text-[var(--state-danger-fg)] hover:bg-[var(--state-danger-bg)]'}`}
                    >
                      {u.banned ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
