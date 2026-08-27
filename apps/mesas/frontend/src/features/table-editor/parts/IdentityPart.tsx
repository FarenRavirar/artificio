import { useCallback, useState } from 'react';
import { Button, Panel, TextInput } from '@artificio/ui';
import { CatalogSystemSelector } from '@artificio/catalog-ui';
import type { CatalogUiNode } from '@artificio/catalog-ui';
import { systemTreeNodeToUiNode } from '../../../utils/systemTreeNodeToUiNode';
import { authGet } from '../../../utils/authenticatedFetch';
import { normalizeSystemsResponse } from '../../../hooks/useSystemsCatalog';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import { ContentEditor } from '@artificio/content-editor';
import { ImageUploader } from '../../../components/ImageUploader';
import { ScenarioSelector } from '../../../components/ScenarioSelector';
import { SettingStylesField } from '../../../components/SettingStylesField';
import { SystemSuggestionModal } from '../../../components/SystemSuggestionModal';
import { ScenarioSuggestionModal } from '../../../components/ScenarioSuggestionModal';
import { ParsePreviewTextArea } from '../../create-table/components/ParsePreviewTextArea';
import { ParserSignalsPanel } from '../components/ParserSignalsPanel';
import { DESCRIPTION_MAX_LENGTH, EDITOR_TEXT_LIMITS } from '../utils/editorValidation';

/**
 * Limite da busca server-side de sistemas (R18/A21). 5 é o número medido na
 * spec 096: `?search=vampiro&limit=5` devolve 423 bytes contra 503.907 do
 * `?view=tree` — o suficiente para uma coluna de opções sem despejar o
 * catálogo inteiro.
 */
const SYSTEM_SEARCH_LIMIT = 5;
/** Margem sobre o exibido: a resposta traz níveis que a coluna Sistema descarta. */
const SYSTEM_SEARCH_FETCH_LIMIT = 25;

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
type IdentityPartProps = Readonly<{
  api: TableEditorApi;
  selectedScenarioName: string | null;
  /** Subgêneros do cenário do catálogo — sugestões de estilo sem rede extra. */
  selectedScenarioSubgenres?: string[];
  parseText: string;
  onParseTextChange: (text: string) => void;
  onPreviewReady: (result: { data: unknown; parseCaseId: string | null }) => void;
  currentUserName?: string | null;}>;

