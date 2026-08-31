import React, { useCallback, useMemo } from 'react';
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
  const { tree, flat, loading, error, forceRefresh } = useSystemsCatalog();

  // Spec 099 B9: além de contar, LISTAR os nomes dos sistemas selecionados.
  // Nome resolve pelo catálogo (system_id → nó) — nunca se grava nome, só o
  // id; id que não existe mais no catálogo é omitido da lista (a contagem
  // continua sendo a verdade dos ids salvos no servidor).
  const selectedSystems = useMemo(() => {
    const byId = new Map(flat.map((node) => [node.id, node]));
    const resolved: Array<{ id: string; name: string }> = [];
    for (const id of selectedSystemIds) {
      const node = byId.get(id);
      if (node) resolved.push({ id, name: node.name });
    }
    return resolved;
  }, [flat, selectedSystemIds]);

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

      {selectedSystems.length > 0 && (
        <div className="selected-systems-list">
          <div className="selected-systems-container">
            {selectedSystems.map(({ id, name }) => (
              <span key={id} className="selected-system-badge">{name}</span>
            ))}
          </div>
        </div>
      )}

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
