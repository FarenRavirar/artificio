import type { ChangeEvent } from 'react';
import type { DraftFieldInsight, DraftFieldKey, DraftForm, DraftTableType, DraftModality, DraftPriceType, DraftFrequency, DraftDayOfWeek, DraftAgeRating, DraftExperienceLevel, DraftTableLevel, SimpleCatalogEntry } from '../draftFormUtils';
import type { AiAutomationConfig, CompletenessAuditCandidate, DiscordSlotsAmbiguity, LlmActivity } from '../types';
import type { SystemTreeNode } from '../../../types/systems';
import { SystemSearchSelect } from './SystemSearchSelect';
import { CatalogSearchSelect } from './CatalogSearchSelect';

interface DraftEditorTabProps {
  form: DraftForm;
  missingFields: string[];
  systems: SystemTreeNode[];
  systemsLoading: boolean;
  /** Pendência 2 (spec 058): catálogos de cenário/VTT/comunicação pro combobox com busca. */
  scenarios: SimpleCatalogEntry[];
  scenariosLoading: boolean;
  vttPlatforms: SimpleCatalogEntry[];
  vttPlatformsLoading: boolean;
  communicationPlatforms: SimpleCatalogEntry[];
  communicationPlatformsLoading: boolean;
  /** Fase I (spec 058): texto original da mensagem, já limpo de decoração (stripSeparatorLines). */
  contentRaw?: string | null;
  contentRawLoading?: boolean;
  coverPreviewUrl: string;
  coverError: string | null;
  coverUploading: boolean;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  shouldShowSlotsDisambiguation: boolean;
  slotsAmbiguity: DiscordSlotsAmbiguity | null;
  slotsInterpretation: 'filled_total' | 'open_total';
  fieldInsights?: Partial<Record<DraftFieldKey, DraftFieldInsight>>;
  aiConfig?: AiAutomationConfig | null;
  llmActivity?: LlmActivity | null;
  auditingCompleteness?: boolean;
  /** Botão pequeno por campo (2026-07-07): qual campo está sendo reauditado agora. */
  auditingField?: DraftFieldKey | null;
  completenessSuggestions?: CompletenessAuditCandidate[];
  savingFields: boolean;
  onUpdateForm: <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => void;
  onApplySuggestion?: (field: DraftFieldKey, value: unknown) => void;
  onAuditCompleteness?: () => void;
  onAuditField?: (field: DraftFieldKey) => void;
  onSystemChange: (systemId: string) => void;
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveCover: () => void;
  onSetSlotsInterpretation: (v: 'filled_total' | 'open_total') => void;
  onConfirmSlots: () => void;
}

const inputClass = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';

function ContentRawPanel({ loading, contentRaw }: { loading?: boolean; contentRaw?: string | null }) {
  if (loading) return <p className="mt-1 text-xs text-white/40">Carregando texto original...</p>;
  if (!contentRaw) return <p className="mt-1 text-xs text-white/40">Sem texto original disponível para este draft.</p>;
  return (
    <pre className="mt-1 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words text-xs text-white/70 leading-5">
      {contentRaw}
    </pre>
  );
}
const labelClass = 'block text-white/60 text-xs mb-1';

const sourceLabel: Record<DraftFieldInsight['source'], string> = {
  parser: 'Parser',
  'learning-store': 'Learning',
  deepseek: 'DeepSeek',
  humano: 'Humano',
};

const sourceClass: Record<DraftFieldInsight['source'], string> = {
  parser: 'bg-slate-500/20 text-slate-200',
  'learning-store': 'bg-emerald-500/20 text-emerald-200',
  deepseek: 'bg-blue-500/20 text-blue-200',
  humano: 'bg-orange-500/20 text-orange-200',
};

function formatSuggestion(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function FieldInsightNote({
  field, insight, onApply, onAuditField, auditingThisField,
}: {
  readonly field: DraftFieldKey;
  readonly insight?: DraftFieldInsight;
  readonly onApply?: (field: DraftFieldKey, value: unknown) => void;
  readonly onAuditField?: (field: DraftFieldKey) => void;
  readonly auditingThisField?: boolean;
}) {
  const suggestion = insight ? formatSuggestion(insight.suggestion) : '';
  const evidence = insight ? insight.evidence.slice(0, 2).join(' ') : '';
  if (!insight && !onAuditField) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] leading-4">
      {insight && (
        <span className={`rounded px-1.5 py-0.5 ${sourceClass[insight.source]}`}>{sourceLabel[insight.source]}</span>
      )}
      {suggestion && <span className="max-w-full truncate text-white/55">sugestão: {suggestion}</span>}
      {suggestion && onApply && (
        <button type="button" onClick={() => onApply(field, insight?.suggestion)} className="rounded bg-white/10 px-1.5 py-0.5 text-white/70 hover:bg-white/20">
          Aplicar
        </button>
      )}
      {evidence && <span className="max-w-full truncate text-white/45">{evidence}</span>}
      {onAuditField && (
        <button
          type="button"
          onClick={() => onAuditField(field)}
          disabled={auditingThisField}
          className="rounded bg-blue-500/20 px-1.5 py-0.5 text-blue-200 hover:bg-blue-500/30 disabled:opacity-40"
          title="Reanalisar este campo com IA (DeepSeek)"
        >
          {auditingThisField ? 'IA...' : 'IA'}
        </button>
      )}
    </div>
  );
}

