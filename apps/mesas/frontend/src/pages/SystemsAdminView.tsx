import { useEffect, useState, useMemo } from 'react';
import { AdminWorkspaceLayout } from '../features/admin/components/AdminWorkspaceLayout';
import { CatalogTree } from '../features/admin/components/CatalogTree';
import { CatalogToolbar } from '../features/admin/components/CatalogToolbar';
import { EntityInspector, type SystemFormData } from '../features/admin/components/EntityInspector';
import { CommandPalette } from '../features/admin/components/CommandPalette';
import { useSystems } from '../features/admin/systems/useSystems';
import { findInTree, countVisibleInTree } from '../features/admin/utils/treeHelpers';
import type { System } from '../features/admin/systems/types';

type SystemsAdminViewProps = {
  onInspectorDirtyChange?: (dirty: boolean) => void;
};

export function SystemsAdminView({ onInspectorDirtyChange }: SystemsAdminViewProps = {}) {
  const {
    systemsTree,
    loading,
    selectedId,
    setSelectedId,
    fetchTree,
    createSystem,
    updateSystem,
    deleteSystem,
    totalCount,
  } = useSystems();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Array<System['node_type']>>([]);
  const [inspectorMode, setInspectorMode] = useState<'edit' | 'create' | null>(null);
  const [parentContext, setParentContext] = useState<System | null>(null);
  const [inspectorDirty, setInspectorDirty] = useState(false);

  useEffect(() => {
    onInspectorDirtyChange?.(Boolean(inspectorMode && inspectorDirty));
  }, [inspectorMode, inspectorDirty, onInspectorDirtyChange]);

  useEffect(() => {
    return () => {
      onInspectorDirtyChange?.(false);
    };
  }, [onInspectorDirtyChange]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const selectedSystem = useMemo(
    () => (selectedId ? findInTree(systemsTree, selectedId) : null),
    [systemsTree, selectedId]
  );

  const resultsCount = useMemo(
    () => countVisibleInTree(systemsTree, search, typeFilter),
    [systemsTree, search, typeFilter]
  );

  const confirmDiscardIfDirty = () => {
    if (!inspectorMode || !inspectorDirty) return true;
    return confirm('Você tem alterações não salvas. Deseja descartar e continuar?');
  };

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    if (!confirmDiscardIfDirty()) return;

    setSelectedId(id);
    setInspectorMode('edit');
    setParentContext(null);
    setInspectorDirty(false);
  };

  const handleCreateRoot = () => {
    if (!confirmDiscardIfDirty()) return;

    setSelectedId(null);
    setInspectorMode('create');
    setParentContext(null);
    setInspectorDirty(false);
  };

  const handleAddChild = (parent: System) => {
    if (!confirmDiscardIfDirty()) return;

    setSelectedId(null);
    setInspectorMode('create');
    setParentContext(parent);
    setInspectorDirty(false);
  };

  const handleSave = async (data: SystemFormData) => {
    if (inspectorMode === 'create') {
      const success = await createSystem(data);
      if (success) {
        setInspectorMode(null);
        setParentContext(null);
      }
    } else if (inspectorMode === 'edit' && selectedId) {
      const success = await updateSystem(selectedId, data);
      if (success) {
        // Mantém inspector aberto após salvar
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedSystem) return;

    const tablesBlocked = Number(selectedSystem.tables_count ?? 0);
    const childrenBlocked = Number(selectedSystem.children_count ?? 0);

    const blockers: string[] = [];
    if (tablesBlocked > 0) blockers.push(`${tablesBlocked} mesa(s) vinculada(s)`);
    if (childrenBlocked > 0) blockers.push(`${childrenBlocked} sistema(s) filho(s)`);

    const warning = blockers.length > 0
      ? `Atenção: este sistema possui ${blockers.join(' e ')}. A exclusão pode ser bloqueada. Deseja tentar mesmo assim?`
      : `Deletar sistema "${selectedSystem.name}"? Esta ação não pode ser desfeita.`;

    if (!confirm(warning)) return;

    const success = await deleteSystem(selectedSystem.id, selectedSystem.name, { skipConfirm: true });
    if (!success) return;

    setInspectorMode(null);
    setSelectedId(null);
    setParentContext(null);
    setInspectorDirty(false);
  };

  const handleCancel = () => {
    if (!confirmDiscardIfDirty()) return;

    setInspectorMode(null);
    setSelectedId(null);
    setParentContext(null);
    setInspectorDirty(false);
  };

  const handleCloseInspector = () => {
    if (!confirmDiscardIfDirty()) return;

    setInspectorMode(null);
    setSelectedId(null);
    setParentContext(null);
    setInspectorDirty(false);
  };

  if (loading && systemsTree.length === 0) {
    return (
      <div className="py-12 text-center text-white/60">
        <p>Carregando sistemas...</p>
      </div>
    );
  }

  return (
    <AdminWorkspaceLayout
      workspace={
        <>
          <div className="flex flex-col h-full">
            <CatalogToolbar
              search={search}
              onSearchChange={setSearch}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              onCreateRoot={handleCreateRoot}
              resultsCount={resultsCount}
              totalCount={totalCount}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CatalogTree
                systems={systemsTree}
                selectedId={selectedId}
                onSelect={handleSelect}
                onAddChild={handleAddChild}
                search={search}
                typeFilter={typeFilter}
              />
            </div>
          </div>
          <CommandPalette systems={systemsTree} onSelect={handleSelect} onCreateRoot={handleCreateRoot} />
        </>
      }
      inspector={
        inspectorMode ? (
          <EntityInspector
            mode={inspectorMode}
            system={selectedSystem}
            parentContext={parentContext}
            allSystems={systemsTree}
            onSave={handleSave}
            onDelete={inspectorMode === 'edit' ? handleDelete : undefined}
            onCancel={handleCancel}
            onDirtyChange={setInspectorDirty}
          />
        ) : null
      }
      onCloseInspector={handleCloseInspector}
    />
  );
}
