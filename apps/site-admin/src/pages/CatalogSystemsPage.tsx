import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogExplorer, type CatalogUiNode, type CatalogUiNodeInput } from "@artificio/catalog-ui";
import { api, type CatalogNode, type CatalogNodeInput, type CatalogSnapshot } from "../api";

/** Converte CatalogNode (API do site-admin, aliases como objeto CatalogAlias)
 * para CatalogUiNode (pacote compartilhado, aliases como string[]). */
function toUiNode(node: CatalogNode): CatalogUiNode {
  return {
    id: node.id,
    parent_id: node.parent_id,
    node_type: node.node_type,
    name: node.name,
    name_pt: node.name_pt,
    canonical_slug: node.canonical_slug,
    path_slug: node.path_slug,
    description: node.description,
    official_website_url: node.official_website_url,
    logo_media_id: node.logo_media_id,
    status: node.status,
    aliases: (Array.isArray(node.aliases) ? node.aliases : []).map((alias) => alias.alias),
    children: (Array.isArray(node.children) ? node.children : []).map(toUiNode),
  };
}

function toNodeInput(form: CatalogUiNodeInput): CatalogNodeInput {
  return {
    parent_id: form.parent_id,
    node_type: form.node_type,
    canonical_slug: form.canonical_slug,
    name: form.name,
    name_pt: form.name_pt,
    description: form.description,
    official_website_url: form.official_website_url,
    logo_media_id: form.logo_media_id,
    status: form.status,
    aliases: form.aliases,
  };
}

export function CatalogSystemsPage() {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  // `?? []` cobre null/undefined, mas não `tree` vindo como não-array do cast cru de
  // `req<T>` — aí o `.map` quebraria a tela (achado de review #265).
  const uiTree = useMemo(() => (Array.isArray(snapshot?.tree) ? snapshot.tree : []).map(toUiNode), [snapshot]);

  const note = (msg: string, isErr = false) => {
    setToast({ msg, err: isErr });
    setTimeout(() => setToast(null), 3500);
  };

  // `fetchSnapshot` não mexe em estado de forma síncrona: quem chama decide quando marcar
  // `loading`/limpar o erro. Isso permite que a carga inicial rode dentro do efeito sem
  // render em cascata (react-hooks/set-state-in-effect) — `loading` já nasce `true` e
  // `err` já nasce vazio.
  const fetchSnapshot = useCallback(() => {
    api.getCatalogSnapshot()
      .then(setSnapshot)
      .catch((e) => setErr(String((e as Error).message)))
      .finally(() => setLoading(false));
  }, []);

  // Recarga disparada por evento (salvar/remover nó): aí sim reseta antes.
  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => { fetchSnapshot(); }, [fetchSnapshot]);

  const saveNode = async (form: CatalogUiNodeInput, selected: CatalogUiNode | null) => {
    setSaving(true);
    try {
      const body = toNodeInput(form);
      const node = selected
        ? await api.updateCatalogNode(selected.id, body)
        : await api.createCatalogNode(body);
      note(selected ? "Nó atualizado." : "Nó criado.");
      setSelectedIds([node.id]);
      try {
        await api.getCatalogSnapshot().then(setSnapshot);
      } catch (refreshError) {
        note(`Nó salvo, mas falha ao atualizar a árvore: ${String((refreshError as Error).message)}`, true);
      }
    } catch (e) {
      note(String((e as Error).message), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="row wrap">
        <h2 className="title">Catálogo de sistemas</h2>
        <div className="spacer" />
        <button className="btn" onClick={load}>Atualizar</button>
        <button className="btn primary" onClick={() => setSelectedIds([])}>+ Sistema</button>
      </div>

      {snapshot && (
        <div className="catalog-kpis">
          <span><b>{snapshot.nodes_count}</b> nós ativos</span>
          <span><b>v{snapshot.catalog_version}</b> versão</span>
          <span title={snapshot.checksum}>checksum {snapshot.checksum.slice(0, 12)}</span>
          <span>{new Date(snapshot.generated_at).toLocaleString("pt-BR")}</span>
        </div>
      )}
      {err && <div className="err-box">{err}</div>}

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="catalog-layout">
          <section className="card catalog-tree-panel">
            <CatalogExplorer
              tree={uiTree}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              idPrefix="catalog-admin"
              mode="single"
              role="admin"
              searchPlaceholder="Buscar por nome, slug, caminho ou alias"
              onSaveNode={saveNode}
              saving={saving}
            />
          </section>
        </div>
      )}

      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
