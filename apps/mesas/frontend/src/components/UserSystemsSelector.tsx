import React, { useCallback } from 'react';
import { SystemPicker } from './SystemPicker';
import { useSystemsCatalog } from '../hooks/useSystemsCatalog';
import './UserSystemsSelector.css';

interface UserSystemsSelectorProps {
  type: 'favorite' | 'gm';
  selectedSystemIds: string[];
  onAdd: (systemId: string) => void;
  onRemove: (systemId: string) => void;
}

/**
 * Componente para selecionar sistemas favoritos ou sistemas que o usuário mestra.
 */
export const UserSystemsSelector = React.memo(function UserSystemsSelector({
  type,
  selectedSystemIds,
  onAdd,
  onRemove,
}: UserSystemsSelectorProps) {
  const { tree, loading, error, forceRefresh } = useSystemsCatalog();

  const handleSelectionChange = useCallback((nextIds: string[]) => {
    for (const systemId of selectedSystemIds) {
      if (!nextIds.includes(systemId)) {
        onRemove(systemId);
      }
    }

    for (const systemId of nextIds) {
      if (!selectedSystemIds.includes(systemId)) {
        onAdd(systemId);
      }
    }
  }, [selectedSystemIds, onAdd, onRemove]);

  if (loading) {
    return (
      <div className="user-systems-selector-loading">
        <div className="spinner-small"></div>
        <p>Carregando sistemas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-systems-selector-loading" role="alert">
        <p>{error}</p>
        <button type="button" className="user-systems-selector-retry" onClick={() => void forceRefresh()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="user-systems-selector">
      <div className="systems-selector-header">
        <p className="systems-count">
          {selectedSystemIds.length} {type === 'favorite' ? 'favorito(s)' : 'sistema(s) que você mestra'}
        </p>
      </div>

      <SystemPicker
        tree={tree}
        selectedIds={selectedSystemIds}
        onSelectionChange={handleSelectionChange}
        idPrefix={`profile-${type}`}
        mode="multi"
        role="user"
      />
    </div>
  );
});
