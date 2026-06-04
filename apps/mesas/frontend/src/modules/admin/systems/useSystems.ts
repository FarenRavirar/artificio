import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { System } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

type BlockedByItem = {
  type: 'tables' | 'children' | string;
  count: number;
};

const BLOCKED_BY_LABEL: Record<string, string> = {
  tables: 'mesas vinculadas',
  children: 'sistemas filhos',
};

export function useSystems() {
  const [systems, setSystems] = useState<System[]>([]);
  const [systemsTree, setSystemsTree] = useState<System[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalCount = useMemo(() => {
    const countNode = (node: System): number => 1 + (node.children ?? []).reduce((acc, child) => acc + countNode(child), 0);
    return systemsTree.reduce((acc, node) => acc + countNode(node), 0);
  }, [systemsTree]);

  const fetchSystems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/systems?view=flat`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSystems(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('[useSystems] Erro ao buscar sistemas:', error);
      setSystems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/systems?view=tree`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSystemsTree(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('[useSystems] Erro ao buscar árvore:', error);
      setSystemsTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSystem = useCallback(async (formData: {
    name: string;
    name_pt: string | null;
    node_type: string;
    parent_id: string | null;
    aliases: string[];
  }) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/systems/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Sistema criado!');
        await fetchTree();
        return true;
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao criar sistema');
        return false;
      }
    } catch (error) {
      console.error('[useSystems] Erro ao criar sistema:', error);
      toast.error('Erro ao criar sistema');
      return false;
    }
  }, [fetchTree]);

  const updateSystem = useCallback(async (id: string, formData: {
    name: string;
    name_pt: string | null;
    node_type: string;
    aliases: string[];
    logo_filename?: string | null;
    website_url?: string | null;
  }) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/systems/admin/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Sistema atualizado!');
        await fetchTree();
        return true;
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao atualizar sistema');
        return false;
      }
    } catch (error) {
      console.error('[useSystems] Erro ao atualizar sistema:', error);
      toast.error('Erro ao atualizar sistema');
      return false;
    }
  }, [fetchTree]);

  const deleteSystem = useCallback(async (
    id: string,
    name: string,
    options?: { skipConfirm?: boolean }
  ): Promise<boolean> => {
    const shouldConfirm = !options?.skipConfirm;
    if (shouldConfirm && !confirm(`Deletar sistema "${name}"? Esta ação não pode ser desfeita.`)) return false;

    try {
      const response = await fetch(`${API_BASE}/api/v1/systems/admin/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Sistema deletado!');
        await fetchTree();
        return true;
      }

      let errorMessage = 'Erro ao deletar sistema';
      try {
        const data = await response.json();
        const blockedBy = Array.isArray(data?.blocked_by) ? (data.blocked_by as BlockedByItem[]) : [];

        if (blockedBy.length > 0) {
          const details = blockedBy
            .map(({ type, count }) => {
              const label = BLOCKED_BY_LABEL[type] ?? type;
              return `${count} ${label}`;
            })
            .join(' • ');
          errorMessage = `Não foi possível deletar: ${details}.`;
        } else {
          errorMessage = data?.error || errorMessage;
        }
      } catch {
        // Mantém fallback quando resposta não é JSON
      }

      toast.error(errorMessage);
      return false;
    } catch (error) {
      console.error('[useSystems] Erro ao deletar sistema:', error);
      toast.error('Erro ao deletar sistema');
      return false;
    }
  }, [fetchTree]);

  const filteredSystems = systems.filter((sys) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Busca em name, name_pt, slug e aliases
    return sys.name.toLowerCase().includes(query) ||
      sys.slug.toLowerCase().includes(query) ||
      (sys.name_pt && sys.name_pt.toLowerCase().includes(query)) ||
      (sys.aliases && sys.aliases.some(alias => alias.toLowerCase().includes(query)));
  });

  return {
    systems: filteredSystems,
    systemsTree,
    totalCount,
    loading,
    searchQuery,
    setSearchQuery,
    selectedId,
    setSelectedId,
    fetchSystems,
    fetchTree,
    createSystem,
    updateSystem,
    deleteSystem,
  };
}
