import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PageListItem } from "../api";

export function PagesList() {
  const [items, setItems] = useState<PageListItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listPages().then(setItems).catch((e) => setErr(String(e.message))).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="row">
        <h2 className="title">Páginas</h2>
        <div className="spacer" />
        <Link className="btn primary" to="/pages/new">+ Nova página</Link>
      </div>
      {err && <div className="err-box">{err}</div>}
      {loading ? <p className="muted">Carregando…</p> : (
        <table>
          <thead><tr><th>Título</th><th>Status</th><th>Slug</th><th>Atualizado</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/pages/${p.id}`}>{p.title}</Link></td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td className="muted">/{p.slug}/</td>
                <td className="muted">{p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted">Nenhuma página.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
