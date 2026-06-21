// Ilha do painel CRUD admin (D-LNK-14). Gated por SSO role=admin. Reusa @artificio/auth
// (useSession/authFetch/redirectToLogin) e os primitivos @artificio/ui. Fala só com /api/admin/v1.
import { useCallback, useEffect, useRef, useState } from "react";
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
      <RehydrateSection />
      <ReportsSection groups={groups} />
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

interface JobState {
  name: string;
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  code?: number | null;
  logTail?: string;
}

function normalizeJobState(value: unknown): JobState | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.name !== "string" || typeof r.startedAt !== "string") return null;
  return {
    name: r.name,
    startedAt: r.startedAt,
    finishedAt: typeof r.finishedAt === "string" ? r.finishedAt : undefined,
    ok: typeof r.ok === "boolean" ? r.ok : undefined,
    code: typeof r.code === "number" ? r.code : (r.code === null ? null : undefined),
    logTail: typeof r.logTail === "string" ? r.logTail : undefined,
  } satisfies JobState;
}

function RehydrateSection() {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do timer de polling no unmount (evita setState em componente desmontado).
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const pollStatus = async () => {
    try {
      const res = await authFetch("/api/admin/v1/groups/rehydrate-logos/status");
      if (!res.ok) {
        setError(`Erro ao verificar status (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      const raw = await res.json();
      const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const busy = typeof data?.busy === "boolean" ? data.busy : false;
      const job = normalizeJobState(data?.job);
      if (job?.name === "rehydrate") {
        setJob(job);
        setBusy(busy);
        if (!busy && job) {
          // logTail é capado em 8000 chars (jobs.ts:37). Regex [^}]* é linear:
          // [^}] e } não têm overlap → sem backtracking catastrófico. Seguro.
          const tail = job.logTail ?? "";
          const jsonMatch = tail.length > 0 && tail.length <= 8000
            ? tail.match(/\{["']updated["']\s*:\s*\d+[^}]*\}/)
            : null;
          setResult(jsonMatch ? jsonMatch[0] : (job.ok ? "Concluído." : "Falhou."));
        }
        if (busy) pollTimerRef.current = setTimeout(() => { void pollStatus(); }, 2000);
      }
    } catch {
      setJob(null);
      setBusy(false);
    }
  };

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      const res = await authFetch("/api/admin/v1/groups/rehydrate-logos", { method: "POST" });
      if (!res.ok) {
        setError(`Erro ao iniciar (HTTP ${res.status}).`);
        return;
      }
      const raw = await res.json();
      const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const started = typeof data?.started === "boolean" ? data.started : false;
      const busy = typeof data?.busy === "boolean" ? data.busy : false;
      const job = normalizeJobState(data?.job);
      if (started && job) {
        setBusy(true);
        setJob(job);
        pollTimerRef.current = setTimeout(() => { void pollStatus(); }, 2000);
      } else if (busy) {
        setResult("Já existe um job em andamento.");
      } else {
        setError("Não foi possível iniciar.");
      }
    } catch {
      setError("Falha de rede.");
    }
  };

  return (
    <section>
      <h2>Reidratação de imagens</h2>
      <p className="admin-meta">
        Busca as logos dos grupos ativos no WhatsApp e sobe ao Cloudinary.
        Grupos com logo inalterada são pulados.
      </p>
      <Toolbar
        trailing={
          <Button variant="primary" disabled={busy} onClick={start}>
            {busy ? "Reidratando…" : "Reidratar imagens"}
          </Button>
        }
      >
        {job && (
          <span className="admin-meta" style={{ fontSize: "0.8rem" }}>
            {busy
              ? `Em andamento desde ${new Date(job.startedAt).toLocaleTimeString("pt-BR")}…`
              : job.finishedAt
                ? `Finalizado ${new Date(job.finishedAt).toLocaleTimeString("pt-BR")}`
                : ""}
          </span>
        )}
      </Toolbar>
      {result && (
        <p className="admin-meta" style={{ color: "var(--artificio-brand, #FF5722)", fontWeight: 600 }}>
          {result}
        </p>
      )}
      {error && (
        <p className="admin-meta" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
    </section>
  );
}

interface Report {
  id: string;
  group_id: string;
  reason: string;
  note: string | null;
  reporter_email: string | null;
  status: string;
  created_at: string;
}

function normalizeReport(value: unknown): Report | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.group_id !== "string" || typeof r.reason !== "string") return null;
  return {
    id: r.id,
    group_id: r.group_id,
    reason: r.reason,
    note: typeof r.note === "string" ? r.note : null,
    reporter_email: typeof r.reporter_email === "string" ? r.reporter_email : null,
    status: typeof r.status === "string" ? r.status : "open",
    created_at: typeof r.created_at === "string" ? r.created_at : "",
  } satisfies Report;
}

const REASON_LABELS: Record<string, string> = {
  convite_quebrado: "Convite quebrado",
  conteudo_improprio: "Conteúdo impróprio",
  grupo_inativo: "Grupo inativo",
  outro: "Outro",
};

function ReportsSection({ groups }: { groups: Group[] }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState<string | null>(null);

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id.slice(0, 8);

  const load = async (statusFilter?: string) => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await authFetch(`/api/admin/v1/reports${qs}`);
      if (!res.ok) throw new Error("API error");
      const json = (await res.json()) as { data: unknown };
      if (!Array.isArray(json.data)) {
        setReports([]);
        setError(true);
        return;
      }
      // Array.isArray validado acima; normalizeReport valida cada item; .filter remove nulls.
      // Render com reports?.map opera sobre estado já normalizado — seguro.
      setReports(json.data.map(normalizeReport).filter((v): v is Report => v !== null));
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => { void load(filter); }, [filter]);

  const resolve = async (id: string) => {
    setBusy(id);
    try {
      const res = await authFetch(`/api/admin/v1/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load(filter);
    } catch {
      alert("Falha ao atualizar.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusy(id);
    try {
      const res = await authFetch(`/api/admin/v1/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load(filter);
    } catch {
      alert("Falha ao atualizar.");
    } finally {
      setBusy(null);
    }
  };

  const total = reports?.length ?? 0;

  return (
    <section>
      <h2>Denúncias ({total})</h2>
      <Toolbar>
        <select
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          style={{
            padding: ".3rem .5rem",
            borderRadius: "6px",
            border: "1px solid var(--color-border, #ccc)",
            background: "var(--color-surface, #fff)",
            color: "var(--color-fg, #0B1220)",
            fontSize: "0.85rem",
          }}
        >
          <option value="">Todas</option>
          <option value="open">Abertas</option>
          <option value="resolved">Resolvidas</option>
          <option value="dismissed">Dispensadas</option>
        </select>
      </Toolbar>
      {error && <ErrorState title="Erro ao carregar" message="Tente recarregar." variant="inline" />}
      {!reports && <LoadingState message="Carregando denúncias…" variant="inline" />}
      {reports && reports.length === 0 && (
        <EmptyState title="Nenhuma denúncia" message="Nada pendente." variant="inline" />
      )}
      {reports?.map((r) => (
        <Panel
          key={r.id}
          tone={r.status === "open" ? "warning" : "subtle"}
          header={
            <span>
              <strong>{groupName(r.group_id)}</strong>{" "}
              <Badge variant={r.status === "open" ? "warning" : r.status === "resolved" ? "success" : "neutral"}>
                {r.status}
              </Badge>
            </span>
          }
          actions={
            r.status === "open" && (
              <Toolbar>
                <Button variant="success" disabled={busy === r.id} onClick={() => resolve(r.id)}>
                  Resolver
                </Button>
                <Button variant="ghost" disabled={busy === r.id} onClick={() => dismiss(r.id)}>
                  Dispensar
                </Button>
              </Toolbar>
            )
          }
        >
          <p className="admin-meta">
            {REASON_LABELS[r.reason] ?? r.reason}
            {r.reporter_email && <> · <strong>{r.reporter_email}</strong></>}
            {" · "}{new Date(r.created_at).toLocaleString("pt-BR")}
          </p>
          {r.note && <p className="admin-meta" style={{ whiteSpace: "pre-wrap" }}>{r.note}</p>}
        </Panel>
      ))}
    </section>
  );
}
