import { useEffect } from 'react';
import { Banner, Panel, Select, TextInput } from '@artificio/ui';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import type { TableEditorState } from '../types';
import { useVttPlatforms } from '../../../hooks/useVttPlatforms';
import { useCommunicationPlatforms } from '../../../hooks/useCommunicationPlatforms';

/**
 * Parte "Onde joga": modalidade; VTT e comunicação (catálogos + "✏️
 * Personalizado"); os 3 requisitos técnicos NA MESMA PARTE da plataforma
 * (R3/R21/T4.0v — a auto-marcação por VTT é da Fase 5; os checkboxes
 * existem e são editáveis); cidade/estado só quando a modalidade NÃO é
 * online (R23, T4.0w).
 */
interface WherePartProps {
  api: TableEditorApi;
}

export function WherePart({ api }: WherePartProps) {
  const { state, patch, errors, validateFieldOnBlur } = api;
  // VTT/comunicação: online OU híbrida (spec 096, R3; backend
  // tableValidators.ts refine — "Plataforma VTT só para mesas online ou
  // híbridas").
  const isOnline = state.modality === 'online' || state.modality === 'hibrida';
  // Cidade/estado: modalidade com componente presencial (R23/A26 — "local só
  // em modalidade não-online", presencial OU híbrida).
  const showsLocation = state.modality === 'presencial' || state.modality === 'hibrida';

  const { platforms: vttPlatforms, loading: loadingVtts, error: errorVtts } = useVttPlatforms();
  const {
    platforms: communicationPlatforms,
    loading: loadingCommunicationPlatforms,
    error: errorCommunicationPlatforms,
  } = useCommunicationPlatforms();

  // Compatibilidade edição: a API pode devolver UUID em vtt_platform_id,
  // enquanto o select de VTT usa slug (paridade com StepConfig.tsx:86-98).
  useEffect(() => {
    if (!state.vttPlatformId || state.vttPlatformId === 'custom') return;
    if (loadingVtts || vttPlatforms.length === 0) return;
    const alreadySlug = vttPlatforms.some((platform) => platform.slug === state.vttPlatformId);
    if (alreadySlug) return;
    const matchedById = vttPlatforms.find((platform) => platform.id === state.vttPlatformId);
    if (matchedById) {
      patch({ vttPlatformId: matchedById.slug ?? '' });
    }
  }, [state.vttPlatformId, loadingVtts, vttPlatforms, patch]);

  // D5 (revisão adversarial Fase 4): trocar para online limpa city/state —
  // o campo some da tela, mas o valor antigo ficaria no estado e iria no
  // payload (campo invisível não limpo; mesmo defeito corrigido em
  // handlePriceTypeChange do ValuesPart, sessão 26-08-22_1, A1).
  const handleModalityChange = (value: string) => {
    if (value === 'online') {
      patch({ modality: value, city: '', state: '' });
      return;
    }
    patch({ modality: value });
  };

  // Erro de carga → reseta a seleção de catálogo (o select cai no fallback
  // "Personalizado"): seleção de slug sem as opções renderizaria vazio e o
  // mestre publicaria com valor fantasma (paridade StepConfig.tsx:76-82).
  useEffect(() => {
    if (!errorVtts && !errorCommunicationPlatforms) return;
    let active = true;
    // setState deferido p/ fora do corpo síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (errorVtts && state.vttPlatformId && state.vttPlatformId !== 'custom') {
        patch({ vttPlatformId: '' });
      }
      if (
        errorCommunicationPlatforms &&
        state.communicationPlatformId &&
        state.communicationPlatformId !== 'custom'
      ) {
        patch({ communicationPlatformId: '' });
      }
    })();
    return () => { active = false; };
  }, [errorVtts, errorCommunicationPlatforms, state.vttPlatformId, state.communicationPlatformId, patch]);

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px] h-full overflow-hidden">
      <EditorField
        fieldId="modality"
        state={state}
        label="Modalidade"
        hint="Online, presencial ou híbrida."
      >
        <Select
          id="modality"
          value={state.modality}
          onChange={(e) => handleModalityChange(e.target.value)}
          onBlur={() => validateFieldOnBlur('modality')}
        >
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
          <option value="hibrida">Híbrida</option>
        </Select>
      </EditorField>

      {isOnline && (
        <Panel tone="subtle">
          <CatalogPlatformSelect
            state={state}
            fieldId="vttPlatformId"
            customFieldId="gamePlatformCustom"
            label="Plataforma de jogo (VTT)"
            customLabel="Plataforma de jogo personalizada"
            value={state.vttPlatformId}
            customValue={state.gamePlatformCustom}
            options={vttPlatforms}
            loading={loadingVtts}
            error={errorVtts}
            optionValue="slug"
            errorMessage={errors.gamePlatformCustom}
            customErrorMessage={errors.gamePlatformCustom}
            customPlaceholder="Ex: Teatro da Mente, Plataforma própria"
            emptyLabel="Selecione a plataforma"
            onValueChange={(value) => patch({ vttPlatformId: value })}
            onCustomChange={(value) => patch({ gamePlatformCustom: value })}
            onFieldBlur={validateFieldOnBlur}
          />

          <CatalogPlatformSelect
            state={state}
            fieldId="communicationPlatformId"
            customFieldId="communicationPlatformCustom"
            label="Plataforma de comunicação"
            customLabel="Plataforma de comunicação personalizada"
            value={state.communicationPlatformId}
            customValue={state.communicationPlatformCustom}
            options={communicationPlatforms}
            loading={loadingCommunicationPlatforms}
            error={errorCommunicationPlatforms}
            optionValue="id"
            errorMessage={errors.communicationPlatformCustom}
            customErrorMessage={errors.communicationPlatformCustom}
            customPlaceholder="Ex: Discord da comunidade, TeamSpeak"
            emptyLabel="Selecione a plataforma"
            onValueChange={(value) => patch({ communicationPlatformId: value })}
            onCustomChange={(value) => patch({ communicationPlatformCustom: value })}
            onFieldBlur={validateFieldOnBlur}
          />
        </Panel>
      )}

      {/* Requisitos técnicos em lista explícita, junto da plataforma (R21) —
          auto-marcação por VTT é da Fase 5 (T5.3); aqui os checkboxes são
          editáveis pelo mestre. */}
      <Panel tone="subtle">
        <p className="mb-2 font-semibold">Requisitos técnicos da mesa</p>
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleButton
            id="requires_pc"
            pressed={state.requiresPc}
            onToggle={(pressed) => patch({ requiresPc: pressed })}
          >
            Requer computador (não funciona em mobile)
          </ToggleButton>
          <ToggleButton
            id="requires_camera"
            pressed={state.requiresCamera}
            onToggle={(pressed) => patch({ requiresCamera: pressed })}
          >
            Requer câmera ligada durante as sessões
          </ToggleButton>
          <ToggleButton
            id="requires_microphone"
            pressed={state.requiresMicrophone}
            onToggle={(pressed) => patch({ requiresMicrophone: pressed })}
          >
            Requer microfone funcional
          </ToggleButton>
        </div>
      </Panel>

      {/* Cidade/estado em presencial OU híbrida (R23/A26): 107/107 mesas em
          produção são online; o form antigo já condicionava VTT/comunicação
          ao isOnline, e a exibição pública já é condicional. O backend não
          exige city/state (opcional no tableValidators) — aqui é exibição
          condicional, não obrigatoriedade. */}
      {showsLocation && (
        <div className="flex flex-wrap gap-3.5 items-start">
          <EditorField
            fieldId="city"
            state={state}
            label="Cidade"
            hint="Onde as sessões acontecem."
          >
            <TextInput
              id="city"
              value={state.city}
              onChange={(e) => patch({ city: e.target.value })}
              onBlur={() => validateFieldOnBlur('city')}
              placeholder="Ex: São Paulo"
              maxLength={100}
              className="!w-[206px]"
            />
          </EditorField>
          <EditorField fieldId="state" state={state} label="Estado (UF)">
            <TextInput
              id="state"
              value={state.state}
              onChange={(e) => patch({ state: e.target.value })}
              onBlur={() => validateFieldOnBlur('state')}
              placeholder="Ex: SP"
              maxLength={2}
              className="!w-[206px]"
            />
          </EditorField>
        </div>
      )}
    </div>
  );
}

