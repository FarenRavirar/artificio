import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/useAuth';
import { useSystemsCatalog } from '../hooks/useSystemsCatalog';
import { authPost } from '../services/apiClient';
import type { SystemTreeNode } from '../types/systems';

interface SystemSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdSystem?: { id: string; name?: string }) => void;
  initialName?: string;
  /** Pré-seleciona tipo/pai ao abrir o modal a partir de "Adicionar edição/variante"
   * na árvore em cascata (CatalogTree.onAddChildAtLevel) — sem isto o modal sempre
   * abria em suggestionType="system" e o usuário tinha que re-selecionar o pai
   * manualmente mesmo já tendo navegado até o nó certo na árvore. */
  initialSuggestionType?: SuggestionType;
  initialParentId?: string;
}

type SuggestionType = 'system' | 'edition' | 'variant' | 'subsystem';
type ChainRow = {
  name: string;
  namePt: string;
  description: string;
};

const parseAliases = (value: string) =>
  value
    .split('\n')
    .map((alias) => alias.trim())
    .filter(Boolean);

// Achado Sonar (PR #145): FormDataEntryValue pode ser File — String(file) nao
// produz o texto esperado. So aceita string antes de qualquer processamento.
const readFormText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

type FlattenedSystemNode = {
  id: string;
  label: string;
};

const flattenSystems = (nodes: SystemTreeNode[], depth = 0): FlattenedSystemNode[] => {
  const flattened: FlattenedSystemNode[] = [];

  for (const node of nodes) {
    const displayName = node.name_pt || node.name;
    const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';

    flattened.push({
      id: node.id,
      label: `${prefix}${displayName}`,
    });

    if (node.children && node.children.length > 0) {
      flattened.push(...flattenSystems(node.children, depth + 1));
    }
  }

  return flattened;
};

// Achado Sonar (PR #145): extraido de handleSubmit para reduzir complexidade
// cognitiva (16 -> abaixo do limite de 15) e reusar readFormText tipado.
function buildAdminBody(input: {
  name: string;
  namePt: string;
  description: string;
  suggestionType: SuggestionType;
  parentId: string;
  formData: FormData;
}) {
  const aliases = parseAliases(readFormText(input.formData, 'aliases'));
  const logoFilename = readFormText(input.formData, 'logo_filename').trim();
  const websiteUrl = readFormText(input.formData, 'website_url').trim();
  return {
    name: input.name.trim(),
    name_pt: input.namePt.trim() || null,
    description: input.description.trim() || null,
    parent_id: input.suggestionType === 'system' ? null : input.parentId || null,
    node_type: input.suggestionType,
    aliases,
    logo_filename: logoFilename || null,
    website_url: websiteUrl || null,
  };
}

const CHAIN_TYPES_FROM_DEPTH: Record<number, SuggestionType[]> = {
  0: ['system', 'edition', 'variant'],
  1: ['edition', 'variant'],
  2: ['variant'],
};
const CHAIN_LABEL_FROM_TYPE: Record<SuggestionType, string> = {
  system: 'Sistema',
  edition: 'Edição',
  variant: 'Variante',
  subsystem: 'Subsistema',
};
const CHAIN_PLACEHOLDER_FROM_TYPE: Record<SuggestionType, string> = {
  system: 'Ex: Vampire: The Masquerade',
  edition: 'Ex: Aniversário',
  variant: 'Ex: 20th Anniversary',
  subsystem: 'Ex: subsistema',
};

/** Nível de partida da cadeia: se o modal abriu a partir de "Adicionar edição/
 * variante" na árvore (initialParentId setado), a cadeia começa nesse nível em
 * vez de sempre recomeçar do zero como sistema novo. */
function chainStartDepth(suggestionType: SuggestionType, hasInitialParent: boolean): number {
  if (!hasInitialParent) return 0;
  return suggestionType === 'variant' ? 2 : 1;
}

