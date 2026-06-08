// Biblioteca de mídia (spec 011, T19). Grid + upload + busca/filtro + editar metadados/apagar.
// Reutilizável: com `onPick` vira seletor (modal); sem, é a tela de gerência.
import { useEffect, useRef, useState } from "react";
import { api, type MediaItem } from "../api";

const TYPES = [{ v: "", l: "Todos" }, { v: "image", l: "Imagens" }, { v: "audio", l: "Áudio" }, { v: "video", l: "Vídeo" }];

const isImage = (m: MediaItem) => (m.mime ?? "").startsWith("image/");
const kb = (n: number | null) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function MediaLibrary({ onPick }: { onPick?: (item: MediaItem) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (qq = q, tt = type) => {
    api.listMedia(qq, tt).then((r) => { setItems(r.items); setTotal(r.total); }).catch((e) => setErr(String(e.message)));
  };
  useEffect(() => { load("", ""); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr("");
    try { for (const f of Array.from(files)) await api.uploadMedia(f, { title: f.name }); load(); }
    catch (e) { setErr(String((e as Error).message)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const saveMeta = async () => {
    if (!sel) return;
    try { await api.updateMedia(sel.id, { alt: sel.alt, caption: sel.caption, title: sel.title }); load(); }
    catch (e) { setErr(String((e as Error).message)); }
  };
  const del = async (it: MediaItem) => {
    if (!window.confirm(`Apagar "${it.title || it.url}"? Referências no conteúdo (por URL) não são removidas.`)) return;
    try { await api.deleteMedia(it.id); if (sel?.id === it.id) setSel(null); load(); }
    catch (e) { setErr(String((e as Error).message)); }
  };

  return (
    <div className="media-wrap">
      <div className="row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <input type="text" placeholder="Buscar (título/alt/URL)…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} style={{ maxWidth: 240 }} />
        <select value={type} onChange={(e) => { setType(e.target.value); load(q, e.target.value); }}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <button className="btn" onClick={() => load(q)}>Buscar</button>
        <div className="spacer" />
        <input ref={fileRef} type="file" multiple accept="image/*,audio/*,video/*" style={{ display: "none" }}
          onChange={(e) => onFiles(e.target.files)} />
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Enviando…" : "↑ Enviar mídia"}
        </button>
      </div>
      {err && <div className="err-box">{err}</div>}

      <div className="media-grid">
        {items.map((m) => (
          <div key={m.id} className={`media-cell ${sel?.id === m.id ? "on" : ""}`}
            onClick={() => setSel(m)}
            onDoubleClick={() => onPick?.(m)}
            title={m.title || m.url}>
            <div className="media-thumb">
              {isImage(m) ? <img src={m.url} alt={m.alt ?? ""} loading="lazy" /> : <span className="media-ph">{(m.mime ?? "?").split("/")[0]}</span>}
            </div>
            <div className="media-name">{m.title || m.url.split("/").pop()}</div>
            {onPick && <button className="btn tiny media-pick" onClick={(e) => { e.stopPropagation(); onPick(m); }}>Usar</button>}
          </div>
        ))}
        {!items.length && <p className="muted">Nenhuma mídia. Envie a primeira.</p>}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>{total} item(ns).</p>

      {sel && (
        <div className="media-detail card">
          <div className="row"><h3 style={{ margin: 0 }}>Detalhes</h3><div className="spacer" /><button className="btn tiny" onClick={() => setSel(null)}>fechar</button></div>
          {isImage(sel) && <img className="media-detail-img" src={sel.url} alt={sel.alt ?? ""} />}
          <p className="muted" style={{ wordBreak: "break-all" }}>{sel.url}</p>
          <p className="muted">{sel.mime} · {[sel.width && `${sel.width}×${sel.height}`, kb(sel.size_bytes), sel.source].filter(Boolean).join(" · ")}</p>
          <label>Título</label>
          <input type="text" value={sel.title ?? ""} onChange={(e) => setSel({ ...sel, title: e.target.value })} />
          <label>Texto alternativo (alt)</label>
          <input type="text" value={sel.alt ?? ""} onChange={(e) => setSel({ ...sel, alt: e.target.value })} placeholder="descreve a imagem (acessibilidade + SEO)" />
          <label>Legenda</label>
          <input type="text" value={sel.caption ?? ""} onChange={(e) => setSel({ ...sel, caption: e.target.value })} />
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn" onClick={saveMeta}>Salvar metadados</button>
            <div className="spacer" />
            {onPick && <button className="btn primary" onClick={() => onPick(sel)}>Usar esta</button>}
            <button className="btn danger" onClick={() => del(sel)}>Apagar</button>
          </div>
        </div>
      )}
    </div>
  );
}
