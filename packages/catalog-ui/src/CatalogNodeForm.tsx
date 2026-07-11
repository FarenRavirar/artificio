import { useEffect, useState } from 'react';
import type { CatalogUiNode, CatalogUiNodeInput, CatalogNodeType } from './types.js';

const NODE_TYPES: Array<{ value: CatalogNodeType; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'edition', label: 'Edição' },
  { value: 'subsystem', label: 'Subsistema' },
  { value: 'variant', label: 'Variante' },
];

const EMPTY_FORM: CatalogUiNodeInput = {
  parent_id: null,
  node_type: 'system',
  canonical_slug: '',
  name: '',
  name_pt: '',
  description: '',
  official_website_url: '',
  logo_media_id: '',
  status: 'active',
  aliases: [],
};

function nodeToForm(node: CatalogUiNode): CatalogUiNodeInput {
  return {
    parent_id: node.parent_id,
    node_type: node.node_type,
    canonical_slug: node.canonical_slug,
    name: node.name,
    name_pt: node.name_pt ?? '',
    description: node.description ?? '',
    official_website_url: node.official_website_url ?? '',
    logo_media_id: node.logo_media_id ?? '',
    status: node.status,
    aliases: node.aliases ?? [],
  };
}

/** Aliases não herdam entre níveis: sistema tem os seus, edição os seus, variante os
 * seus — cada CatalogUiNodeInput carrega só os aliases do próprio nó selecionado. */
export function sanitizeCatalogForm(form: CatalogUiNodeInput): CatalogUiNodeInput {
  const clean = (value?: string | null) => {
    const trimmed = (value ?? '').trim();
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

export type CatalogNodeFormProps = Readonly<{
  idPrefix: string;
  selected: CatalogUiNode | null;
  parentOptions: CatalogUiNode[];
  saving?: boolean;
  onSave: (form: CatalogUiNodeInput) => void;
  onCreateChild?: (parent: CatalogUiNode) => void;
  newNodeDefaults?: Partial<CatalogUiNodeInput>;
}>;

export function CatalogNodeForm({
  idPrefix,
  selected,
  parentOptions,
  saving = false,
  onSave,
  onCreateChild,
  newNodeDefaults,
}: CatalogNodeFormProps) {
  const [form, setForm] = useState<CatalogUiNodeInput>(
    selected ? nodeToForm(selected) : { ...EMPTY_FORM, ...newNodeDefaults },
  );

  // Dependência por conteúdo (JSON), não por referência: um objeto newNodeDefaults
  // recriado a cada render com o mesmo conteúdo não deve resetar o formulário que
  // o usuário já está preenchendo (achado CodeRabbit PR #148).
  const newNodeDefaultsKey = JSON.stringify(newNodeDefaults ?? null);

  useEffect(() => {
    setForm(selected ? nodeToForm(selected) : { ...EMPTY_FORM, ...newNodeDefaults });
    // newNodeDefaultsKey (JSON estável) é a dependência intencional, não newNodeDefaults (referência instável).
  }, [selected, newNodeDefaultsKey]);

  const id = (suffix: string) => `${idPrefix}-${suffix}`;

  return (
    <div>
      <h3>{selected ? 'Editar nó' : 'Novo nó'}</h3>

      <label htmlFor={id('type')}>Tipo</label>
      <select
        id={id('type')}
        value={form.node_type}
        onChange={(e) => setForm((current) => ({ ...current, node_type: e.target.value as CatalogNodeType }))}
      >
        {NODE_TYPES.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>

      <label htmlFor={id('parent')}>Pai</label>
      <select
        id={id('parent')}
        value={form.parent_id ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, parent_id: e.target.value || null }))}
      >
        <option value="">Raiz</option>
        {parentOptions.map((node) => (
          <option key={node.id} value={node.id}>
            {node.path_slug ? `${node.name} (${node.path_slug})` : node.name}
          </option>
        ))}
      </select>

      <label htmlFor={id('name')}>Nome</label>
      <input
        id={id('name')}
        type="text"
        value={form.name}
        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
      />

      <label htmlFor={id('name-pt')}>Nome PT</label>
      <input
        id={id('name-pt')}
        type="text"
        value={form.name_pt ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, name_pt: e.target.value }))}
      />

      <label htmlFor={id('slug')}>Slug</label>
      <input
        id={id('slug')}
        type="text"
        value={form.canonical_slug ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, canonical_slug: e.target.value }))}
      />

      <label htmlFor={id('aliases')}>Aliases</label>
      <textarea
        id={id('aliases')}
        rows={3}
        value={(form.aliases ?? []).join('\n')}
        onChange={(e) => setForm((current) => ({ ...current, aliases: e.target.value.split('\n') }))}
        placeholder="Um alias por linha (próprios deste nó — não herdam de pai/filho)"
      />

      <label htmlFor={id('logo')}>Logo</label>
      <input
        id={id('logo')}
        type="text"
        value={form.logo_media_id ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, logo_media_id: e.target.value }))}
      />

      <label htmlFor={id('website')}>Website Oficial</label>
      <input
        id={id('website')}
        type="url"
        value={form.official_website_url ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, official_website_url: e.target.value }))}
      />

      <label htmlFor={id('description')}>Descrição</label>
      <textarea
        id={id('description')}
        rows={4}
        value={form.description ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
      />

      <div className="actions" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn primary"
          disabled={saving || !form.name.trim()}
          onClick={() => onSave(sanitizeCatalogForm(form))}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {selected && onCreateChild && (
          <button type="button" className="btn" onClick={() => onCreateChild(selected)}>
            + Filho
          </button>
        )}
      </div>
    </div>
  );
}
