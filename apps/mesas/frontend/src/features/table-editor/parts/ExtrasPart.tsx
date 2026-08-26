import { Panel, Select, TextInput } from '@artificio/ui';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import type { DdalFormState, TableEditorState } from '../types';
import { ContentEditor } from '@artificio/content-editor';
import { EDITOR_TEXT_LIMITS } from '../utils/editorValidation';

/**
 * Parte "Regras e extras": requisitos técnicos detalhados (limite 1.000),
 * duração da campanha, faixa de nível, Covil (ADMIN-ONLY — A13, o usuário
 * sem role='admin' não vê nem envia o campo) e o bloco DDAL (9 campos,
 * elegível em D&D 5e 2014 E 2024 — T4.0b).
 */
type ExtrasPartProps = Readonly<{
  api: TableEditorApi;
  userRole?: string;
  isDdalEligible: boolean;
}>;

export function ExtrasPart({ api, userRole, isDdalEligible }: ExtrasPartProps) {
  const { state, patch, errors } = api;

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px]">
      <EditorField
        fieldId="technicalRequirements"
        state={state}
        label="Requisitos técnicos detalhados"
        hint="Texto livre complementando os três requisitos marcados na parte 'Onde joga'."
        error={errors.technicalRequirements}
      >
        <ContentEditor
          value={state.technicalRequirements}
          onChange={(text) => patch({ technicalRequirements: text })}
          label="Requisitos técnicos detalhados"
          maxLength={EDITOR_TEXT_LIMITS.technicalRequirements[1]}
          placeholder="Ex: Roll20 + Discord, Foundry VTT com módulos X, Y"
          minHeight={100}
        />
      </EditorField>

      <div className="flex flex-wrap gap-3.5 items-start">
        <EditorField fieldId="campaignLength" state={state} label="Duração da campanha">
          <TextInput
            id="campaignLength"
            value={state.campaignLength}
            onChange={(e) => patch({ campaignLength: e.target.value })}
            placeholder="Ex: 6 meses, 12 sessões, Indeterminada"
            className="!w-[206px]"
          />
        </EditorField>
        <EditorField fieldId="levelRange" state={state} label="Faixa de nível">
          <TextInput
            id="levelRange"
            value={state.levelRange}
            onChange={(e) => patch({ levelRange: e.target.value })}
            placeholder="Ex: 1-5, 10-15, Épico 20+"
            className="!w-[206px]"
          />
        </EditorField>
      </div>

      {/* Covil do Lich — ADMIN-ONLY (A13): o gate vive na role; o payload do
          mapper também só é respeitado pelo backend para admin
          (tableService.prepareTableData). */}
      {userRole === 'admin' && (
        <Panel tone="warning">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Selo Covil do Lich</p>
              <p className="mt-0.5 text-xs opacity-75">
                Mesas com curadoria e padrão elevado de qualidade — exibidas com o selo oficial.
              </p>
            </div>
            <ToggleButton
              id="covil-toggle"
              pressed={state.isCovil}
              onToggle={(pressed) => patch({ isCovil: pressed })}
            >
              É Covil do Lich
            </ToggleButton>
          </div>
        </Panel>
      )}

      {isDdalEligible && (
        <DdalBlock
          state={state}
          ddal={state.ddal}
          onChange={(ddal) => patch({ ddal })}
        />
      )}
    </div>
  );
}

/**
 * Bloco DDAL com os 9 campos (paridade com o StepFinal antigo) — aparece só
 * quando o sistema selecionado é elegível (D&D 5e 2014 ou 2024,
 * `DDAL_ELIGIBLE_PATHS`), e desmarca sozinho ao trocar para sistema não
 * elegível (efeito no TableEditor).
 */
type DdalBlockProps = Readonly<{
  state: TableEditorState;
  ddal: DdalFormState;
  onChange: (ddal: DdalFormState) => void;
}>;

const TIER_OPTIONS = [
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
  { value: '4', label: 'Tier 4' },
];

function DdalBlock({ state, ddal, onChange }: DdalBlockProps) {
  const set = (patch: Partial<DdalFormState>) => onChange({ ...ddal, ...patch });

  return (
    <Panel tone="warning">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Caminho elegível para selo DDAL</p>
          <p className="mt-0.5 text-xs opacity-75">Ative apenas para módulos Adventurers League (D&D 5e 2014 ou 2024).</p>
        </div>
        <ToggleButton
          id="ddal-toggle"
          pressed={ddal.is_ddal}
          onToggle={(pressed) => set({ is_ddal: pressed })}
        >
          É DDAL
        </ToggleButton>
      </div>

      {ddal.is_ddal && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
          <EditorField fieldId="ddal" controlId="ddal_code" state={state} label="Código da Aventura">
            <TextInput
              id="ddal_code"
              value={ddal.ddal_code}
              onChange={(e) => set({ ddal_code: e.target.value })}
              placeholder="Ex: DDAL05-01"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_name" state={state} label="Nome da Aventura">
            <TextInput
              id="ddal_name"
              value={ddal.ddal_name}
              onChange={(e) => set({ ddal_name: e.target.value })}
              placeholder="Ex: Treasure of the Broken Hoard"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_tier" state={state} label="Tier">
            <Select
              id="ddal_tier"
              value={ddal.ddal_tier}
              onChange={(e) => set({ ddal_tier: e.target.value })}
            >
              <option value="">Selecione</option>
              {TIER_OPTIONS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </Select>
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_season" state={state} label="Season">
            <TextInput
              id="ddal_season"
              value={ddal.ddal_season}
              onChange={(e) => set({ ddal_season: e.target.value })}
              placeholder="Ex: Season 10"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_duration" state={state} label="Duração esperada">
            <TextInput
              id="ddal_duration"
              value={ddal.ddal_duration}
              onChange={(e) => set({ ddal_duration: e.target.value })}
              placeholder="Ex: 4h"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_format" state={state} label="Formato">
            <TextInput
              id="ddal_format"
              value={ddal.ddal_format}
              onChange={(e) => set({ ddal_format: e.target.value })}
              placeholder="Ex: modulo, hardcover ou ccc"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_org_code" state={state} label="Código expandido / organização">
            <TextInput
              id="ddal_org_code"
              value={ddal.ddal_org_code}
              onChange={(e) => set({ ddal_org_code: e.target.value })}
              placeholder="Ex: CCC-BMG-01"
            />
          </EditorField>

          <EditorField fieldId="ddal" controlId="ddal_setting" state={state} label="Ambientação">
            <TextInput
              id="ddal_setting"
              value={ddal.ddal_setting}
              onChange={(e) => set({ ddal_setting: e.target.value })}
              placeholder="Ex: Forgotten Realms"
            />
          </EditorField>

          <EditorField
            fieldId="ddal"
            controlId="ddal_rules_notes"
            state={state}
            label="Notas de regras da temporada"
          >
            <TextInput
              id="ddal_rules_notes"
              value={ddal.ddal_rules_notes}
              onChange={(e) => set({ ddal_rules_notes: e.target.value })}
              placeholder="Observações úteis para jogadores e organização"
            />
          </EditorField>
        </div>
      )}
    </Panel>
  );
}
