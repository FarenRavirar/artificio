import { useCallback, useMemo, useState } from 'react';
import { Panel, TextInput } from '@artificio/ui';
import { CatalogSystemSelector } from '@artificio/catalog-ui';
import type { CatalogUiNode } from '@artificio/catalog-ui';
import { systemTreeNodeToUiNode } from '../../../utils/systemTreeNodeToUiNode';
import { authGet } from '../../../utils/authenticatedFetch';
import { normalizeSystemsResponse } from '../../../hooks/useSystemsCatalog';
import type { SystemTreeNode } from '../../../types/systems';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import { ContentEditor } from '@artificio/content-editor';
import { ImageUploader } from '../../../components/ImageUploader';
import { ScenarioSelector } from '../../../components/ScenarioSelector';
import { SettingStylesField } from '../../../components/SettingStylesField';
import { SystemSuggestionModal } from '../../../components/SystemSuggestionModal';
import { ScenarioSuggestionModal } from '../../../components/ScenarioSuggestionModal';
import { ParsePreviewTextArea } from '../../create-table/components/ParsePreviewTextArea';
import { DESCRIPTION_MAX_LENGTH, EDITOR_TEXT_LIMITS } from '../utils/editorValidation';

/**
 * Limite da busca server-side de sistemas (R18/A21). 5 é o número medido na
 * spec 096: `?search=vampiro&limit=5` devolve 423 bytes contra 503.907 do
 * `?view=tree` — o suficiente para uma coluna de opções sem despejar o
 * catálogo inteiro.
 */
const SYSTEM_SEARCH_LIMIT = 5;

/**
 * Normaliza a resposta de busca server-side de sistemas (R18/A21) e converte
 * para o contrato `CatalogUiNode` do pacote. O schema/validação vêm de
 * `useSystemsCatalog.normalizeSystemsResponse` (fonte única — o envelope
 * `{ data: [...] }` é o mesmo do `?view=tree`; payload externo continua
 * `unknown` até passar daqui, normalização obrigatória do repo).
 */
const normalizeSystemsSearchResponse = (json: unknown): CatalogUiNode[] =>
  normalizeSystemsResponse(json).map(systemTreeNodeToUiNode);

/**
 * Parte "Identidade": parser (colar anúncio, no topo), título (largura
 * ampla), banner logo abaixo do título (§Gap 10 item 1), descrição, "Regras
 * e observações da mesa" logo abaixo da Descrição (T4.0o), sistema
 * (CatalogSystemSelector em 3 colunas com busca server-side — T4.0h-bis),
 * cenário e estilos (os dois juntos, T4.0x).
 *
 * Os campos cortados por R17/A17 (§Gap 8) NÃO existem aqui: synopsis,
 * synopsis_narrative, style_text, listing_excerpt, benefits_text.
 */
interface IdentityPartProps {
  api: TableEditorApi;
  systemsTree: SystemTreeNode[];
  systemsLoading: boolean;
  systemsError: string | null;
  onRefreshSystems: () => void;
  selectedScenarioName: string | null;
  parseText: string;
  onParseTextChange: (text: string) => void;
  onPreviewReady: (result: { data: unknown; parseCaseId: string | null }) => void;
  currentUserName?: string | null;
}

