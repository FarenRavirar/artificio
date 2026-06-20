// Ilha do painel CRUD admin (D-LNK-14). Gated por SSO role=admin. Reusa @artificio/auth
// (useSession/authFetch/redirectToLogin) e os primitivos @artificio/ui. Fala só com /api/admin/v1.
import { useCallback, useEffect, useState } from "react";
import { useSession, authFetch, redirectToLogin } from "@artificio/auth/client";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  Select,
  TextInput,
  Textarea,
  Toolbar,
} from "@artificio/ui";

type Status = "pending" | "active" | "archived" | "rejected";
type Category = "artificio" | "tematicos" | "parceiros" | "comunidade";

interface Group {
  id: string;
  name: string;
  slug: string | null;
  tags: string[];
  description: string | null;
  rules: string | null;
  invite_url: string;
  kind: "group" | "channel";
  category: Category;
  is_adult: boolean;
  status: Status;
  source: "curated" | "community";
  submitted_email: string | null;
  submitted_name: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Tag {
  id: string;
  slug: string;
  label: string;
}

const CATEGORIES: Category[] = ["artificio", "tematicos", "parceiros", "comunidade"];
const STATUS_VALUES: Status[] = ["pending", "active", "archived", "rejected"];
const STATUS_TONE: Record<Status, "warning" | "success" | "neutral" | "danger"> = {
  pending: "warning",
  active: "success",
  archived: "neutral",
  rejected: "danger",
};

function normalizeGroup(value: unknown): Group | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.invite_url !== "string") return null;
  if (typeof r.kind !== "string" || (r.kind !== "group" && r.kind !== "channel")) return null;
  return {
    id: r.id,
    name: r.name,
    invite_url: r.invite_url,
    kind: r.kind,
    slug: typeof r.slug === "string" ? r.slug : null,
    tags: Array.isArray(r.tags) ? r.tags.filter((t: unknown): t is string => typeof t === "string") : [],
    description: typeof r.description === "string" ? r.description : null,
    rules: typeof r.rules === "string" ? r.rules : null,
    category: (typeof r.category === "string" && (CATEGORIES as string[]).includes(r.category)) ? r.category as Category : "comunidade",
    is_adult: typeof r.is_adult === "boolean" ? r.is_adult : false,
    status: (typeof r.status === "string" && (STATUS_VALUES as string[]).includes(r.status)) ? r.status as Status : "pending",
    source: (typeof r.source === "string" && r.source === "community") ? "community" : "curated",
    submitted_email: typeof r.submitted_email === "string" ? r.submitted_email : null,
    submitted_name: typeof r.submitted_name === "string" ? r.submitted_name : null,
    approved_at: typeof r.approved_at === "string" ? r.approved_at : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
  } satisfies Group;
}

function normalizeTag(value: unknown): Tag | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.slug !== "string" || typeof r.label !== "string") return null;
  return { id: r.id, slug: r.slug, label: r.label } satisfies Tag;
}

function normalizeApiResponse<T>(value: unknown, normalizeItem: (v: unknown) => T | null): T[] {
  if (!value || typeof value !== "object") return [];
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.data)) return [];
  return r.data.map(normalizeItem).filter((v): v is T => v !== null);
}

