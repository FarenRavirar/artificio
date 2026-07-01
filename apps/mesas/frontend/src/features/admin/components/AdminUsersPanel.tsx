import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authGet, authPatch } from '../../../services/apiClient';
import { AdminTable, StatusPill } from './ui';

type AdminUserRole = 'visitor' | 'player' | 'gm' | 'admin';

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  role: AdminUserRole;
  location: string | null;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  avatar_url: string | null;
  gm_slug: string | null;
  gm_nickname: string | null;
  covil_verified: boolean;
  covil_verified_at: string | null;
}

const ROLE_LABEL: Record<AdminUserRole, string> = {
  visitor: 'Visitante',
  player: 'Jogador',
  gm: 'Mestre',
  admin: 'Admin',
};

function isRole(value: unknown): value is AdminUserRole {
  return value === 'visitor' || value === 'player' || value === 'gm' || value === 'admin';
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeUsers(value: unknown): AdminUserRow[] {
  if (!Array.isArray(value)) return [];
  const rows: AdminUserRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    const email = readString(row.email);
    const role = row.role;
    if (!id || !email || !isRole(role)) continue;
    rows.push({
      id,
      email,
      username: readNullableString(row.username),
      role,
      location: readNullableString(row.location),
      created_at: readString(row.created_at),
      updated_at: readString(row.updated_at),
      display_name: readNullableString(row.display_name),
      avatar_url: readNullableString(row.avatar_url),
      gm_slug: readNullableString(row.gm_slug),
      gm_nickname: readNullableString(row.gm_nickname),
      covil_verified: row.covil_verified === true,
      covil_verified_at: readNullableString(row.covil_verified_at),
    });
  }
  return rows;
}

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authGet('/api/v1/admin/users');
      if (!response.ok) throw new Error('Erro ao carregar usuários.');
      const payload: unknown = await response.json();
      const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : [];
      setUsers(normalizeUsers(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuários.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleCovil = async (user: AdminUserRow) => {
    setSavingId(user.id);
    try {
      const response = await authPatch(`/api/v1/admin/users/${user.id}/covil`, {
        verified: !user.covil_verified,
      });
      if (!response.ok) throw new Error('Erro ao atualizar Covil do Lich.');
      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, covil_verified: !item.covil_verified } : item
      )));
      toast.success(!user.covil_verified ? 'Mestre marcado como Covil do Lich.' : 'Selo Covil removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar Covil do Lich.');
    } finally {
      setSavingId(null);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'user',
      header: 'Usuário',
      render: (user: AdminUserRow) => (
        <div>
          <div className="font-medium text-[var(--fg)]">{user.display_name || user.username || user.email}</div>
          <div className="text-xs text-[var(--fg-faint)]">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Perfil',
      render: (user: AdminUserRow) => <StatusPill tone={user.role === 'admin' ? 'brand' : 'neutral'}>{ROLE_LABEL[user.role]}</StatusPill>,
    },
    {
      key: 'gm',
      header: 'Mestre',
      render: (user: AdminUserRow) => user.gm_nickname || user.gm_slug || '-',
    },
    {
      key: 'covil',
      header: 'Covil',
      render: (user: AdminUserRow) => user.covil_verified ? <StatusPill tone="success">verificado</StatusPill> : <StatusPill>não</StatusPill>,
    },
    {
      key: 'created_at',
      header: 'Criado em',
      render: (user: AdminUserRow) => formatDate(user.created_at),
    },
  ], []);

  return (
    <AdminTable
      tableId="admin-users"
      rows={users}
      getRowId={(user) => user.id}
      columns={columns}
      searchKeys={[(user) => `${user.email} ${user.username ?? ''} ${user.display_name ?? ''} ${user.gm_nickname ?? ''}`]}
      searchPlaceholder="Buscar usuário..."
      facets={[
        {
          key: 'role',
          label: 'Perfil',
          options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
          getValue: (user) => user.role,
        },
        {
          key: 'covil',
          label: 'Covil',
          options: [{ value: 'true', label: 'Verificado' }, { value: 'false', label: 'Não verificado' }],
          getValue: (user) => String(user.covil_verified),
        },
      ]}
      rowActions={[
        {
          key: 'covil',
          label: 'Alternar Covil',
          icon: <ShieldCheck size={15} />,
          hidden: (user) => savingId === user.id,
          onRun: toggleCovil,
        },
      ]}
      loading={loading}
      error={error}
      emptyTitle="Nenhum usuário encontrado"
      emptyHint="A lista usa o endpoint administrativo de usuários."
    />
  );
}
