import type { EditorPartId, FieldLevel, TableEditorState } from '../types';
import { normalizePriceType } from './editorMapping';
import { EDITOR_PARTS } from './editorParts';
import { contentOverflow } from '@artificio/content-editor';
import { validateContactValue } from '../../../utils/safeExternalUrl';

/**
 * Validação do editor de anúncio (spec 096, T4.0e/T4.5/T4.6).
 *
 * Regras que precisam sobreviver do fluxo antigo (`plan.md` §Regras de
 * validação), traduzidas para o modelo sem etapas:
 * - erro sempre leva à parte que contém o campo (equivalente do "um passo só
 *   valida o campo que ele renderiza" — validation.ts:158-166);
 * - sessão flexível é exclusiva (dia "a definir" → uma sessão só);
 * - fim de sessão é opcional;
 * - limites de texto iguais aos do backend (`tableValidators.ts`), com
 *   mensagem dizendo quantos caracteres passaram;
 * - validação de contato por canal via `validateContactValue` (fonte única
 *   com o editor de perfil e espelho do backend).
 *
 * A11: nenhuma marca sem validação — os dois conjuntos (campos marcados
 * obrigatórios na UI e regras de validação aqui) derivam da MESMA tabela
 * (`REQUIRED_FIELD_IDS` + `CONDITIONAL_REQUIRED`), não de duas listas.
 */

// ── Limites (fonte: backend/src/validators/tableValidators.ts) ─────────────
export const DESCRIPTION_MAX_LENGTH = 5000;
export const TITLE_MIN = 3;
// T4.0e (spec 096, decisão 2026-08-24): o front sobe de 100 para 200,
// alinhando ao backend (`tableValidators.ts:138`, z.max(200)); o maior título
// real tem 84 caracteres e o card já trunca por line-clamp-3.
export const TITLE_MAX = 200;
export const MAX_SLOTS = 20;
export const DESCRIPTION_MIN = 10;

/** Limites dos campos de texto livre que sobrevivem ao corte (§Gap 8). */
export const EDITOR_TEXT_LIMITS = {
  rulesNotes: ['Regras e observações', 2000],
  technicalRequirements: ['Requisitos técnicos', 1000],
  billingText: ['Detalhes de cobrança', 500],
  // T4.0p (onda 2): o campo de bio do mestre nesta mesa entrou no editor
  // (MasterPart) — herança do perfil + limite de 2000 (table_gm_bio).
  tableGmBio: ['Bio do mestre nesta mesa', 2000],
} as const satisfies Record<string, readonly [string, number]>;

// ── Registro único de obrigatoriedade (A11) ────────────────────────────────

/** Campos SEMPRE obrigatórios — marca e validação derivam daqui. */
export const REQUIRED_FIELD_IDS: ReadonlySet<string> = new Set([
  'title',
  'description',
  'selectedSystemId',
  'schedules',
  'slotsTotal',
  'slotsOpen',
  'contacts',
  // Os quatro abaixo são condicionais (só valem em certos estados); estão
  // listados aqui para o cruzamento do A11 ser um conjunto só.
  'actualGmName',
  'gamePlatformCustom',
  'communicationPlatformCustom',
  'priceValue',
]);

/** Campos RECOMENDADOS (R6/R6.1) — marca sem bloqueio de publicação. */
export const RECOMMENDED_FIELD_IDS: ReadonlySet<string> = new Set([
  'bannerUrl',
  'ageRating',
]);

/** Frase do ganho por campo recomendado (R6 — "marca + frase do ganho"). */
export const RECOMMENDED_GAIN: Record<string, string> = {
  bannerUrl: 'mesas com banner aparecem em destaque',
  // R6.1 (decisão 2026-08-24): redação do implementador, sugestão da spec.
  ageRating: 'ajuda o jogador a saber se a mesa é para ele',
};

/** Contexto mínimo para decidir o nível de um campo condicional. */
export interface FieldLevelContext {
  publisherRole?: string;
  vttPlatformId?: string;
  communicationPlatformId?: string;
  priceType?: string;
}

function isConditionallyRequired(fieldId: string, ctx?: FieldLevelContext): boolean {
  switch (fieldId) {
    case 'actualGmName':
      return ctx?.publisherRole === 'announcer';
    case 'gamePlatformCustom':
      return ctx?.vttPlatformId === 'custom';
    case 'communicationPlatformCustom':
      return ctx?.communicationPlatformId === 'custom';
    case 'priceValue':
      return normalizePriceType(ctx?.priceType) === 'paga';
    default:
      return false;
  }
}

