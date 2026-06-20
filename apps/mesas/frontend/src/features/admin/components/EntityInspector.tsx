import { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, ExternalLink } from 'lucide-react';
import { NodeTypeBadge } from './NodeTypeBadge';
import { AliasesEditor } from './AliasesEditor';
import { Breadcrumb } from './Breadcrumb';
import { Field } from './Field';
import type { System } from '../../../modules/admin/systems/types';

interface Props {
  mode: 'edit' | 'create';
  system: System | null;
  parentContext: System | null;
  allSystems: System[];
  onSave: (data: SystemFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface SystemFormData {
  name: string;
  name_pt: string | null;
  node_type: 'system' | 'edition' | 'subsystem' | 'variant';
  parent_id: string | null;
  aliases: string[];
  logo_filename?: string | null;
  website_url?: string | null;
}

const VALID_CHILDREN: Record<string, Array<'system'|'edition'|'subsystem'|'variant'>> = {
  __root__:  ['system'],
  system:    ['edition', 'subsystem'],
  edition:   ['variant'],
  subsystem: ['variant'],
  variant:   [],
};

const TYPE_LABEL = {
  system: 'Sistema',
  edition: 'Edição',
  subsystem: 'Subsistema',
  variant: 'Variante'
} as const;

function isSystemNodeType(value: string): value is SystemFormData['node_type'] {
  return value === 'system' || value === 'edition' || value === 'subsystem' || value === 'variant';
}

export function EntityInspector(props: Props) {
  const { mode, system, parentContext, allSystems, onSave, onDelete, onCancel, onDirtyChange } = props;

  const validTypes = useMemo(() => {
    if (mode === 'edit' && system) {
      return [system.node_type];
    }
    const parentType = parentContext?.node_type ?? '__root__';
    return VALID_CHILDREN[parentType];
  }, [mode, system, parentContext]);

  const [name, setName] = useState(system?.name ?? '');
  const [namePt, setNamePt] = useState(system?.name_pt ?? '');
  const [nodeType, setNodeType] = useState<SystemFormData['node_type']>(
    system?.node_type ?? validTypes[0] ?? 'system'
  );
  const [aliases, setAliases] = useState<string[]>(system?.aliases ?? []);
  const [logoFilename, setLogoFilename] = useState(system?.logo_filename ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(system?.website_url ?? '');
  const [saving, setSaving] = useState(false);
  // Reset dos campos ao mudar o sistema/contexto — ajuste durante o render
  // (sem effect): identidade via system.id + parentContext.id.
  const ctxKey = `${system?.id ?? ''}|${parentContext?.id ?? ''}`;
  const [prevCtxKey, setPrevCtxKey] = useState(ctxKey);
  if (prevCtxKey !== ctxKey) {
    setPrevCtxKey(ctxKey);
    setName(system?.name ?? '');
    setNamePt(system?.name_pt ?? '');
    setNodeType(system?.node_type ?? validTypes[0] ?? 'system');
    setAliases(system?.aliases ?? []);
    setLogoFilename(system?.logo_filename ?? '');
    setWebsiteUrl(system?.website_url ?? '');
  }

  // dirty = derivado dos campos vs o sistema atual (sem state/effect).
  const dirty = mode === 'create'
    ? name.trim().length > 0
    : system
      ? name !== system.name ||
        (namePt || null) !== (system.name_pt || null) ||
        (logoFilename || null) !== (system.logo_filename || null) ||
        (websiteUrl || null) !== (system.website_url || null) ||
        JSON.stringify(aliases) !== JSON.stringify(system.aliases ?? [])
      : false;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Slug preview
  const slugPreview = useMemo(() => {
    if (!name.trim()) return '';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim()
      .replace(/\s+/g, '-').replace(/-+/g, '-');
  }, [name]);

  const breadcrumbPath = useMemo(() => {
    if (mode === 'create' && parentContext) {
      return [...buildPath(parentContext, allSystems), '(novo)'];
    }
    if (system) return buildPath(system, allSystems);
    return ['(novo sistema)'];
  }, [mode, system, parentContext, allSystems]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        name_pt: namePt.trim() || null,
        node_type: nodeType,
        parent_id: mode === 'create' ? (parentContext?.id ?? null) : (system?.parent_id ?? null),
        aliases: aliases.map(a => a.trim()).filter(Boolean),
        logo_filename: logoFilename.trim() || null,
        website_url: websiteUrl.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
        {system && <NodeTypeBadge type={system.node_type} />}
        <h2 className="text-lg font-bold text-white truncate">
          {mode === 'create' ? 'Novo item' : system?.name}
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        <Breadcrumb path={breadcrumbPath} creating={mode === 'create'} />

        <Field label="Nome" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
            autoFocus={mode === 'create'}
          />
        </Field>

        <Field label="Nome em português" hint="Opcional. Usado em interfaces localizadas.">
          <input
            value={namePt}
            onChange={(e) => setNamePt(e.target.value)}
            placeholder="Ex: Dungeons & Dragons"
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Slug" hint="Gerado automaticamente. Somente visualização.">
          <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/60 font-mono text-sm">
            {slugPreview || '—'}
          </div>
        </Field>

        <Field label="Tipo" required>
          {validTypes.length === 1 && mode === 'edit' ? (
            <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/80 text-sm">
              {TYPE_LABEL[nodeType]} <span className="text-white/40">· bloqueado em edição</span>
            </div>
          ) : (
            <select
              value={nodeType}
              onChange={(e) => {
                if (isSystemNodeType(e.target.value)) {
                  setNodeType(e.target.value);
                }
              }}
              disabled={mode === 'edit'}
              className="app-select w-full rounded px-3"
            >
              {validTypes.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          )}
        </Field>

        {mode === 'create' && parentContext && (
          <Field label="Pai" hint="Definido pelo contexto da árvore.">
            <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/80 text-sm flex items-center gap-2">
              <NodeTypeBadge type={parentContext.node_type} />
              <span>{parentContext.name}</span>
            </div>
          </Field>
        )}

        <Field label={`Aliases (${aliases.length})`} hint="Nomes alternativos para busca.">
          <AliasesEditor value={aliases} onChange={setAliases} />
        </Field>

        {/* Logo e Website - apenas para sistemas raiz */}
        {nodeType === 'system' && (
          <>
            <Field label="Logo" hint="Nome do arquivo em /sys-logos/ (ex: dnd.svg)">
              <input
                value={logoFilename}
                onChange={(e) => setLogoFilename(e.target.value)}
                placeholder="dnd.svg"
                className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </Field>

            <Field label="Website Oficial" hint="URL completa (ex: https://dnd.wizards.com)">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </Field>
          </>
        )}

        {system && (system.tables_count ?? 0) > 0 && (
          <div className="mt-6 p-3 rounded bg-amber-500/5 border border-amber-500/20">
            <p className="text-sm text-amber-200">
              Usado por {system.tables_count} {system.tables_count === 1 ? 'mesa' : 'mesas'}.
            </p>
            <button className="mt-2 text-xs text-amber-300 hover:underline inline-flex items-center gap-1">
              Ver mesas <ExternalLink size={10} />
            </button>
          </div>
        )}
      </div>

      <footer className="px-6 py-3 border-t border-white/10 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!dirty || !name.trim() || saving}
          className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded inline-flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Salvando…' : mode === 'create' ? 'Criar' : 'Salvar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-white/70 hover:text-white"
        >
          Cancelar
        </button>
        {mode === 'edit' && onDelete && (
          <button
            onClick={onDelete}
            className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded"
            title="Deletar"
          >
            <Trash2 size={16} />
          </button>
        )}
      </footer>
    </div>
  );
}

function buildPath(node: System, all: System[]): string[] {
  const byId = new Map<string, System>();
  const collect = (nodes: System[]) => {
    for (const n of nodes) {
      byId.set(n.id, n);
      if (n.children) collect(n.children);
    }
  };
  collect(all);
  const chain: string[] = [node.name];
  let cursor = node.parent_id ? byId.get(node.parent_id) : null;
  while (cursor) {
    chain.unshift(cursor.name);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
  }
  return chain;
}
