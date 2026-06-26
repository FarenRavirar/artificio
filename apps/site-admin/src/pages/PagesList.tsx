import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "@artificio/ui";
import { api, type PageListItem } from "../api";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Ativas" },
  { value: "publish", label: "Publicadas" },
  { value: "draft", label: "Rascunhos" },
  { value: "archived", label: "Arquivadas" },
  { value: "trash", label: "Lixeira" },
];

type Action = { label: string; status?: string; del?: boolean; danger?: boolean };
function actionsFor(status: string): Action[] {
  switch (status) {
    case "publish":
      return [{ label: "Despublicar", status: "draft" }, { label: "Arquivar", status: "archived" }, { label: "Lixeira", status: "trash" }];
    case "archived":
      return [{ label: "Restaurar", status: "draft" }, { label: "Lixeira", status: "trash" }];
    case "trash":
      return [{ label: "Restaurar", status: "draft" }, { label: "Apagar", del: true, danger: true }];
    default:
      return [{ label: "Publicar", status: "publish" }, { label: "Arquivar", status: "archived" }, { label: "Lixeira", status: "trash" }];
  }
}

export function PagesList() {
  const [items, setItems] = useState<PageListItem[]>([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const { confirm } = useConfirm();

  const note = (msg: string, isErr = false) => { setToast({ msg, err: isErr }); setTimeout(() => setToast(null), 3500); };

  const load = (st = status) => {
    setLoading(true);
    api.listPages("", st).then(setItems).catch((e) => setErr(String(e.message))).finally(() => setLoading(false));
  };
  useEffect(() => { load(""); }, []);

  const run = async (p: PageListItem, a: Action) => {
    if (a.del) {
      const ok = await confirm({
        title: "Apagar página",
        message: `Apagar permanentemente "${p.title}"? Esta ação não pode ser desfeita.`,
        confirmText: "Apagar",
        variant: "danger",
      });
      if (!ok) return;
    }
    setBusyId(p.id);
    try {
      const r = a.del ? await api.deletePage(p.id) : await api.setPageStatus(p.id, a.status!);
      const rebuilt = !a.del && (r as { rebuild?: { started?: boolean } }).rebuild?.started;
      note(a.del ? "Apagada permanentemente." : `Movida para "${a.status}".${rebuilt ? " Rebuild disparado." : ""}`);
      load();
    } catch (e) { note(String((e as Error).message), true); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="row">
        <h2 className="title">Páginas</h2>
        <div className="spacer" />
        <Link className="btn primary" to="/pages/new">+ Nova página</Link>
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="spacer" />
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value); }}>
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
                <td><Link to={`/pages/${p.id}`}>{p.title}</Link></td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td className="muted">/{p.slug}/</td>
                <td className="muted">{p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}</td>
                <td>
                  <div className="actions">
                    <Link className="btn tiny" to={`/pages/${p.id}`}>Editar</Link>
                    {p.status === "publish" && <a className="btn tiny" href={`/${p.slug}/`} target="_blank" rel="noreferrer">Ver ↗</a>}
                    {actionsFor(p.status).map((a) => (
                      <button key={a.label} className={`btn tiny ${a.danger ? "danger" : ""}`}
                        disabled={busyId === p.id} onClick={() => run(p, a)}>{a.label}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="muted">Nenhuma página.</td></tr>}
          </tbody>
        </table>
      )}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
