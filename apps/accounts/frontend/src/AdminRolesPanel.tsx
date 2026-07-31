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

/**
 * Perda de papel do **próprio ator** durante a sessão: o backend revalida o ator
 * no banco a cada requisição e devolve este código quando ele deixou de ser
 * admin, ou quando o `roleVersion` do token ficou para trás.
 */
class PermissionChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionChangedError";
  }
}

function readError(payload: unknown, fallback: string): string {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

/**
 * O status 403 sozinho **não** identifica perda de papel: `csrfProtection`
 * devolve o mesmo status quando a origem não é permitida ou um proxy remove o
 * `Origin` (`packages/auth/src/csrf.ts`). Tratar todo 403 como rebaixamento
 * travava a tela do admin legítimo num erro de CSRF, e recarregar não resolvia
 * (achado de review, PR #234). Discriminar por texto de mensagem quebraria ao
 * traduzir ou reescrever a frase — daí o código estável do backend
 * (`ADMIN_REQUIRED_CODE` em `requireCurrentAdmin.ts`).
 */
const ADMIN_REQUIRED_CODE = "ADMIN_REQUIRED";

function isPermissionChanged(response: Response, payload: unknown): boolean {
  return response.status === 403
    && payload !== null
    && typeof payload === "object"
    && "code" in payload
    && payload.code === ADMIN_REQUIRED_CODE;
}

export function AdminRolesPanel(): React.JSX.Element {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Papel escolhido no select fica pendente até confirmação explícita: esta é a
  // tela que concede poder sobre todos os projetos, e o `onChange` disparava o
  // PATCH direto — clique errado promovia a admin sem confirmar nem desfazer
  // (achado de review, PR #233; requisito 27, prevenção de erro de Nielsen).
  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // Estado terminal da tela: o ator perdeu o papel de admin durante a sessão.
  // Separado de `error` porque não é falha recuperável de uma ação — nenhuma
  // outra alteração vai passar até a sessão ser renovada.
  const [permissionLost, setPermissionLost] = useState<string | null>(null);

  /**
   * Transição única para "o ator perdeu o papel". Centralizada porque acontece
   * em dois caminhos — a listagem e o PATCH — e eles divergiram: só a listagem
   * limpava as linhas, então um ator revogado ao salvar seguia vendo nome e
   * e-mail de todas as contas até recarregar (achado de review, PR #234).
   * Estado de tela e dado exibido saem juntos ou não saem.
   */
  const losePermission = useCallback((message: string) => {
    setPermissionLost(message);
    setUsers([]);
    setPendingRole({});
  }, []);

  // Duas buscas podem passar do debounce e voltar fora de ordem: se a antiga
  // chegar depois, sobrescreveria a lista com resultados do texto anterior — o
  // campo mostraria uma consulta e o admin alteraria o papel de conta de outra
  // (achado de review, PR #233). O sinal aborta a requisição anterior e o
  // `aborted` descarta o que ainda estiver em voo.
  const loadUsers = useCallback(async (query: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/admin/roles/users", globalThis.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());
      const response = await fetch(url, { credentials: "include", signal });
      const payload: unknown = await response.json().catch(() => ({}));
      if (signal.aborted) return;
      // Mesmo caso da alteração: o ator deixou de ser admin. Vale já na
      // listagem, porque o rebaixamento pode acontecer com a tela só aberta.
      if (isPermissionChanged(response, payload)) {
        losePermission(readError(payload, "Sua permissão de administrador mudou."));
        return;
      }
      if (!response.ok) throw new Error(readError(payload, "Falha ao carregar contas."));
      const parsed = roleUserListSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Resposta inválida ao carregar contas.");
      }
      setUsers(parsed.data.users);
    } catch (error_) {
      // Aborto é fluxo normal de busca substituída, não erro para o admin.
      if (signal.aborted || (error_ instanceof DOMException && error_.name === "AbortError")) return;
      setError(error_ instanceof Error ? error_.message : "Falha ao carregar contas.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [losePermission]);

  useEffect(() => {
    // Permissão perdida encerra a busca: sem esta guarda, cada tecla digitada no
    // campo dispararia outro GET que o backend recusa com o mesmo 403.
    if (permissionLost !== null) return;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => {
      void loadUsers(search, controller.signal);
    }, 250);
    return () => {
      globalThis.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadUsers, permissionLost, search]);

  const updateRole = useCallback(async (user: RoleUser, role: UserRole) => {
    setError(null);
    const response = await fetch(`/admin/roles/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    // `ADMIN_REQUIRED` significa que o papel do **próprio ator** mudou no banco
    // durante a sessão (`requireCurrentAdmin` ou `ACTOR_NO_LONGER_ADMIN`), não
    // que o alvo seja inválido. A tela inteira deixou de ser legítima: mantê-la
    // com um aviso genérico faria o admin rebaixado seguir clicando numa lista
    // que já não pode alterar, colecionando erros sem entender a causa. Um 403
    // sem esse código (CSRF, por exemplo) segue como erro comum e recuperável.
    if (isPermissionChanged(response, payload)) {
      throw new PermissionChangedError(
        readError(payload, "Sua permissão de administrador mudou."),
      );
    }
    if (!response.ok) throw new Error(readError(payload, "Falha ao alterar papel."));
    const parsed = roleUserUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Resposta inválida ao alterar papel.");
    }
    const updated = parsed.data.user;
    setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    setPendingRole((current) => {
      const { [updated.id]: _discarded, ...rest } = current;
      return rest;
    });
  }, []);

  const confirmRoleChange = useCallback(async (user: RoleUser, role: UserRole) => {
    const question = `Alterar o papel de ${user.name} de "${ROLE_LABEL[user.role]}" para "${ROLE_LABEL[role]}"?`;
    if (!globalThis.confirm(question)) return;
    setSavingId(user.id);
    try {
      await updateRole(user, role);
    } catch (error_) {
      if (error_ instanceof PermissionChangedError) {
        losePermission(error_.message);
        return;
      }
      setError(error_ instanceof Error ? error_.message : "Falha ao alterar papel.");
    } finally {
      setSavingId(null);
    }
  }, [losePermission, updateRole]);

  const cancelRoleChange = useCallback((userId: string) => {
    setPendingRole((current) => {
      const { [userId]: _discarded, ...rest } = current;
      return rest;
    });
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
      render: (user) => {
        const selected = pendingRole[user.id] ?? user.role;
        const dirty = selected !== user.role;
        const saving = savingId === user.id;
        // Permissão perdida trava tudo, mas não é "salvando": o rótulo do botão
        // continua "Salvar" para não sugerir requisição em andamento.
        const blocked = saving || permissionLost !== null;
        return (
          <div className="flex items-center gap-2">
            <select
              aria-label={`Alterar papel de ${user.name}`}
              className="h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-2 text-sm text-[var(--admin-fg)]"
              value={selected}
              disabled={blocked}
              onChange={(event) => {
                const next = event.target.value as UserRole;
                setPendingRole((current) => ({ ...current, [user.id]: next }));
              }}
            >
              <option value="user">Usuário</option>
              <option value="moderator">Moderador</option>
              <option value="admin">Administrador</option>
            </select>
            {dirty ? (
              <>
                <button
                  type="button"
                  className="accounts-login accounts-login-secondary h-9 px-3 text-sm"
                  disabled={blocked}
                  onClick={() => void confirmRoleChange(user, selected)}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  className="accounts-login accounts-login-secondary h-9 px-3 text-sm"
                  disabled={blocked}
                  onClick={() => cancelRoleChange(user.id)}
                >
                  Cancelar
                </button>
              </>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "roleVersion",
      header: "Versão",
      className: "w-24",
    },
  ], [cancelRoleChange, confirmRoleChange, pendingRole, permissionLost, savingId]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={["Accounts", "Administração"]}
        title="Papéis globais"
        description="Accounts é a origem do papel global usado por todos os projetos."
        action={<a className="accounts-login accounts-login-secondary" href="/conta">Voltar à conta</a>}
      />
      {permissionLost ? (
        <div role="alert" className="accounts-status accounts-status-error">
          {permissionLost} Recarregue a página para continuar com a permissão atual.
          <button
            type="button"
            className="accounts-login accounts-login-secondary ml-3 h-8 px-3 text-sm"
            onClick={() => globalThis.location.reload()}
          >
            Recarregar
          </button>
        </div>
      ) : null}
      {error && !permissionLost ? (
        <div role="alert" className="accounts-status accounts-status-error">{error}</div>
      ) : null}
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
