import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PostListItem } from "../api";

export function PostsList() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (query = "") => {
    setLoading(true);
    api.listPosts(query).then(setItems).catch((e) => setErr(String(e.message))).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="row">
        <h2 className="title">Posts</h2>
        <div className="spacer" />
        <Link className="btn primary" to="/posts/new">+ Novo post</Link>
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="row" style={{ marginBottom: 14 }}>
        <input type="text" placeholder="Buscar por título…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} style={{ maxWidth: 320 }} />
        <button className="btn" onClick={() => load(q)}>Buscar</button>
      </div>
      {loading ? <p className="muted">Carregando…</p> : (
        <table>
          <thead><tr><th>Título</th><th>Status</th><th>Slug</th><th>Atualizado</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/posts/${p.id}`}>{p.title}</Link></td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td className="muted">{p.slug}</td>
                <td className="muted">{p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted">Nenhum post.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