/** Nível de um campo no estado atual — fonte única da marca visual. */
export function fieldLevel(fieldId: string, ctx?: FieldLevelContext): FieldLevel {
  if (REQUIRED_FIELD_IDS.has(fieldId)) {
    if (isConditionalField(fieldId)) {
      return isConditionallyRequired(fieldId, ctx) ? 'required' : 'optional';
    }
    return 'required';
  }
  if (RECOMMENDED_FIELD_IDS.has(fieldId)) return 'recommended';
  return 'optional';
}

/** Campos da lista de obrigatórios que só valem em estados específicos. */
export function isConditionalField(fieldId: string): boolean {
  return (
    fieldId === 'actualGmName' ||
    fieldId === 'gamePlatformCustom' ||
    fieldId === 'communicationPlatformCustom' ||
    fieldId === 'priceValue'
  );
}

/**
 * "Campo preenchido?" para a barra de progresso do editor (A3, revisão
 * adversarial Fase 4). A regra por campo era duplicada no TableEditor
 * (array `REQUIRED_FIELDS_FOR_PROGRESS` + switch de 11 casos) — agora vive
 * aqui, junto do registro único de obrigatoriedade (A11): quem itera os
 * obrigatórios é `REQUIRED_FIELD_IDS` e o nível condicional vem do
 * `fieldLevel` — nenhuma lista paralela.
 */
export function isFieldFilled(fieldId: string, state: TableEditorState): boolean {
  switch (fieldId) {
    case 'title':
      return state.title.trim().length > 0;
    case 'description':
      return state.description.trim().length > 0;
    case 'selectedSystemId':
      return state.selectedSystemId.trim().length > 0;
    case 'schedules':
      // A lista default nunca está vazia (o editor mantém UMA linha); o caso
      // degenerado (vazio) é coberto pelo erro de validação, que zera a
      // contagem de "preenchido" no progresso.
      return true;
    case 'slotsTotal':
      return state.slotsTotal.trim().length > 0;
    case 'slotsOpen':
      return state.slotsOpen.trim().length > 0;
    case 'contacts':
      return state.contacts.some((c) => c.value.trim().length > 0);
    case 'actualGmName':
      return state.actualGmName.trim().length > 0;
    case 'gamePlatformCustom':
      return state.gamePlatformCustom.trim().length > 0;
    case 'communicationPlatformCustom':
      return state.communicationPlatformCustom.trim().length > 0;
    case 'priceValue':
      return state.priceValue.trim().length > 0;
    default:
      return true;
  }
}

/** Parte que contém cada campo — erro sempre leva à parte do campo. */
export const FIELD_PART: Record<string, EditorPartId> = {
  title: 'identity',
  description: 'identity',
  rulesNotes: 'identity',
  bannerUrl: 'identity',
  selectedSystemId: 'identity',
  selectedScenarioId: 'identity',
  settingName: 'identity',
  settingStyles: 'identity',
  schedules: 'when',
  isPersonalizedSchedule: 'when',
  slotsTotal: 'when',
  slotsOpen: 'when',
  modality: 'where',
  vttPlatformId: 'where',
  gamePlatformCustom: 'where',
  communicationPlatformId: 'where',
  communicationPlatformCustom: 'where',
  requiresPc: 'where',
  requiresCamera: 'where',
  requiresMicrophone: 'where',
  city: 'where',
  state: 'where',
  priceType: 'values',
  priceValue: 'values',
  priceValueMonthly: 'values',
  acceptsDonations: 'values',
  suggestedDonationValue: 'values',
  billingText: 'values',
  sessionZeroFree: 'values',
  type: 'audience',
  ageRating: 'audience',
  experienceLevel: 'audience',
  tableLevel: 'audience',
  audience: 'audience',
  language: 'audience',
  contentWarnings: 'audience',
  safetyTools: 'audience',
  publisherRole: 'master',
  actualGmName: 'master',
  masterDisplayName: 'master',
  tableGmBio: 'master',
  contacts: 'master',
  campaignLength: 'extras',
  levelRange: 'extras',
  technicalRequirements: 'extras',
  isCovil: 'extras',
  ddal: 'extras',
};

export function partOfField(fieldId: string): EditorPartId {
  return FIELD_PART[fieldId] ?? 'identity';
}

// ── Validadores ────────────────────────────────────────────────────────────

export type EditorErrorMap = Record<string, string>;

