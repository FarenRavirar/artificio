import { useEffect, useMemo, useState } from "react";
import { CatalogExplorer, type CatalogUiNode, type CatalogUiNodeInput } from "@artificio/catalog-ui";
import { api, type CatalogNode, type CatalogNodeInput, type CatalogSnapshot } from "../api";

/** Converte CatalogNode (API do site-admin, aliases como objeto CatalogAlias)
 * para CatalogUiNode (pacote compartilhado, aliases como string[]). */
function toUiNode(node: CatalogNode): CatalogUiNode {
  return {
    ...node,
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

  const uiTree = useMemo(() => (snapshot?.tree ?? []).map(toUiNode), [snapshot]);

  const note = (msg: string, isErr = false) => {
    setToast({ msg, err: isErr });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    setLoading(true);
    setErr("");
    api.getCatalogSnapshot()
      .then(setSnapshot)
      .catch((e) => setErr(String((e as Error).message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveNode = async (form: CatalogUiNodeInput, selected: CatalogUiNode | null) => {
    setSaving(true);
    try {
      const body = toNodeInput(form);
      const node = selected
        ? await api.updateCatalogNode(selected.id, body)
        : await api.createCatalogNode(body);
      note(selected ? "Nó atualizado." : "Nó criado.");
      await api.getCatalogSnapshot().then(setSnapshot);
      setSelectedIds([node.id]);
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