export function DraftEditorTab({
  form, missingFields, systems, systemsLoading, contentRaw, contentRawLoading,
  scenarios, scenariosLoading, vttPlatforms, vttPlatformsLoading,
  communicationPlatforms, communicationPlatformsLoading,
  coverPreviewUrl, coverError, coverUploading, coverInputRef,
  shouldShowSlotsDisambiguation, slotsAmbiguity, slotsInterpretation, fieldInsights, savingFields,
  aiConfig, llmActivity, auditingCompleteness, auditingField, completenessSuggestions,
  onUpdateForm, onApplySuggestion, onAuditCompleteness, onAuditField, onSystemChange, onCoverUpload, onRemoveCover,
  onSetSlotsInterpretation, onConfirmSlots,
}: Readonly<DraftEditorTabProps>) {
  const aiOff = !aiConfig || aiConfig.mode === 'off' || aiConfig.killSwitch;
  // Achado CodeRabbit (PR #128): auditoria de completude e acao manual sob
  // demanda (T10.9, spec 058), independente do modo automatico — so o kill
  // switch real deve bloquear o botao. Usar aiOff aqui desligava a feature
  // justamente no estado padrao de producao (mode='off' por env nao setada).
  const auditCompletenessBlocked = !aiConfig || aiConfig.killSwitch;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4 items-start">
    <div className="space-y-4 min-w-0">
      {missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm" role="alert" aria-live="assertive">
          Campos pendentes: {missingFields.join(', ')}
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs ${aiOff ? 'bg-amber-500/20 text-amber-200' : 'bg-blue-500/20 text-blue-200'}`}>
            {aiOff ? 'Assistente IA desligado' : `Assistente IA ${aiConfig?.mode ?? 'ativo'}`}
          </span>
          <span className="text-xs text-white/45">
            DeepSeek: {llmActivity?.total ?? 0} chamada(s) nas ultimas {llmActivity?.window_hours ?? 24}h
          </span>
          {onAuditCompleteness && (
            <button type="button" onClick={onAuditCompleteness} disabled={auditingCompleteness || auditCompletenessBlocked} className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:opacity-40">
              {auditingCompleteness ? 'Auditando...' : 'Auditoria de completude'}
            </button>
          )}
        </div>
        {Array.isArray(completenessSuggestions) && completenessSuggestions.length > 0 && (
          <div className="mt-2 space-y-1">
            {completenessSuggestions.map((item, index) => (
              <p key={`${item.field}-${index}`} className="text-xs text-blue-100">
                <span className={`mr-1 rounded px-1 py-0.5 text-[10px] uppercase ${item.issue_type === 'incorrect' ? 'bg-red-500/20 text-red-200' : 'bg-amber-500/20 text-amber-200'}`}>
                  {item.issue_type === 'incorrect' ? 'conferir' : 'faltando'}
                </span>
                {item.field}: {formatSuggestion(item.value)} <span className="text-white/45">{item.evidence}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-start gap-3">
          <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {coverPreviewUrl ? (
              <img src={coverPreviewUrl} alt="Capa do draft" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/30">Sem capa</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-white">Capa</span>
              {form.cover_quality === 'low' && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">baixa resolução</span>}
            </div>
            <p className="truncate text-xs text-white/50">{coverPreviewUrl || 'Nenhuma imagem associada.'}</p>
            {coverError && <p className="mt-1 text-xs text-red-300" role="alert">{coverError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onCoverUpload} className="hidden" />
              <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                {coverUploading ? 'Enviando...' : 'Substituir'}
              </button>
              {coverPreviewUrl && (
                <button type="button" onClick={onRemoveCover} className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {shouldShowSlotsDisambiguation && slotsAmbiguity && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
          <p className="font-medium">Como interpretar {slotsAmbiguity.first}/{slotsAmbiguity.second} deste post?</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="slots-interpretation" checked={slotsInterpretation === 'filled_total'} onChange={() => onSetSlotsInterpretation('filled_total')} className="accent-amber-400" />
              <span>{slotsAmbiguity.first} inscritos / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} total</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="slots-interpretation" checked={slotsInterpretation === 'open_total'} onChange={() => onSetSlotsInterpretation('open_total')} className="accent-amber-400" />
              <span>{slotsAmbiguity.first} disponíveis / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} máximo</span>
            </label>
          </div>
          <button type="button" onClick={onConfirmSlots} disabled={savingFields} className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
            Confirmar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>Título</span>
          <input value={form.title} onChange={(e) => onUpdateForm('title', e.target.value)} className={inputClass} />
          <FieldInsightNote field="title" insight={fieldInsights?.title} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'title'} />
        </label>
        <label>
          <span className={labelClass}>Sistema</span>
          <SystemSearchSelect systems={systems} value={form.system_id} loading={systemsLoading} onChange={onSystemChange} />
          <FieldInsightNote field="system_name" insight={fieldInsights?.system_name} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'system_name'} />
        </label>
        <label>
          <span className={labelClass}>Tipo</span>
          <select value={form.type} onChange={(e) => onUpdateForm('type', e.target.value as DraftTableType)} className="app-select w-full">
            <option value="campanha">Campanha</option>
            <option value="one-shot">One-shot</option>
            <option value="oneshot-serie">Série de one-shots</option>
            <option value="aberta">Aberta</option>
          </select>
          <FieldInsightNote field="type" insight={fieldInsights?.type} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'type'} />
        </label>
        <label>
          <span className={labelClass}>Modalidade</span>
          <select value={form.modality} onChange={(e) => onUpdateForm('modality', e.target.value as DraftModality)} className="app-select w-full">
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
            <option value="hibrida">Híbrida</option>
          </select>
          <FieldInsightNote field="modality" insight={fieldInsights?.modality} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'modality'} />
        </label>
        <label>
          <span className={labelClass}>Preço</span>
          <select value={form.price_type} onChange={(e) => onUpdateForm('price_type', e.target.value as DraftPriceType)} className="app-select w-full">
            <option value="gratuita">Gratuita</option>
            <option value="paga">Paga</option>
          </select>
          <FieldInsightNote field="price_type" insight={fieldInsights?.price_type} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'price_type'} />
        </label>
        <label>
          <span className={labelClass}>Valor</span>
          <input value={form.price_value} onChange={(e) => onUpdateForm('price_value', e.target.value)} className={inputClass} placeholder="0" disabled={form.price_type === 'gratuita'} />
          <FieldInsightNote field="price_value" insight={fieldInsights?.price_value} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'price_value'} />
        </label>
        <label>
          <span className={labelClass}>Vagas totais</span>
          <input value={form.slots_total} onChange={(e) => onUpdateForm('slots_total', e.target.value)} className={inputClass} inputMode="numeric" />
          <FieldInsightNote field="slots_total" insight={fieldInsights?.slots_total} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'slots_total'} />
        </label>
        <label>
          <span className={labelClass}>Vagas abertas</span>
          <input value={form.slots_open} onChange={(e) => onUpdateForm('slots_open', e.target.value)} className={inputClass} inputMode="numeric" />
          <FieldInsightNote field="slots_open" insight={fieldInsights?.slots_open} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'slots_open'} />
        </label>
        <label>
          <span className={labelClass}>Dia</span>
          <select value={form.day_of_week} onChange={(e) => onUpdateForm('day_of_week', e.target.value as DraftDayOfWeek)} className="app-select w-full">
            <option value="">Selecione</option>
            <option value="segunda">Segunda</option>
            <option value="terça">Terça</option>
            <option value="quarta">Quarta</option>
            <option value="quinta">Quinta</option>
            <option value="sexta">Sexta</option>
            <option value="sábado">Sábado</option>
            <option value="domingo">Domingo</option>
          </select>
          <FieldInsightNote field="day_of_week" insight={fieldInsights?.day_of_week} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'day_of_week'} />
        </label>
        <label>
          <span className={labelClass}>Horário</span>
          <input value={form.start_time} onChange={(e) => onUpdateForm('start_time', e.target.value)} className={inputClass} placeholder="19:00" />
          <FieldInsightNote field="start_time" insight={fieldInsights?.start_time} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'start_time'} />
        </label>
        <label>
          <span className={labelClass}>Frequência</span>
          <select value={form.frequency} onChange={(e) => onUpdateForm('frequency', e.target.value as DraftFrequency)} className="app-select w-full">
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option>
            <option value="avulsa">Única</option>
            <option value="outra">Outra</option>
          </select>
          <FieldInsightNote field="frequency" insight={fieldInsights?.frequency} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'frequency'} />
        </label>
        <label>
          <span className={labelClass}>Contato Discord</span>
          <input value={form.contact_discord} onChange={(e) => onUpdateForm('contact_discord', e.target.value)} className={inputClass} />
          <FieldInsightNote field="contact_discord" insight={fieldInsights?.contact_discord} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'contact_discord'} />
        </label>
        <label className="md:col-span-2">
          <span className={labelClass}>Link de inscrição/contato</span>
          <input value={form.contact_url} onChange={(e) => onUpdateForm('contact_url', e.target.value)} className={inputClass} />
          <FieldInsightNote field="contact_url" insight={fieldInsights?.contact_url} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'contact_url'} />
        </label>
        <label className="md:col-span-2">
          <span className={labelClass}>Descrição</span>
          <textarea value={form.description} onChange={(e) => onUpdateForm('description', e.target.value)} className={`${inputClass} min-h-28 resize-y`} />
          <FieldInsightNote field="description" insight={fieldInsights?.description} onApply={onApplySuggestion} onAuditField={onAuditField} auditingThisField={auditingField === 'description'} />
        </label>

        {/* Fase D (spec 058): campos de auto-preenchimento ampliado — ver auto-preenchimento-draft.md */}
        <label>
          <span className={labelClass}>Classificação indicativa</span>
          <select value={form.age_rating} onChange={(e) => onUpdateForm('age_rating', e.target.value as DraftAgeRating)} className="app-select w-full">
            <option value="">Não informada</option>
            <option value="livre">Livre</option>
            <option value="10+">10+</option>
            <option value="12+">12+</option>
            <option value="14+">14+</option>
            <option value="16+">16+</option>
            <option value="18+">18+</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Nível de experiência do jogador</span>
          <select value={form.experience_level} onChange={(e) => onUpdateForm('experience_level', e.target.value as DraftExperienceLevel)} className="app-select w-full">
            <option value="">Não informado</option>
            <option value="todos">Todos</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="veterano">Veterano</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Complexidade da mesa</span>
          <select value={form.table_level} onChange={(e) => onUpdateForm('table_level', e.target.value as DraftTableLevel)} className="app-select w-full">
            <option value="">Não informada</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Cenário (catálogo)</span>
          <CatalogSearchSelect items={scenarios} value={form.scenario_id} loading={scenariosLoading} placeholder="Buscar cenário..." onChange={(id) => onUpdateForm('scenario_id', id)} />
        </label>
        <label>
          <span className={labelClass}>Cenário/Ambientação (texto livre)</span>
          <input value={form.setting_name} onChange={(e) => onUpdateForm('setting_name', e.target.value)} className={inputClass} />
        </label>
        <label className="md:col-span-2">
          <span className={labelClass}>Estilos (separados por vírgula)</span>
          <input value={form.setting_styles} onChange={(e) => onUpdateForm('setting_styles', e.target.value)} className={inputClass} placeholder="Fantasia, Investigação, Mistério" />
        </label>
        <label>
          <span className={labelClass}>Plataforma VTT</span>
          <CatalogSearchSelect items={vttPlatforms} value={form.vtt_platform_id} loading={vttPlatformsLoading} placeholder="Buscar plataforma VTT..." onChange={(id) => onUpdateForm('vtt_platform_id', id)} />
        </label>
        <label>
          <span className={labelClass}>Plataforma de comunicação</span>
          <CatalogSearchSelect items={communicationPlatforms} value={form.communication_platform_id} loading={communicationPlatformsLoading} placeholder="Buscar plataforma de comunicação..." onChange={(id) => onUpdateForm('communication_platform_id', id)} />
        </label>
        <div className="md:col-span-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={form.requires_pc} onChange={(e) => onUpdateForm('requires_pc', e.target.checked)} className="accent-orange-400" />
            <span>Requer PC</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={form.requires_camera} onChange={(e) => onUpdateForm('requires_camera', e.target.checked)} className="accent-orange-400" />
            <span>Requer câmera</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={form.requires_microphone} onChange={(e) => onUpdateForm('requires_microphone', e.target.checked)} className="accent-orange-400" />
            <span>Requer microfone</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={form.session_zero_free} onChange={(e) => onUpdateForm('session_zero_free', e.target.checked)} className="accent-orange-400" />
            <span>Sessão zero gratuita</span>
          </label>
        </div>
      </div>
    </div>

    <div className="lg:sticky lg:top-0 rounded-lg border border-white/10 bg-white/5 p-3">
      <span className={labelClass}>Texto original da mensagem</span>
      <ContentRawPanel loading={contentRawLoading} contentRaw={contentRaw} />
    </div>
    </div>
  );
}