/** "X caracteres acima do limite de Y" — regra do plan.md §Regras de validação. */
function excessMessage(rotulo: string, overflow: number, limite: number): string {
  return `${rotulo}: ${overflow} caracteres acima do limite de ${limite}`;
}

function titleError(state: TableEditorState): string | null {
  const v = state.title;
  if (!v || v.trim().length === 0) return 'Título obrigatório';
  if (v.length < TITLE_MIN) return `Título muito curto (mínimo ${TITLE_MIN} caracteres)`;
  if (v.length > TITLE_MAX) return excessMessage('Título', contentOverflow(v, TITLE_MAX), TITLE_MAX);
  return null;
}

function descriptionError(state: TableEditorState): string | null {
  const v = state.description;
  if (!v || v.trim().length === 0) return 'Descrição obrigatória';
  if (v.length < DESCRIPTION_MIN) {
    return `Descrição muito curta (mínimo ${DESCRIPTION_MIN} caracteres)`;
  }
  if (v.length > DESCRIPTION_MAX_LENGTH) {
    return excessMessage('Descrição', contentOverflow(v, DESCRIPTION_MAX_LENGTH), DESCRIPTION_MAX_LENGTH);
  }
  return null;
}

function systemError(state: TableEditorState): string | null {
  if (!state.selectedSystemId || state.selectedSystemId.trim().length === 0) {
    return 'Selecione um sistema';
  }
  return null;
}

/**
 * Sessão flexível é exclusiva (regra do fluxo antigo, validation.ts:80-82):
 * dia "a definir" ou sem horário → uma sessão só. No editor há UMA sessão
 * visível; a lista só teria mais de uma em mesa legada com horários extras
 * preservados, e aí o flexível não pode aparecer junto.
 */
function schedulesError(state: TableEditorState): string | null {
  if (state.schedules.length === 0) return 'Adicione pelo menos uma sessão';

  const first = state.schedules[0];
  const hasFlexible = state.isPersonalizedSchedule || first.day_of_week === 'to_define' || !first.start_time;
  if (hasFlexible && state.schedules.length > 1) {
    return 'Use apenas uma sessão quando dia ou horário estiver a definir';
  }
  if (!first.day_of_week) return 'Dia da semana obrigatório';
  return null;
}

function slotsTotalError(state: TableEditorState): string | null {
  const num = Number.parseInt(state.slotsTotal, 10);
  if (Number.isNaN(num)) return 'Número de vagas inválido';
  if (num < 1) return 'Mínimo 1 vaga';
  if (num > MAX_SLOTS) return `Máximo ${MAX_SLOTS} vagas`;
  return null;
}

function slotsOpenError(state: TableEditorState): string | null {
  const open = Number.parseInt(state.slotsOpen, 10);
  const total = Number.parseInt(state.slotsTotal, 10);
  if (Number.isNaN(open)) return 'Número de vagas inválido';
  if (open < 0) return 'Vagas abertas não pode ser negativa';
  if (!Number.isNaN(total) && open > total) {
    return 'Vagas abertas não pode ser maior que vagas totais.';
  }
  if (open > MAX_SLOTS) return `Máximo ${MAX_SLOTS} vagas`;
  return null;
}

/**
 * Contatos: mesma regra por canal do fluxo antigo (validation.ts:98-121),
 * via `validateContactValue` — canal de URL exige link alcançável;
 * Facebook/Instagram exigem host da própria rede (senão o contato some da
 * página pública sem erro nenhum).
 */
function contactsError(state: TableEditorState): string | null {
  const filled = state.contacts.filter((c) => c.value.trim().length > 0);
  if (filled.length === 0) return 'Adicione pelo menos um contato';

  for (let i = 0; i < state.contacts.length; i++) {
    const contact = state.contacts[i];
    if (!contact.channel) return `Contato ${i + 1}: canal obrigatório`;
    if (!contact.value || contact.value.trim().length === 0) continue; // vazio filtrado no payload
    const valueError = validateContactValue(contact.channel, contact.value);
    if (valueError) return `Contato ${i + 1}: ${valueError}`;
  }
  return null;
}

function actualGmNameError(state: TableEditorState): string | null {
  if (state.publisherRole !== 'announcer') return null;
  if (!state.actualGmName.trim()) {
    return 'Nome do mestre obrigatório quando você é apenas anunciante';
  }
  return null;
}

