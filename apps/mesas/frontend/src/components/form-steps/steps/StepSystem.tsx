import { useState } from 'react';
import { Dice1 } from 'lucide-react';
import { SystemPicker } from '../../SystemPicker';
import { ScenarioSelector } from '../../ScenarioSelector';
import { SystemSuggestionModal } from '../../SystemSuggestionModal';
import { ScenarioSuggestionModal } from '../../ScenarioSuggestionModal';
import type { SystemTreeNode } from '../../../types/systems';

interface StepSystemProps {
  systemsTree: SystemTreeNode[];
  systemsLoading: boolean;
  systemsError: string | null;
  selectedSystemId: string;
  setSelectedSystemId: (id: string) => void;
  selectedScenarioId: string | null;
  setSelectedScenarioId: (id: string | null) => void;
  onRefreshSystems: () => void;
}

export function StepSystem({
  systemsTree,
  systemsLoading,
  systemsError,
  selectedSystemId,
  setSelectedSystemId,
  selectedScenarioId,
  setSelectedScenarioId,
  onRefreshSystems,
}: StepSystemProps) {
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showScenarioSuggestionModal, setShowScenarioSuggestionModal] = useState(false);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Sistema */}
      <div className="rounded-2xl border border-white/10 bg-[var(--surface-input)]/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Dice1 className="w-4 h-4 text-[var(--color-artificio-orange)]" />
            Sistema da Mesa *
          </div>
          <button
            type="button"
            onClick={() => setShowSuggestionModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            + Adicionar Sistema
          </button>
        </div>

        {systemsLoading ? (
          <p className="text-sm text-white/60">Carregando árvore de sistemas...</p>
        ) : systemsError ? (
          <p className="text-sm text-red-300">{systemsError}</p>
        ) : (
          <SystemPicker
            tree={systemsTree}
            selectedIds={selectedSystemId ? [selectedSystemId] : []}
            onSelectionChange={(ids) => setSelectedSystemId(ids[0] ?? '')}
            idPrefix="step-system"
            mode="single"
            role="user"
            onSuggest={() => setShowSuggestionModal(true)}
          />
        )}
      </div>

      {/* Cenário */}
      <div className="rounded-2xl border border-white/10 bg-[var(--surface-input)]/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Cenário (opcional)</p>
            <p className="text-xs text-white/60 mt-1">
              Cenários são independentes de sistemas. Ex: Forgotten Realms pode ser jogado em D&D ou Pathfinder.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScenarioSuggestionModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            + Sugerir Cenário
          </button>
        </div>

        <ScenarioSelector
          key={`scenario-selector-${scenarioRefreshKey}`}
          selectedScenarioId={selectedScenarioId}
          onSelect={setSelectedScenarioId}
          disabled={false}
        />
      </div>

      <SystemSuggestionModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        onSuccess={(createdSystem) => {
          setShowSuggestionModal(false);
          if (createdSystem?.id) {
            setSelectedSystemId(createdSystem.id);
          }
          onRefreshSystems();
        }}
      />

      <ScenarioSuggestionModal
        isOpen={showScenarioSuggestionModal}
        onClose={() => setShowScenarioSuggestionModal(false)}
        onSuccess={() => {
          setShowScenarioSuggestionModal(false);
          setScenarioRefreshKey((current) => current + 1);
        }}
      />
    </div>
  );
}