export interface CatalogPlatformOption {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Select de catálogo (VTT ou comunicação) com a opção "✏️ Personalizado" e
 * campo livre, mais as regras do fluxo antigo (plan.md §Regras condicionais):
 * - carregando → select desabilitado com mensagem;
 * - erro de carga → fallback para a opção "Personalizado" (o mestre nunca
 *   fica sem saída) com Banner de aviso;
 * - "Personalizado" → campo livre com aviso de obrigatório.
 */
interface CatalogPlatformSelectProps {
  state: TableEditorState;
  /** fieldId do select (vttPlatformId | communicationPlatformId). */
  fieldId: string;
  /** fieldId do campo livre aberto pelo "Personalizado". */
  customFieldId: string;
  label: string;
  customLabel: string;
  value: string;
  customValue: string;
  options: CatalogPlatformOption[];
  loading: boolean;
  error: string | null;
  /** 'slug' (VTT) ou 'id' (comunicação) — o valor que identifica a opção. */
  optionValue: 'slug' | 'id';
  errorMessage?: string;
  customErrorMessage?: string;
  customPlaceholder: string;
  emptyLabel: string;
  onValueChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  onFieldBlur: (fieldId: string) => void;
}

function CatalogPlatformSelect({
  state,
  fieldId,
  customFieldId,
  label,
  customLabel,
  value,
  customValue,
  options,
  loading,
  error,
  optionValue,
  errorMessage,
  customErrorMessage,
  customPlaceholder,
  emptyLabel,
  onValueChange,
  onCustomChange,
  onFieldBlur,
}: CatalogPlatformSelectProps) {
  return (
    <div>
      <EditorField fieldId={fieldId} state={state} label={label} error={errorMessage}>
        <Select
          id={fieldId}
          value={value}
          disabled={loading}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={() => onFieldBlur(fieldId)}
          invalid={!!errorMessage}
        >
          <option value="">
            {loading ? 'Carregando plataformas…' : emptyLabel}
          </option>
          {!loading &&
            !error &&
            options.map((platform) => (
              <option
                key={platform.id}
                value={optionValue === 'slug' ? (platform.slug ?? platform.id) : platform.id}
                title={platform.name}
              >
                {platform.name}
              </option>
            ))}
          <option value="custom" title="Plataforma personalizada ou outra não listada">
            ✏️ Personalizado
          </option>
        </Select>
      </EditorField>

      {error ? (
        <Banner variant="warning" className="mt-2">
          Erro ao carregar plataformas. Você pode usar a opção "Personalizado".
        </Banner>
      ) : null}

      {value === 'custom' && (
        <EditorField
          fieldId={customFieldId}
          state={state}
          label={customLabel}
          error={customErrorMessage}
        >
          <TextInput
            id={customFieldId}
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            onBlur={() => onFieldBlur(customFieldId)}
            placeholder={customPlaceholder}
            invalid={!!customErrorMessage}
          />
        </EditorField>
      )}
    </div>
  );
}
