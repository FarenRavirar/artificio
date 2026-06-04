import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface SystemSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdSystem?: { id: string; name?: string }) => void;
}

type SuggestionType = 'system' | 'edition' | 'variant' | 'subsystem';

type SystemNode = {
  id: string;
  name: string;
  name_pt?: string | null;
  node_type: 'system' | 'edition' | 'variant' | 'subsystem';
  depth?: number;
  children?: SystemNode[];
};

type FlattenedSystemNode = {
  id: string;
  label: string;
};

const flattenSystems = (nodes: SystemNode[], depth = 0): FlattenedSystemNode[] => {
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

export const SystemSuggestionModal = ({ isOpen, onClose, onSuccess }: SystemSuggestionModalProps) => {
  const { isAuthenticated, user } = useAuth();

  const [name, setName] = useState('');
  const [namePt, setNamePt] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [suggestionType, setSuggestionType] = useState<SuggestionType>('system');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [systemsTree, setSystemsTree] = useState<SystemNode[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [systemsError, setSystemsError] = useState<string | null>(null);

  const parentOptions = useMemo(() => flattenSystems(systemsTree), [systemsTree]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSystemsTree = async () => {
      setSystemsLoading(true);
      setSystemsError(null);

      try {
        const response = await fetch(`${API_BASE}/api/v1/systems?view=tree`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Erro ao carregar sistemas');
        }

        const data = await response.json();
        setSystemsTree(data.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar sistemas';
        setSystemsError(message);
      } finally {
        setSystemsLoading(false);
      }
    };

    fetchSystemsTree();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const isAdmin = user?.role === 'admin';
      const response = await fetch(`${API_BASE}${isAdmin ? '/api/v1/systems/admin' : '/api/v1/system-suggestions'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          isAdmin
            ? {
                name: name.trim(),
                name_pt: namePt.trim() || null,
                description: description.trim() || null,
                parent_id: suggestionType === 'system' ? null : parentId || null,
                node_type: suggestionType,
              }
            : {
                name: name.trim(),
                name_pt: namePt.trim() || null,
                description: description.trim() || null,
                parent_id: suggestionType === 'system' ? null : parentId || null,
                suggestion_type: suggestionType,
              },
        ),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar sugestão');
      }

      const created = await response.json();

      setName('');
      setNamePt('');
      setDescription('');
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
            <div>
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

            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Nome do Sistema *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Vampire: The Masquerade"
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div>
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

            <div>
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

            {suggestionType !== 'system' && (
              <div>
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
                  <p className="text-xs text-red-300 mt-2">{systemsError}</p>
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
