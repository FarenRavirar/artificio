import { useEffect, useState } from 'react';
import { AdminWorkspaceLayout } from '../features/admin/components/AdminWorkspaceLayout';
import { ScenariosList } from '../features/admin/components/ScenariosList';
import { EntityInspector, type SystemFormData } from '../features/admin/components/EntityInspector';
import type { System } from '../modules/admin/systems/types';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Scenario {
  id: string;
  name: string;
  name_pt?: string | null;
  slug: string;
  aliases?: string[];
  tables_count?: number;
}

function scenarioToSystem(scenario: Scenario | null): System | null {
  if (!scenario) return null;

  return {
    id: scenario.id,
    name: scenario.name,
    name_pt: scenario.name_pt,
    slug: scenario.slug,
    node_type: 'system',
    parent_id: null,
    path_slug: scenario.slug,
    aliases: scenario.aliases,
    tables_count: scenario.tables_count,
  };
}

export function ScenariosAdminView() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'edit' | 'create' | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/scenarios`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.data || []);
      }
    } catch (error) {
      console.error('[ScenariosAdminView] Erro ao buscar cenários:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedScenario = scenarios.find(s => s.id === selectedId) || null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setInspectorMode('edit');
  };

  const handleCreate = () => {
    setSelectedId(null);
    setInspectorMode('create');
  };

  const handleSave = async (data: SystemFormData) => {
    if (inspectorMode === 'create') {
      try {
        const response = await fetch(`${API_BASE}/api/v1/scenarios/admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: data.name,
            name_pt: data.name_pt,
            aliases: data.aliases,
          }),
        });

        if (response.ok) {
          toast.success('Cenário criado!');
          await fetchScenarios();
          setInspectorMode(null);
        } else {
          const result = await response.json();
          toast.error(result.error || 'Erro ao criar cenário');
        }
      } catch (error) {
        console.error('[ScenariosAdminView] Erro ao criar:', error);
        toast.error('Erro ao criar cenário');
      }
    } else if (inspectorMode === 'edit' && selectedId) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/scenarios/admin/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: data.name,
            name_pt: data.name_pt,
            aliases: data.aliases,
          }),
        });

        if (response.ok) {
          toast.success('Cenário atualizado!');
          await fetchScenarios();
        } else {
          const result = await response.json();
          toast.error(result.error || 'Erro ao atualizar cenário');
        }
      } catch (error) {
        console.error('[ScenariosAdminView] Erro ao atualizar:', error);
        toast.error('Erro ao atualizar cenário');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedScenario) return;
    if (!confirm(`Deletar cenário "${selectedScenario.name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/scenarios/admin/${selectedScenario.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Cenário deletado!');
        await fetchScenarios();
        setInspectorMode(null);
        setSelectedId(null);
      } else {
        const result = await response.json();
        toast.error(result.error || 'Erro ao deletar cenário');
      }
    } catch (error) {
      console.error('[ScenariosAdminView] Erro ao deletar:', error);
      toast.error('Erro ao deletar cenário');
    }
  };

  const handleCancel = () => {
    setInspectorMode(null);
    setSelectedId(null);
  };

  const handleCloseInspector = () => {
    setInspectorMode(null);
    setSelectedId(null);
  };

  if (loading && scenarios.length === 0) {
    return (
      <div className="py-12 text-center text-white/60">
        <p>Carregando cenários...</p>
      </div>
    );
  }

  return (
    <AdminWorkspaceLayout
      workspace={
        <ScenariosList
          scenarios={scenarios}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onDelete={handleDelete}
          search={search}
          onSearchChange={setSearch}
        />
      }
      inspector={
        inspectorMode ? (
          <EntityInspector
            mode={inspectorMode}
            system={scenarioToSystem(selectedScenario)}
            parentContext={null}
            allSystems={[]}
            onSave={handleSave}
            onDelete={inspectorMode === 'edit' ? handleDelete : undefined}
            onCancel={handleCancel}
          />
        ) : null
      }
      onCloseInspector={handleCloseInspector}
    />
  );
}
