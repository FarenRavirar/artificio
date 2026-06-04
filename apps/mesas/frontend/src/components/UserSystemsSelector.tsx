import React, { useState, useEffect, useCallback } from 'react';
import { SystemTreeSelector } from './SystemTreeSelector';
import { showError } from '../utils/toast';
import type { SystemTreeNode } from '../types/systems';
import './UserSystemsSelector.css';

interface UserSystemsSelectorProps {
  type: 'favorite' | 'gm';
  selectedSystemIds: string[];
  onAdd: (systemId: string) => void;
  onRemove: (systemId: string) => void;
}

/**
 * Componente para selecionar sistemas favoritos ou sistemas que o usuário mestra
 * Usa o SystemTreeSelector existente com multi-seleção
 */
export const UserSystemsSelector = React.memo(function UserSystemsSelector({
  type,
  selectedSystemIds,
  onAdd,
  onRemove,
}: UserSystemsSelectorProps) {
  const [tree, setTree] = useState<SystemTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSystemsTree();
  }, []);

  const fetchSystemsTree = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/v1/systems?view=tree`);
      if (!response.ok) throw new Error('Erro ao buscar árvore de sistemas');
      
      const result = await response.json();
      console.log('[UserSystemsSelector] Sistemas carregados:', result.data?.length || 0);
      setTree(result.data || []);
    } catch (error) {
      console.error('[UserSystemsSelector] Erro ao buscar sistemas:', error);
      showError('Erro ao carregar sistemas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = useCallback((systemId: string) => {
    if (selectedSystemIds.includes(systemId)) {
      onRemove(systemId);
    } else {
      onAdd(systemId);
    }
  }, [selectedSystemIds, onAdd, onRemove]);

  // Memoizar busca de sistema para evitar re-computação
  const findSystem = useCallback((systemId: string): SystemTreeNode | undefined => {
    return tree.find(s => s.id === systemId) || 
           tree.flatMap(s => s.children ?? []).find(c => c?.id === systemId) ||
           tree.flatMap(s => s.children ?? []).flatMap(c => c?.children ?? []).find(v => v?.id === systemId);
  }, [tree]);

  if (loading) {
    return (
      <div className="user-systems-selector-loading">
        <div className="spinner-small"></div>
        <p>Carregando sistemas...</p>
      </div>
    );
  }

  console.log('[UserSystemsSelector] Renderizando com tree:', tree.length, 'sistemas');

  return (
    <div className="user-systems-selector">
      <div className="systems-selector-header">
        <p className="systems-count">
          {selectedSystemIds.length} {type === 'favorite' ? 'favorito(s)' : 'sistema(s) que você mestra'}
        </p>
      </div>

      {/* Lista de sistemas selecionados */}
      {selectedSystemIds.length > 0 && (
        <div className="selected-systems-list">
          <div className="selected-systems-container">
            {selectedSystemIds.map((systemId) => {
              const system = findSystem(systemId);
              
              return (
                <div key={systemId} className="selected-system-badge">
                  <span>{system?.name || 'Sistema'}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(systemId)}
                    className="selected-system-remove"
                    aria-label={`Remover ${system?.name || 'sistema'}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SystemTreeSelector
        tree={tree}
        selectedIds={selectedSystemIds}
        onToggle={handleToggle}
        search={search}
        onSearchChange={setSearch}
        idPrefix={`profile-${type}`}
        singleSelect={false}
      />
    </div>
  );
});