// Achado real (2026-07-13): quando o modal abre a partir de "Adicionar edição/
// variante" na árvore (initialParentId setado), a cadeia sempre tratava a 1a
// linha preenchida como "system" com parent_id=null — ignorando o pai que já
// tinha sido escolhido na árvore. Corrigido: se initialParentId existe, a
// cadeia começa no nível de initialSuggestionType (edition/variant), ancorada
// nesse pai, em vez de sempre recomeçar do zero como sistema novo.
function buildSuggestionBody(input: {
  name: string;
  namePt: string;
  description: string;
  suggestionType: SuggestionType;
  parentId: string;
  chainRows: ChainRow[];
  initialParentId: string;
}) {
  const filledChainRows = input.chainRows
    .map((row) => ({
      name: row.name.trim(),
      name_pt: row.namePt.trim() || null,
      description: row.description.trim() || null,
    }))
    .filter((row) => row.name.length > 0);

  const anchoredToExistingParent = Boolean(input.initialParentId);
  const startDepth = chainStartDepth(input.suggestionType, anchoredToExistingParent);
  const chainTypes = CHAIN_TYPES_FROM_DEPTH[startDepth] ?? CHAIN_TYPES_FROM_DEPTH[0];

  if (filledChainRows.length > 1) {
    return {
      nodes: filledChainRows.map((row, index) => ({
        ...row,
        suggestion_type: chainTypes[Math.min(index, chainTypes.length - 1)],
        parent_id: index === 0 ? (anchoredToExistingParent ? input.initialParentId : null) : undefined,
        parent_suggestion_index: index === 0 ? undefined : index - 1,
      })),
    };
  }

  return {
    name: input.name.trim(),
    name_pt: input.namePt.trim() || null,
    description: input.description.trim() || null,
    parent_id: input.suggestionType === 'system' ? null : input.parentId || null,
    suggestion_type: input.suggestionType,
  };
}

