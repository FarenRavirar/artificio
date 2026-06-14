import { useEffect, useState } from "react";
import { api, type FeedbackItem } from "../api";

const STATUS_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "triaged", label: "Triado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
  { value: "wont_fix", label: "Não será corrigido" },
  { value: "duplicate", label: "Duplicado" },
];

const len = (v: unknown[]): number => (Array.isArray(v) ? v.length : 0);

export function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [archived, setArchived] = useState("false");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const note = (msg: string, isErr = false) => { setToast({ msg, err: isErr }); setTimeout(() => setToast(null), 3500); };

  const load = (st = status, kd = kind, ar = archived) => {
    setLoading(true);
    setErr("");
    api.listFeedback(st, kd, ar)
      .then((rows) => { setItems(rows); setNotes(Object.fromEntries(rows.map((r) => [r.id, r.admin_notes ?? ""]))); })
      .catch((e) => setErr(String(e.message)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const patch = async (it: FeedbackItem, body: { status?: string; admin_notes?: string | null; archived?: boolean }, okMsg: string) => {
    setBusyId(it.id);
    try { await api.updateFeedback(it.id, body); note(okMsg); load(); }
    catch (e) { note(String((e as Error).message), true); }
    finally { setBusyId(null); }
  };

  const remove = async (it: FeedbackItem) => {
    if (!window.confirm(`Excluir "${it.title}" definitivamente?`)) return;
    setBusyId(it.id);
    try { await api.deleteFeedback(it.id); note("Excluído."); load(); }
    catch (e) { note(String((e as Error).message), true); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="row">
        <h2 className="title">Feedback</h2>
        <div className="spacer" />
        <button className="btn" onClick={() => load()}>Atualizar</button>
      </div>
      {err && <div className="err-box">{err}</div>}

      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value, kind, archived); }}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Tipo
          <select value={kind} onChange={(e) => { setKind(e.target.value); load(status, e.target.value, archived); }}>
            <option value="">Todos</option>
            <option value="bug">Problema</option>
            <option value="suggestion">Sugestão</option>
          </select>
        </label>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Arquivados
          <select value={archived} onChange={(e) => { setArchived(e.target.value); load(status, kind, e.target.value); }}>
            <option value="false">Ativos</option>
            <option value="true">Só arquivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>

      {loading ? <p className="muted">Carregando…</p> : !items.length ? (
        <p className="muted">Nenhum feedback.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => (
            <article key={it.id} style={{ border: "1px solid var(--line, #ddd)", borderRadius: 12, padding: 16 }}>
              <div className="row">
                <span className={`badge ${it.kind}`}>{it.kind === "bug" ? "🐞 Problema" : "💡 Sugestão"}</span>
                <strong style={{ marginLeft: 8 }}>{it.title}</strong>
                <div className="spacer" />
                <span className="muted">{new Date(it.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{it.description}</p>
              <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                <span>De: {it.reporter_id ? `user ${it.reporter_id}` : "Anônimo"}{it.contact_email ? ` (${it.contact_email})` : ""}</span>
                <span>Página: {it.route_path || "—"}</span>
                <span>Ambiente: {it.environment || "—"}</span>
                <span>Tela: {it.viewport || "—"}</span>
                <span>Erros: {len(it.console_errors)} console / {len(it.network_errors)} rede</span>
                {it.screenshot_url && <a href={it.screenshot_url} target="_blank" rel="noreferrer">Ver captura ↗</a>}
              </div>

              <div className="row" style={{ marginTop: 12, gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <select value={it.status} disabled={busyId === it.id}
                  onChange={(e) => patch(it, { status: e.target.value }, "Status atualizado.")}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <textarea value={notes[it.id] ?? ""} rows={2} placeholder="Notas internas (admin)"
                  style={{ flex: 1, minWidth: 220 }}
                  onChange={(e) => setNotes((p) => ({ ...p, [it.id]: e.target.value }))} />
              </div>
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn tiny" disabled={busyId === it.id}
                  onClick={() => patch(it, { admin_notes: notes[it.id] ?? "" }, "Notas salvas.")}>Salvar notas</button>
                <button className="btn tiny" disabled={busyId === it.id}
                  onClick={() => patch(it, { archived: it.archived_at === null }, it.archived_at === null ? "Arquivado." : "Desarquivado.")}>
                  {it.archived_at === null ? "Arquivar" : "Desarquivar"}
                </button>
                <button className="btn tiny danger" disabled={busyId === it.id} onClick={() => remove(it)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