export default function AdminPanel() {
  const { user, loading } = useSession();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [gRes, tRes] = await Promise.all([
        authFetch("/api/admin/v1/groups"),
        authFetch("/api/admin/v1/tags"),
      ]);
      if (!gRes.ok || !tRes.ok) throw new Error("API error");
      const [gJson, tJson] = await Promise.all([gRes.json(), tRes.json()]);
      setGroups(normalizeApiResponse(gJson, normalizeGroup));
      setTags(normalizeApiResponse(tJson, normalizeTag));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") void reload();
  }, [user, reload]);

  if (loading) return <LoadingState message="Verificando sessão…" variant="inline" />;
  if (!user)
    return (
      <Panel tone="subtle">
        <p>Faça login para acessar o painel.</p>
        <Button variant="primary" onClick={() => redirectToLogin()}>
          Entrar
        </Button>
      </Panel>
    );
  if (user.role !== "admin")
    return <ErrorState title="Sem permissão" message="Esta área é restrita a administradores." variant="inline" />;
  if (error) return <ErrorState title="Erro ao carregar" message="Tente recarregar." variant="inline" />;
  if (!groups) return <LoadingState message="Carregando painel…" variant="inline" />;

  const pending = groups.filter((g) => g.status === "pending");
  const others = groups.filter((g) => g.status !== "pending");

  return (
    <div className="admin">
      <h1>Painel — Grupos de WhatsApp</h1>

      <section>
        <h2>Fila de moderação ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyState title="Sem pendentes" message="Nenhuma sugestão aguardando." variant="inline" />
        ) : (
          pending.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              tags={tags}
              editing={editing === g.id}
              onEdit={() => setEditing(editing === g.id ? null : g.id)}
              onChanged={reload}
            />
          ))
        )}
      </section>

      <section>
        <h2>Grupos ({others.length})</h2>
        {others.map((g) => (
          <GroupRow
            key={g.id}
            group={g}
            tags={tags}
            editing={editing === g.id}
            onEdit={() => setEditing(editing === g.id ? null : g.id)}
            onChanged={reload}
          />
        ))}
      </section>

      <TagManager tags={tags} onChanged={reload} />
    </div>
  );
}

function GroupRow({
  group,
  tags,
  editing,
  onEdit,
  onChanged,
}: {
  group: Group;
  tags: Tag[];
  editing: boolean;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch {
      alert("Ação falhou.");
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (slug: string) => tags.find((t) => t.slug === slug)?.label ?? slug;

  return (
    <Panel
      tone={group.status === "pending" ? "warning" : "subtle"}
      header={
        <span>
          <strong>{group.name}</strong>{" "}
          <Badge variant={STATUS_TONE[group.status]}>{group.status}</Badge>{" "}
          {group.is_adult && <Badge variant="danger">+18</Badge>}
        </span>
      }
      actions={
        <Toolbar>
          {group.status === "pending" && (
            <Button variant="success" disabled={busy} onClick={() => act(() => authFetch(`/api/admin/v1/groups/${group.id}/accept`, { method: "POST" }).then(r => { if (!r.ok) throw new Error(String(r.status)); }))}>
              Aceitar
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={onEdit}>
            {editing ? "Fechar" : "Editar"}
          </Button>
          {group.status !== "archived" && (
            <Button variant="ghost" disabled={busy} onClick={() => act(() => authFetch(`/api/admin/v1/groups/${group.id}/archive`, { method: "POST" }).then(r => { if (!r.ok) throw new Error(String(r.status)); }))}>
              Arquivar
            </Button>
          )}
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Excluir "${group.name}"? Esta ação não pode ser desfeita.`))
                void act(() => authFetch(`/api/admin/v1/groups/${group.id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error(String(r.status)); }));
            }}
          >
            Excluir
          </Button>
        </Toolbar>
      }
    >
      <p className="admin-meta">
        {group.category} · {group.source} · {group.invite_url}
        {group.submitted_email && (
          <>
            {" "}
            · sugerido por <strong>{group.submitted_name ?? "—"}</strong> ({group.submitted_email})
          </>
        )}
      </p>
      <p className="admin-meta">
        Enviado: {new Date(group.created_at).toLocaleString("pt-BR")}
        {group.approved_at && <> · Aprovado: {new Date(group.approved_at).toLocaleString("pt-BR")}</>}
      </p>
      {group.tags.length > 0 && (
        <p className="chips">
          {group.tags.map((s) => (
            <span className="chip" key={s}>
              {labelFor(s)}
            </span>
          ))}
        </p>
      )}
      {editing && <EditForm group={group} tags={tags} onSaved={onChanged} />}
    </Panel>
  );
}

