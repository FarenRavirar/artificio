import { useEffect, useMemo, useState } from "react";
import { api, type CatalogNode, type CatalogNodeInput, type CatalogSnapshot } from "../api";

const NODE_TYPES: Array<{ value: CatalogNode["node_type"]; label: string }> = [
  { value: "system", label: "Sistema" },
  { value: "edition", label: "Edição" },
  { value: "subsystem", label: "Subsistema" },
  { value: "variant", label: "Variante" },
];

const emptyForm: CatalogNodeInput = {
  parent_id: null,
  node_type: "system",
  canonical_slug: "",
  name: "",
  name_pt: "",
  description: "",
  official_website_url: "",
  logo_media_id: "",
  status: "active",
  aliases: [],
};

export function CatalogSystemsPage() {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [selected, setSelected] = useState<CatalogNode | null>(null);
  const [form, setForm] = useState<CatalogNodeInput>(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const flatNodes = useMemo(() => flatten(snapshot?.tree ?? []), [snapshot]);
  const visibleTree = useMemo(() => filterTree(snapshot?.tree ?? [], query), [snapshot, query]);

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

  const selectNode = (node: CatalogNode) => {
    setSelected(node);
    setForm({
      parent_id: node.parent_id,
      node_type: node.node_type,
      canonical_slug: node.canonical_slug,
      name: node.name,
      name_pt: node.name_pt ?? "",
      description: node.description ?? "",
      official_website_url: node.official_website_url ?? "",
      logo_media_id: node.logo_media_id ?? "",
      status: node.status,
      aliases: Array.isArray(node.aliases) ? node.aliases.map((alias) => alias.alias) : [],
    });
  };

  const startNew = (parent?: CatalogNode) => {
    setSelected(null);
    setForm({
      ...emptyForm,
      parent_id: parent?.id ?? null,
      node_type: parent ? nextChildType(parent.node_type) : "system",
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = sanitizeForm(form);
      const node = selected
        ? await api.updateCatalogNode(selected.id, body)
        : await api.createCatalogNode(body);
      note(selected ? "Nó atualizado." : "Nó criado.");
      await api.getCatalogSnapshot().then(setSnapshot);
      selectNode(node);
    } catch (e) {
      note(String((e as Error).message), true);
    } finally {
      setSaving(false);
    }
  };

  // Sonar (achado PR #144): ternário aninhado extraído — evita a leitura
  // condicional-dentro-de-condicional inline no JSX.
  const renderTreePanel = () => {
    if (loading) return <p className="muted">Carregando...</p>;
    if (visibleTree.length === 0) return <p className="muted">Nenhum nó encontrado.</p>;
    return (
      <div className="catalog-tree">
        {visibleTree.map((node) => (
          <CatalogTreeNode
            key={node.id}
            node={node}
            selectedId={selected?.id ?? null}
            onSelect={selectNode}
            onCreateChild={startNew}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="row wrap">
        <h2 className="title">Catálogo de sistemas</h2>
        <div className="spacer" />
        <button className="btn" onClick={load}>Atualizar</button>
        <button className="btn primary" onClick={() => startNew()}>+ Sistema</button>
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

      <div className="catalog-layout">
        <section className="card catalog-tree-panel">
          <div className="row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, slug, caminho ou alias"
              aria-label="Buscar no catálogo"
            />
          </div>
          {renderTreePanel()}
        </section>

        <aside className="card catalog-editor">
          <h3>{selected ? "Editar nó" : "Novo nó"}</h3>
          <label htmlFor="catalog-node-type">Tipo</label>
          <select
            id="catalog-node-type"
            value={form.node_type}
            onChange={(e) => setForm((current) => ({ ...current, node_type: e.target.value as CatalogNode["node_type"] }))}
          >
            {NODE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>

          <label htmlFor="catalog-node-parent">Pai</label>
          <select
            id="catalog-node-parent"
            value={form.parent_id ?? ""}
            onChange={(e) => setForm((current) => ({ ...current, parent_id: e.target.value || null }))}
          >
            <option value="">Raiz</option>
            {flatNodes.map((node) => (
              <option key={node.id} value={node.id}>{node.path_slug}</option>
            ))}
          </select>

          <label htmlFor="catalog-node-name">Nome</label>
          <input id="catalog-node-name" type="text" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />

          <label htmlFor="catalog-node-name-pt">Nome PT</label>
          <input id="catalog-node-name-pt" type="text" value={form.name_pt ?? ""} onChange={(e) => setForm((current) => ({ ...current, name_pt: e.target.value }))} />

          <label htmlFor="catalog-node-slug">Slug</label>
          <input id="catalog-node-slug" type="text" value={form.canonical_slug ?? ""} onChange={(e) => setForm((current) => ({ ...current, canonical_slug: e.target.value }))} />

          <label htmlFor="catalog-node-aliases">Aliases</label>
          <textarea
            id="catalog-node-aliases"
            rows={3}
            value={(form.aliases ?? []).join("\n")}
            onChange={(e) => setForm((current) => ({ ...current, aliases: e.target.value.split("\n") }))}
            placeholder="Um alias por linha"
          />

          <label htmlFor="catalog-node-logo">Logo</label>
          <input id="catalog-node-logo" type="text" value={form.logo_media_id ?? ""} onChange={(e) => setForm((current) => ({ ...current, logo_media_id: e.target.value }))} />

          <label htmlFor="catalog-node-website">Website Oficial</label>
          <input id="catalog-node-website" type="url" value={form.official_website_url ?? ""} onChange={(e) => setForm((current) => ({ ...current, official_website_url: e.target.value }))} />

          <label htmlFor="catalog-node-description">Descrição</label>
          <textarea id="catalog-node-description" rows={4} value={form.description ?? ""} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />

          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn primary" disabled={saving || !form.name.trim()} onClick={save}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {selected && <button className="btn" onClick={() => startNew(selected)}>+ Filho</button>}
          </div>
        </aside>
      </div>

      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}

function CatalogTreeNode({
  node,
  selectedId,
  onSelect,
  onCreateChild,
  depth = 0,
}: Readonly<{
  node: CatalogNode;
  selectedId: string | null;
  onSelect: (node: CatalogNode) => void;
  onCreateChild: (node: CatalogNode) => void;
  depth?: number;
}>) {
  return (
    <div>
      <div className={`catalog-node ${selectedId === node.id ? "on" : ""}`} style={{ paddingLeft: 10 + depth * 18 }}>
        <button type="button" className="catalog-node-main" onClick={() => onSelect(node)}>
          <strong>{node.name}</strong>
          <span>{node.path_slug}</span>
        </button>
        <span className={`badge ${node.node_type}`}>{node.node_type}</span>
        <button type="button" className="btn tiny" onClick={() => onCreateChild(node)}>+ filho</button>
      </div>
      {(Array.isArray(node.children) ? node.children : []).map((child) => (
        <CatalogTreeNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function sanitizeForm(form: CatalogNodeInput): CatalogNodeInput {
  const clean = (value?: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    ...form,
    parent_id: form.parent_id || null,
    canonical_slug: clean(form.canonical_slug) ?? undefined,
    name: form.name.trim(),
    name_pt: clean(form.name_pt),
    description: clean(form.description),
    official_website_url: clean(form.official_website_url),
    logo_media_id: clean(form.logo_media_id),
    aliases: (form.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
  };
}

function flatten(nodes: CatalogNode[]): CatalogNode[] {
  return nodes.flatMap((node) => [node, ...flatten(Array.isArray(node.children) ? node.children : [])]);
}

function filterTree(nodes: CatalogNode[], query: string): CatalogNode[] {
  const normalized = normalize(query);
  if (!normalized) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(Array.isArray(node.children) ? node.children : [], query);
    const aliases = Array.isArray(node.aliases) ? node.aliases : [];
    const ownMatch = [
      node.name,
      node.name_pt ?? "",
      node.canonical_slug,
      node.path_slug,
      ...aliases.map((alias) => alias.alias),
    ].some((value) => normalize(value).includes(normalized));
    return ownMatch || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function nextChildType(type: CatalogNode["node_type"]): CatalogNode["node_type"] {
  if (type === "system") return "edition";
  if (type === "edition" || type === "subsystem") return "variant";
  return "variant";
}