function gamePlatformCustomError(state: TableEditorState): string | null {
  if (state.vttPlatformId !== 'custom') return null;
  if (!state.gamePlatformCustom.trim()) return 'Informe a plataforma de jogo personalizada';
  return null;
}

function communicationPlatformCustomError(state: TableEditorState): string | null {
  if (state.communicationPlatformId !== 'custom') return null;
  if (!state.communicationPlatformCustom.trim()) {
    return 'Informe a plataforma de comunicação personalizada';
  }
  return null;
}

function priceValueError(state: TableEditorState): string | null {
  if (normalizePriceType(state.priceType) !== 'paga') return null;
  if (!state.priceValue || state.priceValue.trim() === '') {
    return 'Valor por sessão é obrigatório para mesa paga';
  }
  const parsed = Number.parseFloat(state.priceValue);
  if (!Number.isFinite(parsed)) return 'Informe um valor numérico válido';
  if (parsed < 0) return 'Valor não pode ser negativo';
  return null;
}

function textLimitError(value: string, fieldId: keyof typeof EDITOR_TEXT_LIMITS): string | null {
  const [rotulo, limite] = EDITOR_TEXT_LIMITS[fieldId];
  const overflow = contentOverflow(value, limite);
  if (overflow > 0) return excessMessage(rotulo, overflow, limite);
  return null;
}

/**
 * Valida um campo isolado (chamado no blur — nunca a cada tecla).
 * Retorna null quando válido ou quando o campo não é aplicável no estado
 * atual (condicionais desligados não acusam erro).
 */
export function validateEditorField(fieldId: string, state: TableEditorState): string | null {
  switch (fieldId) {
    case 'title':
      return titleError(state);
    case 'description':
      return descriptionError(state);
    case 'selectedSystemId':
      return systemError(state);
    case 'schedules':
      return schedulesError(state);
    case 'slotsTotal':
      return slotsTotalError(state);
    case 'slotsOpen':
      return slotsOpenError(state);
    case 'contacts':
      return contactsError(state);
    case 'actualGmName':
      return actualGmNameError(state);
    case 'gamePlatformCustom':
      return gamePlatformCustomError(state);
    case 'communicationPlatformCustom':
      return communicationPlatformCustomError(state);
    case 'priceValue':
      return priceValueError(state);
    case 'rulesNotes':
      return textLimitError(state.rulesNotes, 'rulesNotes');
    case 'technicalRequirements':
      return textLimitError(state.technicalRequirements, 'technicalRequirements');
    case 'billingText':
      return textLimitError(state.billingText, 'billingText');
    // T4.0p (spec 096, A19): a bio do mestre nesta mesa (table_gm_bio) tem o
    // limite registrado desde o corte — agora com campo no editor.
    case 'tableGmBio':
      return textLimitError(state.tableGmBio, 'tableGmBio');
    default:
      return null;
  }
}

/**
 * Validação completa (publicar). Retorna um mapa campo → mensagem; a UI
 * marca todos, foca o primeiro e lista as partes pendentes (A4). NADA é
 * salvo neste clique.
 */
export function validateEditorAll(state: TableEditorState): EditorErrorMap {
  const errors: EditorErrorMap = {};
  const fields = Object.keys(FIELD_PART);
  for (const fieldId of fields) {
    const message = validateEditorField(fieldId, state);
    if (message) errors[fieldId] = message;
  }
  return errors;
}

/** Partes com erro no mapa, na ordem da lateral. */
export function pendingParts(errors: EditorErrorMap): EditorPartId[] {
  const parts = new Set<EditorPartId>();
  for (const fieldId of Object.keys(errors)) {
    parts.add(partOfField(fieldId));
  }
  return [...parts].sort((a, b) => partOrderIndex(a) - partOrderIndex(b));
}

/**
 * Ordem da lateral, derivada de EDITOR_PARTS — a mesma lista que renderiza a
 * navegação. Era duplicada aqui como array literal: reordenar a lateral não
 * reordenava as pendências, e a divergência não quebraria teste nenhum.
 */
function partOrderIndex(partId: EditorPartId): number {
  return EDITOR_PARTS.findIndex((part) => part.id === partId);
}

/** Primeiro campo com erro, na ordem das partes — alvo do foco no A4. */
export function firstErrorField(errors: EditorErrorMap): string | null {
  const parts = pendingParts(errors);
  if (parts.length === 0) return null;
  const firstPart = parts[0];
  return Object.keys(errors).find((fieldId) => partOfField(fieldId) === firstPart) ?? null;
}
