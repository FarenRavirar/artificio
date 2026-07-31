import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@artificio/auth";
import { AdminTable, PageHeader, StatusPill, type AdminColumn } from "@artificio/ui/admin";
import { z } from "zod";

interface RoleUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleVersion: number;
  createdAt: string;
}

const roleUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["user", "moderator", "admin"]),
  roleVersion: z.number().int().positive(),
  createdAt: z.string(),
});

const roleUserListSchema = z.object({ users: z.array(roleUserSchema) });
const roleUserUpdateSchema = z.object({ user: roleUserSchema });

const ROLE_LABEL: Record<UserRole, string> = {
  user: "Usuário",
  moderator: "Moderador",
  admin: "Administrador",
};

const ROLE_TONE = {
  user: "neutral",
  moderator: "warn",
  admin: "brand",
} as const;

function readError(payload: unknown, fallback: string): string {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function AdminRolesPanel(): React.JSX.Element {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/admin/roles/users", globalThis.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());
      const response = await fetch(url, { credentials: "include" });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(payload, "Falha ao carregar contas."));
      const parsed = roleUserListSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Resposta inválida ao carregar contas.");
      }
      setUsers(parsed.data.users);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao carregar contas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      void loadUsers(search);
    }, 250);
    return () => globalThis.clearTimeout(timeout);
  }, [loadUsers, search]);

  const updateRole = useCallback(async (user: RoleUser, role: UserRole) => {
    setError(null);
    const response = await fetch(`/admin/roles/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(readError(payload, "Falha ao alterar papel."));
    const parsed = roleUserUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Resposta inválida ao alterar papel.");
    }
    const updated = parsed.data.user;
    setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
  }, []);

  const columns = useMemo<Array<AdminColumn<RoleUser>>>(() => [
    {
      key: "account",
      header: "Conta",
      render: (user) => (
        <div>
          <div className="font-medium text-[var(--admin-fg)]">{user.name}</div>
          <div className="text-xs text-[var(--admin-fg-faint)]">{user.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Papel atual",
      render: (user) => <StatusPill tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</StatusPill>,
    },
    {
      key: "changeRole",
      header: "Alterar para",
      render: (user) => (
        <select
          aria-label={`Alterar papel de ${user.name}`}
          className="h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-2 text-sm text-[var(--admin-fg)]"
          value={user.role}
          onChange={(event) => void updateRole(user, event.target.value as UserRole).catch((caughtError: unknown) => {
            setError(caughtError instanceof Error ? caughtError.message : "Falha ao alterar papel.");
          })}
        >
          <option value="user">Usuário</option>
          <option value="moderator">Moderador</option>
          <option value="admin">Administrador</option>
        </select>
      ),
    },
    {
      key: "roleVersion",
      header: "Versão",
      className: "w-24",
    },
  ], [updateRole]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={["Accounts", "Administração"]}
        title="Papéis globais"
        description="Accounts é a origem do papel global usado por todos os projetos."
        action={<a className="accounts-login accounts-login-secondary" href="/conta">Voltar à conta</a>}
      />
      {error ? <div role="alert" className="accounts-status accounts-status-error">{error}</div> : null}
      <AdminTable
        tableId="accounts-global-roles"
        rows={users}
        getRowId={(user) => user.id}
        getRowLabel={(user) => user.name}
        columns={columns}
        searchKeys={["name", "email"]}
        searchPlaceholder="Buscar por nome ou e-mail"
        searchValue={search}
        onSearchChange={setSearch}
        loading={loading}
        error={null}
        emptyTitle="Nenhuma conta encontrada"
      />
    </div>
  );
}
