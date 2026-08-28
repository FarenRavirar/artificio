import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, openPreview, type PostFull, type Term, type MediaItem, type ContentId } from "../api";
import { BlockEditor, type EditorHandle } from "../editor/BlockEditor";
import { SeoPanel } from "../editor/SeoPanel";
import { MediaPicker } from "../media/MediaPicker";

const EMPTY: PostFull = {
  title: "", slug: "", excerpt: "", content_html: "", block_doc: null, status: "draft",
  published_at: null, featured_url: null, seo_title: null, seo_description: null, canonical: null,
  og_title: null, og_description: null, og_image: null, twitter_card: "summary_large_image",
  noindex: false, cats: [], tags: [],
};

export function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [post, setPost] = useState<PostFull>(EMPTY);
  const [terms, setTerms] = useState<Term[]>([]);
  const [ready, setReady] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [err, setErr] = useState("");
  // Slug honesto (R4/R27): disponibilidade ao vivo + aviso de 301 ao mudar slug publicado.
  const [origSlug, setOrigSlug] = useState("");
  const [origStatus, setOrigStatus] = useState("draft");
  // Guarda o slug consultado e o veredito da API (não um booleano solto): assim o estado
  // é derivado no render comparando com o slug atual, sem setState de limpeza no efeito.
  // `"unknown"` existe porque resposta inválida não pode virar "disponível" (R3a [P0]).
  const [slugCheckResult, setSlugCheckResult] = useState<{ slug: string; available: boolean | "unknown" } | null>(null);
  // Seletor de mídia: alvo do pick (imagem destacada, OG, ou inserir no texto).
  const [picker, setPicker] = useState<null | "featured" | "og" | "insert">(null);
  const editorRef = useRef<EditorHandle | null>(null);

  const onPickMedia = (m: MediaItem) => {
    if (picker === "featured") set("featured_url", m.url);
    else if (picker === "og") set("og_image", m.url);
    else if (picker === "insert") editorRef.current?.insertImage(m.url, m.alt ?? undefined);
    setPicker(null);
  };

  const note = (msg: string, isErr = false) => { setToast({ msg, err: isErr }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    // Falha aqui não bloqueia a edição (o post salva sem mexer em taxonomia), mas some com
    // os checkboxes de categoria/tag — engolir o erro faria o autor achar que o post não
    // tem categorias em vez de saber que a lista não carregou (achado Codex P2 na #267).
    api.listTerms().then(setTerms).catch((e) => note(`Categorias e tags não carregaram: ${String((e as Error).message)}`, true));
    if (id) {
      api.getPost(Number(id)).then((p) => {
        setPost({ ...EMPTY, ...p }); setOrigSlug(p.slug); setOrigStatus(p.status); setReady(true);
      }).catch((e) => setErr(String(e.message)));
    }
  }, [id]);

  // Checa disponibilidade do slug (debounce) quando o usuário edita manualmente.
  // O caso "slug vazio" não zera o state dentro do efeito (seria setState síncrono →
  // render em cascata): a resposta guarda o slug consultado e o veredito é derivado
  // abaixo, então um slug vazio simplesmente deixa de casar e a marca some sozinha.
  useEffect(() => {
    if (!post.slug) return;
    // `clearTimeout` só cancela request ainda não disparada. Passados os 400ms, a
    // resposta em voo continua chegando mesmo após o slug mudar — daí o guard de efeito
    // ativo, senão um resultado velho sobrescreve o do slug atual (achado de review #265).
    let active = true;
    // Guarda o slug **consultado**, não o `r.slug` devolvido: o servidor normaliza
    // ("Foo Bar" → "foo-bar") e comparar com a forma normalizada nunca casaria com o que
    // está no input, escondendo o aviso de slug em uso (achado de review #265).
    const queried = post.slug;
    const t = setTimeout(() => {
      api.slugCheck("post", queried, id ? Number(id) : undefined)
        .then((r) => { if (active) setSlugCheckResult({ slug: queried, available: r.available }); })
        // Falha de rede também é desconhecido, não disponível: sem isso o autor salvaria
        // sem aviso e o servidor trocaria o slug por baixo (R3a [P0] da spec 011).
        .catch(() => { if (active) setSlugCheckResult({ slug: queried, available: "unknown" }); });
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [post.slug, id]);
  // Derivados do render: só valem enquanto o slug atual for exatamente o que foi consultado.
  const slugChecked = !!post.slug && slugCheckResult?.slug === post.slug;
  const slugTaken = slugChecked && slugCheckResult?.available === false;
  const slugUnknown = slugChecked && slugCheckResult?.available === "unknown";
  const slugChangedOnPublished = !isNew && origStatus === "publish" && post.slug !== origSlug;

  const set = <K extends keyof PostFull>(k: K, v: PostFull[K]) => setPost((p) => ({ ...p, [k]: v }));

  // Compara por String() de propósito: `id` é BIGINT e o driver `pg` o devolve como string,
  // mas nem todo caminho do payload garante a mesma forma — `cats` pode chegar `[12]` e o
  // `termId` do checkbox `"12"`. Com `includes`/`!==` estritos isso nunca casa: a marcação
  // não aparece e o toggle duplica a entrada, sem erro de tipo que denuncie.
  const sameId = (a: ContentId, b: ContentId) => String(a) === String(b);

  const toggleTerm = (termId: ContentId, kind: "category" | "tag") => {
    const key = kind === "category" ? "cats" : "tags";
    const cur = post[key];
    const marcado = cur.some((x) => sameId(x, termId));
    set(key, marcado ? cur.filter((x) => !sameId(x, termId)) : [...cur, termId]);
  };

  const suggestSlug = async () => {
    if (post.slug || !post.title) return;
    try { const r = await api.slugCheck("post", post.title, id ? Number(id) : undefined); set("slug", r.suggestion); } catch { /* noop */ }
  };

  const collect = async (status: string): Promise<Partial<PostFull>> => {
    const { html, blockDoc } = (await editorRef.current?.getContent()) ?? { html: post.content_html, blockDoc: post.block_doc };
    return { ...post, status, content_html: html, block_doc: blockDoc };
  };

  // Persiste com o status dado. O servidor dispara o rebuild quando o status afeta o público
  // (publicar/despublicar) — sem 2ª requisição do cliente.
  const persist = async (status: string, okMsg: string): Promise<number | null> => {
    setSaving(true); setErr("");
    try {
      const body = await collect(status);
      const r = isNew ? await api.createPost(body) : await api.updatePost(Number(id), body);
      const msg = r.rebuild?.started ? `${okMsg} (rebuild disparado)` : r.rebuild?.busy ? `${okMsg} (rebuild já em curso)` : okMsg;
      if (isNew) { note(msg); navigate(`/posts/${r.id}`, { replace: true }); return r.id; }
      setPost((p) => ({ ...p, status, slug: r.slug })); note(msg); return Number(id);
    } catch (e) { setErr(String((e as Error).message)); note("Erro ao salvar.", true); return null; }
    finally { setSaving(false); }
  };

  const save = () => persist(post.status, post.status === "publish" ? "Publicado." : "Salvo.");
  const publish = () => persist("publish", "Publicado.");
  // Preview NÃO persiste/publica: renderiza o buffer atual do editor (stateless).
  const preview = async () => {
    try {
      const { html } = (await editorRef.current?.getContent()) ?? { html: post.content_html };
      openPreview(await api.previewHtml({ type: "post", title: post.title, status: post.status, content_html: html }));
    } catch (e) { note(String((e as Error).message), true); }
  };

  const addTerm = async (kind: "category" | "tag") => {
    const name = prompt(`Nome da nova ${kind === "category" ? "categoria" : "tag"}:`);
    if (!name) return;
    try { const t = await api.createTerm(kind, name); setTerms((ts) => [...ts, t]); toggleTerm(t.id, kind); }
    catch (e) { note(String((e as Error).message), true); }
  };

  if (!ready) return <p className="muted">Carregando…</p>;
  const cats = terms.filter((t) => t.kind === "category");
  const tags = terms.filter((t) => t.kind === "tag");

  return (
    <div>
      <div className="row">
        <h2 className="title">{isNew ? "Novo post" : "Editar post"}</h2>
        <span className={`badge ${post.status}`}>{post.status}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setPicker("insert")} disabled={saving}>🖼 Inserir imagem</button>
        <button className="btn" onClick={preview} disabled={saving}>Pré-visualizar ↗</button>
        <button className="btn" onClick={save} disabled={saving}>Salvar ({post.status})</button>
        <button className="btn primary" onClick={publish} disabled={saving}>Publicar</button>
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="editor-grid">
        <div>
          <div className="field-title"><input type="text" placeholder="Título do post" value={post.title}
            onChange={(e) => set("title", e.target.value)} onBlur={suggestSlug} /></div>
          <div className="bn-wrap">
            <BlockEditor handleRef={editorRef} initialHtml={post.content_html} initialBlockDoc={post.block_doc} />
          </div>
        </div>

        <aside>
          <div className="card">
            <h3>Publicação</h3>
            <label>Status</label>
            <select value={post.status} onChange={(e) => set("status", e.target.value)}>
              {["draft", "pending", "publish", "archived", "trash"].map((s) => <option key={s} value={s}>{s}</option>)}
              {/* scheduled/private ainda sem job/regra de acesso reais (R4/CA2c): desabilitados p/ não prometer o que não existe */}
              <option value="scheduled" disabled>scheduled (indisponível)</option>
              <option value="private" disabled>private (indisponível)</option>
            </select>
            {(post.status === "scheduled" || post.status === "private") && (
              <p className="warn">"{post.status}" ainda não tem agendamento/controle de acesso reais. Use draft ou publish.</p>
            )}
            <label>Slug</label>
            <div className="slug-row">
              <input type="text" value={post.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto do título" />
              <button className="btn" type="button" onClick={() => set("slug", "")} title="Re-sugerir">↻</button>
            </div>
            <p className="muted">URL: /blog/{post.slug || "…"}/</p>
            {slugTaken && <p className="warn">Slug já em uso — será ajustado para um único ao salvar.</p>}
            {/* Incerteza é exibida, não escondida: se a checagem falhou, o autor precisa saber
                que o slug pode ser trocado no salvamento (R3a [P0] da spec 011). */}
            {slugUnknown && <p className="warn">Não foi possível verificar se este slug está livre — se houver colisão, ele será ajustado ao salvar.</p>}
            {slugChangedOnPublished && <p className="warn">Mudar o slug de um post publicado cria um 301 de /blog/{origSlug}/ → novo slug.</p>}
            <label>Data de publicação</label>
            <input type="text" value={post.published_at ?? ""} placeholder="ISO (vazio = agora ao publicar)"
              onChange={(e) => set("published_at", e.target.value || null)} />
          </div>

          <div className="card">
            <h3>Resumo & imagem</h3>
            <label>Resumo (excerpt)</label>
            <textarea value={post.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="vazio = auto do conteúdo" />
            <label>Imagem destacada</label>
            {post.featured_url && <img className="featured-thumb" src={post.featured_url} alt="" />}
            <div className="slug-row">
              <input type="url" value={post.featured_url ?? ""} placeholder="URL ou escolha da biblioteca"
                onChange={(e) => set("featured_url", e.target.value || null)} />
              <button className="btn" type="button" onClick={() => setPicker("featured")}>Biblioteca</button>
            </div>
            {post.featured_url && <button className="btn tiny" type="button" onClick={() => set("featured_url", null)}>remover</button>}
          </div>

          <div className="card">
            <h3>Categorias <button className="btn" type="button" style={{ float: "right", padding: "2px 8px" }} onClick={() => addTerm("category")}>+</button></h3>
            <div className="checks">
              {cats.map((t) => (
                <label key={t.id}><input type="checkbox" checked={post.cats.some((x) => sameId(x, t.id))} onChange={() => toggleTerm(t.id, "category")} />{t.name}</label>
              ))}
              {!cats.length && <p className="muted">Nenhuma. Crie com +</p>}
            </div>
            <h3 style={{ marginTop: 14 }}>Tags <button className="btn" type="button" style={{ float: "right", padding: "2px 8px" }} onClick={() => addTerm("tag")}>+</button></h3>
            <div className="checks">
              {tags.map((t) => (
                <label key={t.id}><input type="checkbox" checked={post.tags.some((x) => sameId(x, t.id))} onChange={() => toggleTerm(t.id, "tag")} />{t.name}</label>
              ))}
              {!tags.length && <p className="muted">Nenhuma. Crie com +</p>}
            </div>
          </div>

          <SeoPanel
            value={post}
            onChange={(k, v) => set(k as keyof PostFull, v as never)}
            url={`https://artificiorpg.com/blog/${post.slug || "…"}/`}
            fallbackTitle={post.title}
            fallbackDescription={post.excerpt || post.seo_description || ""}
            fallbackImage={post.featured_url}
            showTwitter
            onPickOgImage={() => setPicker("og")}
          />
        </aside>
      </div>
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
      {picker && <MediaPicker onPick={onPickMedia} onClose={() => setPicker(null)} />}
    </div>
  );
}