export function IdentityPart({
  api,
  systemsTree,
  systemsLoading,
  systemsError,
  onRefreshSystems,
  selectedScenarioName,
  parseText,
  onParseTextChange,
  onPreviewReady,
  currentUserName,
}: IdentityPartProps) {
  const { state, patch, errors, validateFieldOnBlur } = api;

  const [showParser, setShowParser] = useState(false);
  const [showSystemSuggestion, setShowSystemSuggestion] = useState(false);
  const [systemSuggestionName, setSystemSuggestionName] = useState('');
  const [showScenarioSuggestion, setShowScenarioSuggestion] = useState(false);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  // Árvore local convertida para o contrato do pacote. Com a busca
  // server-side (fetchSystemOptions/fetchChildOptions abaixo) ela NÃO é a
  // fonte da busca — serve para o findPath reconstituir o caminho de uma
  // seleção pré-existente (edição de mesa já publicada) e para o fallback
  // enquanto o fetch não está ligado. Sem ela, o bloco "Selecionado" só
  // apareceria depois de um clique, e o rascunho aberto pareceria sem
  // sistema.
  const uiTree = useMemo(() => systemsTree.map(systemTreeNodeToUiNode), [systemsTree]);

  // Fonte server-side do nível sistema (R18/A21): GET /systems?search=.
  // useCallback estabiliza a referência — o componente guarda a função e não
  // refaz a busca por re-render (contrato documentado no pacote).
  const fetchSystemOptions = useCallback(
    async (query: string, signal: AbortSignal): Promise<CatalogUiNode[]> => {
      const params = new URLSearchParams({ search: query, limit: String(SYSTEM_SEARCH_LIMIT) });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao buscar sistemas.');
      }
      const json: unknown = await response.json();
      return normalizeSystemsSearchResponse(json);
    },
    [],
  );

  // Fonte server-side de filhos (R18/A21): GET /systems?parent_id=.
  const fetchChildOptions = useCallback(
    async (parent: CatalogUiNode, signal: AbortSignal): Promise<CatalogUiNode[]> => {
      const params = new URLSearchParams({ parent_id: parent.id });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao carregar opções do sistema.');
      }
      const json: unknown = await response.json();
      return normalizeSystemsSearchResponse(json);
    },
    [],
  );

  // onSuggest do seletor ligado ao SystemSuggestionModal EXISTENTE (T4.0h-bis
  // item 4): a busca sem resultado oferece sugerir com o termo digitado — o
  // termo pré-preenche o nome no modal, como o OnboardingPage já faz
  // (systemModalName → initialName). A sugestão aprovada escreve no catálogo
  // CENTRAL, o que faz o sistema aparecer também no downloads.
  const openSystemSuggestion = (query = '') => {
    setSystemSuggestionName(query);
    setShowSystemSuggestion(true);
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px] h-full overflow-hidden">
      {/* Parser "colar anúncio" (R5): componente preservado do fluxo antigo,
          agora dentro do editor. Texto levantado para o shell (sobrevive à
          troca de parte — lição do achado de 2026-08-18 em
          PainelMestrePage). */}
      <div className="flex flex-col gap-2">
        <ToggleButton
          id="table-editor-parser-toggle"
          pressed={showParser}
          onToggle={setShowParser}
          className="self-start"
        >
          {showParser ? 'Fechar' : 'Colar anúncio'}
        </ToggleButton>
        {showParser && (
          <Panel tone="subtle">
            <ParsePreviewTextArea
              currentUserName={currentUserName}
              text={parseText}
              onTextChange={onParseTextChange}
              onPreviewReady={(preview) => {
                onPreviewReady(preview);
                setShowParser(false);
              }}
            />
          </Panel>
        )}
      </div>

      {/* Título — largura ampla (o nome que o jogador lê primeiro; limite 200,
          alinhado ao backend — T4.0e). O control com `!max-w-[560px]` deixa o
          mestre ver o título inteiro enquanto escreve (o `!` vence o
          `width: 100%` de `.artificio-control`, que é unlayered). */}
      <EditorField
        fieldId="title"
        state={state}
        label="Título da mesa"
        hint="É o nome que o jogador lê primeiro — mostre o título inteiro enquanto escreve."
        error={errors.title}
      >
        <TextInput
          id="title"
          value={state.title}
          maxLength={200}
          onChange={(e) => patch({ title: e.target.value })}
          onBlur={() => validateFieldOnBlur('title')}
          invalid={!!errors.title}
          placeholder="Ex: A Queda do Império Sombrio"
          className="!max-w-[560px]"
        />
      </EditorField>

      {/* Banner logo abaixo do título (§Gap 10 item 1). ImageUploader REUSADO
          inteiro — as 13 capacidades vêm com ele (R19/A22), incluindo a
          legenda `imageKindHint` que agora orienta a proporção 1200×650 antes
          do envio (T4.0t-bis). */}
      <div data-ob="recommended" data-field="bannerUrl">
        <ImageUploader
          idPrefix="table-editor-banner"
          manualInputId="banner_url"
          label="Banner da Mesa"
          value={state.bannerUrl}
          onChange={(url) => {
            patch({ bannerUrl: url });
          }}
          onError={() => undefined}
          kind="table_banner"
          initialCropData={state.bannerCropData}
          onCropChange={(crop) => patch({ bannerCropData: crop })}
          imageWidth={state.bannerWidth}
          imageHeight={state.bannerHeight}
          onDimensionsChange={(dimensions) =>
            patch({
              bannerWidth: dimensions?.width ?? null,
              bannerHeight: dimensions?.height ?? null,
            })
          }
        />
        <p className="mt-1 text-xs opacity-75">
          Recomendado — mesas com banner aparecem em destaque.
        </p>
      </div>

      {/* Descrição */}
      <EditorField
        fieldId="description"
        state={state}
        label="Descrição da mesa"
        error={errors.description}
      >
        <ContentEditor
          value={state.description}
          onChange={(text) => patch({ description: text })}
          label="Descrição da mesa"
          placeholder="Descreva sua campanha, o tom da história, o que esperar…"
          minHeight={180}
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
      </EditorField>

      {/* "Regras e observações da mesa" — sobe para logo abaixo da Descrição
          (T4.0o); antes vivia no colapsável de avançados do StepFinal. */}
      <EditorField fieldId="rulesNotes" state={state} label="Regras e observações da mesa">
        <ContentEditor
          value={state.rulesNotes}
          onChange={(text) => patch({ rulesNotes: text })}
          label="Regras e observações da mesa"
          maxLength={EDITOR_TEXT_LIMITS.rulesNotes[1]}
          placeholder="Ex: Usamos regras homebrew para combate, proibido PvP, etc."
          minHeight={120}
        />
      </EditorField>

      {/* Sistema — CatalogSystemSelector em 3 colunas com busca server-side
          (T4.0h-bis): Sistema é só busca (?search=), Edição/Variante carregam
          sob demanda (?parent_id=), coluna sem filho não aparece, aliases por
          extenso nas opções (R18). selectedIds pré-carregados reconstituem o
          caminho via findPath na uiTree; onSelectionChange só dispara em
          clique do usuário — nunca por efeito de montagem —, então o autosave
          não é sobrescrito por estado vazio. */}
      <Panel tone="subtle">
        <EditorField
          fieldId="selectedSystemId"
          state={state}
          label="Sistema da mesa"
          error={errors.selectedSystemId}
        >
          {systemsLoading ? (
            <p className="text-[13px] opacity-60">Carregando árvore de sistemas…</p>
          ) : systemsError ? (
            <p className="text-[13px] text-[var(--state-danger-fg)]">{systemsError}</p>
          ) : (
            <CatalogSystemSelector
              tree={uiTree}
              selectedIds={state.selectedSystemId ? [state.selectedSystemId] : []}
              onSelectionChange={(ids) => patch({ selectedSystemId: ids[0] ?? '' })}
              fetchSystemOptions={fetchSystemOptions}
              fetchChildOptions={fetchChildOptions}
              onSuggest={openSystemSuggestion}
              idPrefix="table-editor-system"
            />
          )}
        </EditorField>
        <div className="flex justify-end gap-2">
          <ToggleButton
            id="table-editor-suggest-system"
            pressed={false}
            onToggle={() => openSystemSuggestion('')}
          >
            + Adicionar Sistema
          </ToggleButton>
        </div>
      </Panel>

      {/* Cenário (catálogo) e Ambientação (texto livre) na mesma parte
          (T4.0x): o de catálogo primeiro, o livre logo abaixo. */}
      <Panel tone="subtle">
        <EditorField
          fieldId="selectedScenarioId"
          state={state}
          label="Cenário"
          hint="Cenários são independentes de sistemas. Ex: Forgotten Realms pode ser jogado em D&D ou Pathfinder."
        >
          <ScenarioSelector
            key={`table-editor-scenario-${scenarioRefreshKey}`}
            selectedScenarioId={state.selectedScenarioId}
            onSelect={(id) => patch({ selectedScenarioId: id })}
            disabled={false}
          />
        </EditorField>
        <div className="flex justify-end gap-2">
          <ToggleButton
            id="table-editor-suggest-scenario"
            pressed={false}
            onToggle={() => setShowScenarioSuggestion(true)}
          >
            + Sugerir Cenário
          </ToggleButton>
        </div>

        <EditorField
          fieldId="settingName"
          state={state}
          label="Ambientação e estilos"
          hint="Para quando o cenário não está no catálogo — o texto livre da ambientação própria da mesa."
        >
          <SettingStylesField
            settingName={state.settingName}
            settingStyles={state.settingStyles}
            onSettingNameChange={(name) => patch({ settingName: name })}
            onSettingStylesChange={(styles) => patch({ settingStyles: styles })}
            selectedScenarioName={selectedScenarioName}
          />
        </EditorField>
      </Panel>

      {/* Montagem condicional (mesmo padrão do OnboardingPage): o modal lê
          initialName no mount, então montar só quando aberto garante que o
          termo digitado na busca chegue pré-preenchido ao nome da sugestão. */}
      {showSystemSuggestion && (
        <SystemSuggestionModal
          isOpen={showSystemSuggestion}
          onClose={() => setShowSystemSuggestion(false)}
          initialName={systemSuggestionName}
          onSuccess={(createdSystem) => {
            setShowSystemSuggestion(false);
            if (createdSystem?.id) {
              patch({ selectedSystemId: createdSystem.id });
            }
            onRefreshSystems();
          }}
        />
      )}

      <ScenarioSuggestionModal
        isOpen={showScenarioSuggestion}
        onClose={() => setShowScenarioSuggestion(false)}
        onSuccess={() => {
          setShowScenarioSuggestion(false);
          setScenarioRefreshKey((current) => current + 1);
        }}
      />
    </div>
  );
}