export const SystemSuggestionModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  initialSuggestionType = 'system',
  initialParentId = '',
}: SystemSuggestionModalProps) => {
  const { isAuthenticated, user } = useAuth();
  const {
    tree: systemsTree,
    loading: systemsLoading,
    error: systemsError,
    forceRefresh: retrySystemsTree,
  } = useSystemsCatalog();

  const [name, setName] = useState(() => initialName.trim());
  const [namePt, setNamePt] = useState('');
  const [description, setDescription] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [logoFilename, setLogoFilename] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [chainRows, setChainRows] = useState<ChainRow[]>([
    { name: initialName.trim(), namePt: '', description: '' },
    { name: '', namePt: '', description: '' },
    { name: '', namePt: '', description: '' },
  ]);
  const [parentId, setParentId] = useState(initialParentId);
  const [suggestionType, setSuggestionType] = useState<SuggestionType>(initialSuggestionType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentOptions = useMemo(() => flattenSystems(systemsTree), [systemsTree]);

  const chainStartDepthValue = chainStartDepth(initialSuggestionType, Boolean(initialParentId));
  const chainTypes = CHAIN_TYPES_FROM_DEPTH[chainStartDepthValue] ?? CHAIN_TYPES_FROM_DEPTH[0];
  const parentLabel = initialParentId
    ? (parentOptions.find((option) => option.id === initialParentId)?.label ?? null)
    : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const isAdmin = user?.role === 'admin';
      const formData = new FormData(e.currentTarget);
      const endpoint = isAdmin ? '/api/v1/systems/admin' : '/api/v1/system-suggestions';
      const body = isAdmin
        ? buildAdminBody({ name, namePt, description, suggestionType, parentId, formData })
        : buildSuggestionBody({ name, namePt, description, suggestionType, parentId, chainRows, initialParentId });

      const response = await authPost(endpoint, body);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar sugestão');
      }

      const created = await response.json();

      setName('');
      setNamePt('');
      setDescription('');
      setAliasesText('');
      setLogoFilename('');
      setWebsiteUrl('');
      setChainRows([
        { name: '', namePt: '', description: '' },
        { name: '', namePt: '', description: '' },
        { name: '', namePt: '', description: '' },
      ]);
      setParentId('');
      setSuggestionType('system');
      toast.success(isAdmin ? 'Sistema adicionado ao catálogo.' : 'Sugestão enviada para análise da administração.');
      onSuccess?.(isAdmin ? created.data : undefined);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar sugestão';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1B2A4A] border border-white/10 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Sugerir Sistema</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-white/70 text-sm mb-6">
            {user?.role === 'admin'
              ? 'Adicione um novo sistema, edição ou variante diretamente ao catálogo.'
              : 'Sugira um novo sistema, edição ou variante. Sua sugestão será revisada por um administrador.'}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {user?.role !== 'admin' && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-3 text-sm font-semibold text-white">Sugerir cadeia</p>
                {parentLabel && (
                  <p className="mb-3 text-xs text-white/50">
                    A partir de <span className="font-semibold text-white/70">{parentLabel}</span>, já selecionado na árvore.
                  </p>
                )}
                <div className="space-y-3">
                  {chainRows.map((row, index) => {
                    const rowType = chainTypes[Math.min(index, chainTypes.length - 1)];
                    return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[120px_1fr]">
                      <span className="pt-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                        {CHAIN_LABEL_FROM_TYPE[rowType]}
                      </span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(event) => {
                            const next = [...chainRows];
                            next[index] = { ...row, name: event.target.value };
                            setChainRows(next);
                            if (index === 0) setName(event.target.value);
                          }}
                          placeholder={CHAIN_PLACEHOLDER_FROM_TYPE[rowType]}
                          required={index === 0}
                          className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
                        />
                        <input
                          type="text"
                          value={row.namePt}
                          onChange={(event) => {
                            const next = [...chainRows];
                            next[index] = { ...row, namePt: event.target.value };
                            setChainRows(next);
                            if (index === 0) setNamePt(event.target.value);
                          }}
                          placeholder="Nome em português (opcional)"
                          className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label className="block text-white font-semibold mb-2 text-sm">
                Tipo de Sugestão
              </label>
              <select
                value={suggestionType}
                onChange={(e) => {
                  setSuggestionType(e.target.value as SuggestionType);
                  setParentId('');
                }}
                className="app-select w-full px-4"
              >
                <option value="system">Novo Sistema</option>
                <option value="edition">Edição de Sistema Existente</option>
                <option value="variant">Variante de Sistema</option>
                <option value="subsystem">Subsistema</option>
              </select>
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label className="block text-white font-semibold mb-2 text-sm">
                Nome *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={user?.role === 'admin' ? 'Ex: Vampire: The Masquerade' : 'Ex: sistema novo'}
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label className="block text-white font-semibold mb-2 text-sm">
                Nome em português (opcional)
              </label>
              <input
                type="text"
                value={namePt}
                onChange={(e) => setNamePt(e.target.value)}
                placeholder="Ex: Vampiro: A Máscara"
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label className="block text-white font-semibold mb-2 text-sm">
                Descrição (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Informações adicionais sobre o sistema..."
                rows={4}
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)] resize-none"
              />
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label htmlFor="system-suggestion-aliases" className="block text-white font-semibold mb-2 text-sm">
                Aliases (um por linha)
              </label>
              <textarea
                id="system-suggestion-aliases"
                name="aliases"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder={'D&D\nDnD\nDungeons and Dragons'}
                rows={3}
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)] resize-none"
              />
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label htmlFor="system-suggestion-logo" className="block text-white font-semibold mb-2 text-sm">
                Logo (opcional)
              </label>
              <input
                id="system-suggestion-logo"
                name="logo_filename"
                type="text"
                value={logoFilename}
                onChange={(e) => setLogoFilename(e.target.value)}
                placeholder="Ex: dnd.svg ou media id"
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div className={user?.role !== 'admin' ? 'hidden' : ''}>
              <label htmlFor="system-suggestion-website" className="block text-white font-semibold mb-2 text-sm">
                Website Oficial (opcional)
              </label>
              <input
                id="system-suggestion-website"
                name="website_url"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            {suggestionType !== 'system' && (
              <div className={user?.role !== 'admin' ? 'hidden' : ''}>
                <label className="block text-white font-semibold mb-2 text-sm">
                  Sistema pai (opcional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="app-select w-full px-4"
                  disabled={systemsLoading}
                >
                  <option value="">
                    {systemsLoading ? 'Carregando sistemas...' : 'Selecione um sistema pai'}
                  </option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {systemsError && (
                  <div className="mt-2 text-xs text-red-300">
                    <p>{systemsError}</p>
                    <button
                      type="button"
                      className="mt-1 font-semibold text-red-200 underline underline-offset-4"
                      onClick={() => void retrySystemsTree()}
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-transparent border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 px-4 py-2 bg-[var(--color-artificio-orange)] text-white font-semibold rounded-lg hover:bg-[var(--color-artificio-orange)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar Sugestão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
};
