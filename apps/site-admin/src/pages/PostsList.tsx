import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PostListItem } from "../api";

// Filtros de status (R4a): "" = ativos (API exclui trash por padrão).
const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Ativos" },
  { value: "publish", label: "Publicados" },
  { value: "draft", label: "Rascunhos" },
  { value: "pending", label: "Pendentes" },
  { value: "scheduled", label: "Agendados" },
  { value: "private", label: "Privados" },
  { value: "archived", label: "Arquivados" },
  { value: "trash", label: "Lixeira" },
];

// Ações de ciclo de vida disponíveis por status atual (R4/R4a/R4b).
type Action = { label: string; status?: string; del?: boolean; danger?: boolean };
function actionsFor(status: string): Action[] {
  switch (status) {
    case "publish":
      return [{ label: "Despublicar", status: "draft" }, { label: "Arquivar", status: "archived" }, { label: "Lixeira", status: "trash" }];
    case "archived":
      return [{ label: "Restaurar", status: "draft" }, { label: "Lixeira", status: "trash" }];
    case "trash":
      return [{ label: "Restaurar", status: "draft" }, { label: "Apagar", del: true, danger: true }];
    default: // draft / pending / scheduled / private
      return [{ label: "Publicar", status: "publish" }, { label: "Arquivar", status: "archived" }, { label: "Lixeira", status: "trash" }];
  }
}

export function PostsList() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const note = (msg: string, isErr = false) => { setToast({ msg, err: isErr }); setTimeout(() => setToast(null), 3500); };

  const load = (query = q, st = status) => {
    setLoading(true);
    api.listPosts(query, st).then(setItems).catch((e) => setErr(String(e.message))).finally(() => setLoading(false));
  };
  useEffect(() => { load("", ""); }, []);

  const run = async (p: PostListItem, a: Action) => {
    if (a.del && !window.confirm(`Apagar permanentemente "${p.title}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(p.id);
    try {
      const r = a.del ? await api.deletePost(p.id) : await api.setPostStatus(p.id, a.status!);
      const rebuilt = !a.del && (r as { rebuild?: { started?: boolean } }).rebuild?.started;
      note(a.del ? "Apagado permanentemente." : `Movido para "${a.status}".${rebuilt ? " Rebuild disparado." : ""}`);
      load();
    } catch (e) { note(String((e as Error).message), true); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="row">
        <h2 className="title">Posts</h2>
        <div className="spacer" />
        <Link className="btn primary" to="/posts/new">+ Novo post</Link>
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <input type="text" placeholder="Buscar por título…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} style={{ maxWidth: 280 }} />
        <button className="btn" onClick={() => load(q)}>Buscar</button>
        <div className="spacer" />
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); load(q, e.target.value); }}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="muted">Carregando…</p> : (
        <table>
          <thead><tr><th>Título</th><th>Status</th><th>Slug</th><th>Atualizado</th><th>Ações</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/posts/${p.id}`}>{p.title}</Link></td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td className="muted">{p.slug}</td>
                <td className="muted">{p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}</td>
                <td>
                  <div className="actions">
                    <Link className="btn tiny" to={`/posts/${p.id}`}>Editar</Link>
                    {p.status === "publish" && <a className="btn tiny" href={`/blog/${p.slug}/`} target="_blank" rel="noreferrer">Ver ↗</a>}
                    {actionsFor(p.status).map((a) => (
                      <button key={a.label} className={`btn tiny ${a.danger ? "danger" : ""}`}
                        disabled={busyId === p.id} onClick={() => run(p, a)}>{a.label}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted">Nenhum post.</td></tr>}
          </tbody>
        </table>
      )}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
