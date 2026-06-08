import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, openPreview, type PageFull, type MediaItem } from "../api";
import { BlockEditor, type EditorHandle } from "../editor/BlockEditor";
import { SeoPanel } from "../editor/SeoPanel";
import { MediaPicker } from "../media/MediaPicker";

const EMPTY: PageFull = {
  title: "", slug: "", excerpt: "", content_html: "", block_doc: null, status: "draft",
  seo_title: null, seo_description: null, canonical: null, og_title: null, og_description: null, og_image: null, noindex: false,
};

export function PageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [page, setPage] = useState<PageFull>(EMPTY);
  const [ready, setReady] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [origSlug, setOrigSlug] = useState("");
  const [origStatus, setOrigStatus] = useState("draft");
  const [picker, setPicker] = useState<null | "og" | "insert">(null);
  const editorRef = useRef<EditorHandle | null>(null);

  const onPickMedia = (m: MediaItem) => {
    if (picker === "og") set("og_image", m.url);
    else if (picker === "insert") editorRef.current?.insertImage(m.url, m.alt ?? undefined);
    setPicker(null);
  };

  const note = (msg: string, isErr = false) => { setToast({ msg, err: isErr }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    if (id) api.getPage(Number(id)).then((p) => {
      setPage({ ...EMPTY, ...p }); setOrigSlug(p.slug); setOrigStatus(p.status); setReady(true);
    }).catch((e) => setErr(String(e.message)));
  }, [id]);
  const slugChangedOnPublished = !isNew && origStatus === "publish" && page.slug !== origSlug;

  const set = <K extends keyof PageFull>(k: K, v: PageFull[K]) => setPage((p) => ({ ...p, [k]: v }));

  const suggestSlug = async () => {
    if (page.slug || !page.title) return;
    try { const r = await api.slugCheck("page", page.title, id ? Number(id) : undefined); set("slug", r.suggestion); } catch { /* noop */ }
  };

  // Persiste com o status dado; o servidor dispara o rebuild quando afeta o público.
  const persist = async (status: string, okMsg: string): Promise<number | null> => {
    setSaving(true); setErr("");
    try {
      const { html, blockDoc } = (await editorRef.current?.getContent()) ?? { html: page.content_html, blockDoc: page.block_doc };
      const body: Partial<PageFull> = { ...page, status, content_html: html, block_doc: blockDoc };
      const r = isNew ? await api.createPage(body) : await api.updatePage(Number(id), body);
      const msg = r.rebuild?.started ? `${okMsg} (rebuild disparado)` : r.rebuild?.busy ? `${okMsg} (rebuild já em curso)` : okMsg;
      if (isNew) { note(msg); navigate(`/pages/${r.id}`, { replace: true }); return r.id; }
      setPage((p) => ({ ...p, status, slug: r.slug })); note(msg); return Number(id);
    } catch (e) { setErr(String((e as Error).message)); note("Erro ao salvar.", true); return null; }
    finally { setSaving(false); }
  };

  const save = () => persist(page.status, page.status === "publish" ? "Publicado." : "Salvo.");
  const publish = () => persist("publish", "Publicado.");
  // Preview NÃO persiste/publica: renderiza o buffer atual do editor (stateless).
  const preview = async () => {
    try {
      const { html } = (await editorRef.current?.getContent()) ?? { html: page.content_html };
      openPreview(await api.previewHtml({ type: "page", title: page.title, status: page.status, content_html: html }));
    } catch (e) { note(String((e as Error).message), true); }
  };

  if (!ready) return <p className="muted">Carregando…</p>;
  return (
    <div>
      <div className="row">
        <h2 className="title">{isNew ? "Nova página" : "Editar página"}</h2>
        <span className={`badge ${page.status}`}>{page.status}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setPicker("insert")} disabled={saving}>🖼 Inserir imagem</button>
        <button className="btn" onClick={preview} disabled={saving}>Pré-visualizar ↗</button>
        <button className="btn" onClick={save} disabled={saving}>Salvar ({page.status})</button>
        <button className="btn primary" onClick={publish} disabled={saving}>Publicar</button>
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="editor-grid">
        <div>
          <div className="field-title"><input type="text" placeholder="Título da página" value={page.title}
            onChange={(e) => set("title", e.target.value)} onBlur={suggestSlug} /></div>
          <div className="bn-wrap">
            <BlockEditor handleRef={editorRef} initialHtml={page.content_html} initialBlockDoc={page.block_doc} />
          </div>
        </div>
        <aside>
          <div className="card">
            <h3>Publicação</h3>
            <label>Status</label>
            <select value={page.status} onChange={(e) => set("status", e.target.value)}>
              {["draft", "publish", "archived", "trash"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label>Slug</label>
            <div className="slug-row">
              <input type="text" value={page.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto do título" />
              <button className="btn" type="button" onClick={() => set("slug", "")} title="Re-sugerir">↻</button>
            </div>
            <p className="muted">URL: /{page.slug || "…"}/</p>
            {slugChangedOnPublished && <p className="warn">Mudar o slug de uma página publicada cria um 301 de /{origSlug}/ → novo slug.</p>}
          </div>
          <div className="card">
            <h3>Resumo</h3>
            <textarea value={page.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="vazio = auto do conteúdo" />
          </div>
          <SeoPanel
            value={page}
            onChange={(k, v) => set(k as keyof PageFull, v as never)}
            url={`https://beta.artificiorpg.com/${page.slug || "…"}/`}
            fallbackTitle={page.title}
            fallbackDescription={page.excerpt || page.seo_description || ""}
            onPickOgImage={() => setPicker("og")}
          />
        </aside>
      </div>
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
      {picker && <MediaPicker onPick={onPickMedia} onClose={() => setPicker(null)} />}
    </div>
  );
}