function EditForm({ group, tags, onSaved }: { group: Group; tags: Tag[]; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [rules, setRules] = useState(group.rules ?? "");
  const [category, setCategory] = useState<Category>(group.category);
  const [isAdult, setIsAdult] = useState(group.is_adult);
  const [slug, setSlug] = useState(group.slug ?? "");
  const [invite, setInvite] = useState(group.invite_url);
  const [sel, setSel] = useState<string[]>(group.tags);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleTag = (s: string) =>
    setSel((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length >= 3 ? cur : [...cur, s]));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/admin/v1/groups/${group.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          rules,
          category,
          is_adult: isAdult,
          slug,
          invite_url: invite,
          tags: sel,
        }),
      });
      if (!res.ok) {
        setErr("Falha ao salvar (verifique o link).");
        return;
      }
      await onSaved();
    } catch {
      setErr("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-edit">
      <Field id={`n-${group.id}`} label="Nome">
        <TextInput id={`n-${group.id}`} value={name} onChange={(e) => setName(e.currentTarget.value)} />
      </Field>
      <Field id={`d-${group.id}`} label="Descrição">
        <Textarea id={`d-${group.id}`} rows={2} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </Field>
      <Field id={`r-${group.id}`} label="Regras do grupo">
        <Textarea id={`r-${group.id}`} rows={4} value={rules} onChange={(e) => setRules(e.currentTarget.value)} />
      </Field>
      <Field id={`c-${group.id}`} label="Categoria">
        <Select id={`c-${group.id}`} value={category} onChange={(e) => setCategory(e.currentTarget.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`s-${group.id}`} label="Slug (SEO)">
        <TextInput id={`s-${group.id}`} value={slug} onChange={(e) => setSlug(e.currentTarget.value)} />
      </Field>
      <Field id={`i-${group.id}`} label="Link de convite" error={err ?? undefined}>
        <TextInput id={`i-${group.id}`} value={invite} invalid={Boolean(err)} onChange={(e) => setInvite(e.currentTarget.value)} />
      </Field>
      <Field id={`a-${group.id}`} label="Conteúdo +18">
        <label className="admin-check">
          <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.currentTarget.checked)} /> Marcar como +18
        </label>
      </Field>
      <Field id={`t-${group.id}`} label={`Tags (até 3 — ${sel.length}/3)`}>
        <div className="admin-tags">
          {tags.map((t) => (
            <label key={t.id} className="admin-check">
              <input
                type="checkbox"
                checked={sel.includes(t.slug)}
                disabled={!sel.includes(t.slug) && sel.length >= 3}
                onChange={() => toggleTag(t.slug)}
              />{" "}
              {t.label}
            </label>
          ))}
        </div>
      </Field>
      <Button variant="primary" disabled={busy} onClick={save}>
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}

function TagManager({ tags, onChanged }: { tags: Tag[]; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (label.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await authFetch("/api/admin/v1/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setLabel("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Tag) => {
    if (!confirm(`Remover a tag "${t.label}"? Ela sai de todos os grupos.`)) return;
    const res = await authFetch(`/api/admin/v1/tags/${t.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(String(res.status));
    await onChanged();
  };

  return (
    <section>
      <h2>Vocabulário de tags</h2>
      <Toolbar
        trailing={
          <Button variant="primary" disabled={busy} onClick={add}>
            Adicionar
          </Button>
        }
      >
        <TextInput value={label} maxLength={60} placeholder="Nova tag (ex.: Mestres)" onChange={(e) => setLabel(e.currentTarget.value)} />
      </Toolbar>
      <div className="chips" style={{ marginTop: "0.75rem" }}>
        {tags.map((t) => (
          <span className="chip" key={t.id}>
            {t.label}{" "}
            <button className="chip-x" aria-label={`Remover ${t.label}`} onClick={() => void remove(t)}>
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