export function IdentityPart({
  api,
  selectedScenarioName,
  selectedScenarioSubgenres = [],
  parseText,
  onParseTextChange,
  onPreviewReady,
  currentUserName,
}: IdentityPartProps) {
  const { state, patch, errors, validateFieldOnBlur, parserFilledFields, parserSignals } = api;

  const [showParser, setShowParser] = useState(false);
  const [showSystemSuggestion, setShowSystemSuggestion] = useState(false);
  const [systemSuggestionName, setSystemSuggestionName] = useState('');
  const [showScenarioSuggestion, setShowScenarioSuggestion] = useState(false);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);


  // Fonte server-side do nível sistema (R18/A21): GET /systems?search=.
  // useCallback estabiliza a referência — o componente guarda a função e não
  // refaz a busca por re-render (contrato documentado no pacote).
  const fetchSystemOptions = useCallback(
    async (query: string, signal: AbortSignal): Promise<CatalogUiNode[]> => {
      // O `limit` pedido é MAIOR que o exibido de propósito: o servidor corta
      // antes de sabermos quais nós são raiz, e sem margem uma busca cujos
      // primeiros resultados são edições devolveria a coluna vazia.
      const params = new URLSearchParams({
        search: query,
        limit: String(SYSTEM_SEARCH_FETCH_LIMIT),
      });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao buscar sistemas.');
      }
      const json: unknown = await response.json();
      // Só RAÍZES nesta coluna: `?search=` achata a árvore filtrada
      // (`flattenTree(filterCatalogTree(...))` em systems.ts), então a resposta
      // mistura edições e variantes que casaram. Sem este filtro, buscar "5e"
      // listava o nó de edição ao lado do D&D como se fosse sistema — escolhê-lo
      // pulava um nível e a coluna "Edição" passava a exibir variantes.
      return normalizeSystemsSearchResponse(json)
        .filter((node) => node.parent_id === null)
        .slice(0, SYSTEM_SEARCH_LIMIT);
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

  /**
   * Caminho (raiz→nó) da seleção JÁ existente, sem baixar a árvore (R18/A21).
   *
   * Abrir uma mesa publicada precisa mostrar "Vampire › 5ª Edição" antes de
   * qualquer clique. Como `search` casa nome/slug/alias mas nunca id, a rota
   * ganhou `?id=` (spec 096): daí se pede o nó e se sobe por `parent_id` até a
   * raiz — no máximo 3 requisições de um nó cada, contra os 503.907 bytes que a
   * árvore inteira custava por abertura (§Gap 9, causa 2).
   */
  const fetchNodePath = useCallback(
    async (selectedId: string, signal: AbortSignal): Promise<CatalogUiNode[]> => {
      const nodeById = async (id: string): Promise<CatalogUiNode | null> => {
        const params = new URLSearchParams({ id });
        const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
        if (!response.ok) throw new Error('Falha ao resolver o sistema selecionado.');
        return normalizeSystemsSearchResponse(await response.json())[0] ?? null;
      };

      const path: CatalogUiNode[] = [];
      let currentId: string | null = selectedId;

      // Profundidade máxima do catálogo: sistema → edição → variante.
      for (let step = 0; step < 3 && currentId; step++) {
        const node: CatalogUiNode | null = await nodeById(currentId);
        if (!node) break;
        path.unshift(node);
        currentId = node.parent_id;
      }

      return path;
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
    <div className="flex flex-col gap-3.5 max-w-[900px]">
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
        {/* Fase 6 (spec 096, T6.2/R5): sinais da última prévia — ambiguidades
            calculadas pelo backend e o que ele não reconheceu, exibidos ao
            mestre. Aviso, não validação: publicar nunca é bloqueado por isto
            (T6.5). */}
        {parserSignals ? (
          <ParserSignalsPanel signals={parserSignals} onSuggestSystem={openSystemSuggestion} />
        ) : null}
      </div>

      {/* Título — largura ampla (o nome que o jogador lê primeiro; limite 200,
          alinhado ao backend — T4.0e). O control com `!max-w-[560px]` deixa o
          mestre ver o título inteiro enquanto escreve (o `!` vence o
          `width: 100%` de `.artificio-control`, que é unlayered). */}
      <EditorField
        fieldId="title"
        state={state}
        parserMarked={parserFilledFields.has('title')}
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
        parserMarked={parserFilledFields.has('description')}
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
      <EditorField
        fieldId="rulesNotes"
        state={state}
        parserMarked={parserFilledFields.has('rulesNotes')}
        label="Regras e observações da mesa"
      >
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
          caminho via ?id= (fetchNodePath) — a árvore inteira NÃO é baixada
          (A21: "nunca view=tree"); onSelectionChange só dispara em clique do
          usuário — nunca por efeito de montagem —, então o autosave não é
          sobrescrito por estado vazio. */}
      <Panel tone="subtle">
        <EditorField
          fieldId="selectedSystemId"
          state={state}
          parserMarked={parserFilledFields.has('selectedSystemId')}
          label="Sistema da mesa"
          error={errors.selectedSystemId}
        >
          <CatalogSystemSelector
            selectedIds={state.selectedSystemId ? [state.selectedSystemId] : []}
            onSelectionChange={(ids) => patch({ selectedSystemId: ids[0] ?? '' })}
            fetchSystemOptions={fetchSystemOptions}
            fetchChildOptions={fetchChildOptions}
            fetchNodePath={fetchNodePath}
            onSuggest={openSystemSuggestion}
            idPrefix="table-editor-system"
          />
        </EditorField>
        <div className="flex justify-end gap-2">
          {/* Ação de uma via (abre modal), não controle de duas posições: como
              ToggleButton, expunha aria-pressed="false" fixo e o leitor de tela
              anunciava um botão alternável que nunca alterna. */}
          <Button
            id="table-editor-suggest-system"
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openSystemSuggestion('')}
          >
            + Adicionar Sistema
          </Button>
        </div>
      </Panel>

      {/* Cenário (catálogo) e Ambientação (texto livre) na mesma parte
          (T4.0x): o de catálogo primeiro, o livre logo abaixo. */}
      <Panel tone="subtle">
        <EditorField
          fieldId="selectedScenarioId"
          state={state}
          parserMarked={parserFilledFields.has('selectedScenarioId')}
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
          <Button
            id="table-editor-suggest-scenario"
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowScenarioSuggestion(true)}
          >
            + Sugerir Cenário
          </Button>
        </div>

        <EditorField
          fieldId="settingName"
          state={state}
          parserMarked={parserFilledFields.has('settingName')}
          label="Ambientação e estilos"
          hint="Para quando o cenário não está no catálogo — o texto livre da ambientação própria da mesa."
        >
          <SettingStylesField
            settingName={state.settingName}
            settingStyles={state.settingStyles}
            onSettingNameChange={(name) => patch({ settingName: name })}
            onSettingStylesChange={(styles) => patch({ settingStyles: styles })}
            selectedScenarioName={selectedScenarioName}
            selectedScenarioSubgenres={selectedScenarioSubgenres}
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
            // Sem árvore local para revalidar: o seletor resolve o nó novo
            // pelo próprio ?id= (fetchNodePath) ao receber o selectedIds.
            if (createdSystem?.id) {
              patch({ selectedSystemId: createdSystem.id });
            }
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
