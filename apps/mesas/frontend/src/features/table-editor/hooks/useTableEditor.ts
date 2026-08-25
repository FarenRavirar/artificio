import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { trackEvent } from '@artificio/analytics';
import type { DraftStatus } from '../../create-table/hooks/useAutosave';
import type { TableEditorState } from '../types';
import type { ContactMethodInput } from '../../../types/tables';
import { validateEditorAll, validateEditorField, firstErrorField } from '../utils/editorValidation';
import type { EditorErrorMap } from '../utils/editorValidation';
import {
  editorStateToPayload,
  mapGmMeToSnapshot,
  toProfileContactMethods,
} from '../utils/editorMapping';
import type { EditorPayload, GmProfileSnapshot } from '../utils/editorMapping';
import { useAutosave } from '../../create-table/hooks/useAutosave';
import { draftStorage } from '../../create-table/utils/draftStorage';
import { authGet, authPost, authPut, authPatch } from '../../../utils/authenticatedFetch';
import { useAuth } from '../../../contexts/useAuth';

/**
 * Hook central do editor de anúncio (spec 096, T4.4/T4.6/T4.7).
 *
 * - UM estado central (~50 campos), todos aceitando `initialData` — é o que
 *   faz criar e editar serem a mesma tela;
 * - validação por campo no BLUR (nunca a cada tecla) e ao publicar;
 * - publicar com pendências REVELA o que falta (marca todos, expõe o
 *   primeiro campo para foco e lista as partes) e NADA é salvo no clique;
 * - rascunho local preservado (useAutosave debounce 1s + draftStorage 7
 *   dias + modal Continuar/Descartar) e GRAVADO NO SERVIDOR (debounce 2,5s,
 *   só para rascunho) — o draft cruza máquinas; mesa no ar só muda com o
 *   clique de salvar/publicar.
 */

export interface TableEditorInitialData extends Partial<TableEditorState> {
  id?: string;
  status?: string;
}

export interface TableEditorOptions {
  initialData?: TableEditorInitialData;
  onPublished: () => void;
}

/** Chave do rascunho local do editor novo (o do wizard antigo, 'create-table-draft', tem o shape antigo). */
export const EDITOR_DRAFT_KEY = 'table-editor-draft';

export function createDefaultEditorState(): TableEditorState {
  return {
    title: '',
    description: '',
    rulesNotes: '',
    bannerUrl: '',
    bannerCropData: null,
    bannerWidth: null,
    bannerHeight: null,
    selectedSystemId: '',
    selectedScenarioId: null,
    settingName: '',
    settingStyles: [],

    schedules: [{
      day_of_week: 'segunda',
      start_time: '19:00',
      end_time: '',
      frequency: 'semanal',
      is_ongoing: false,
      notes: '',
      sort_order: 0,
    }],
    isPersonalizedSchedule: false,
    slotsTotal: '4',
    slotsOpen: '4',

    modality: 'online',
    vttPlatformId: '',
    gamePlatformCustom: '',
    communicationPlatformId: '',
    communicationPlatformCustom: '',
    requiresPc: false,
    requiresCamera: false,
    requiresMicrophone: false,
    city: '',
    state: '',

    priceType: 'gratuita',
    priceValue: '',
    priceValueMonthly: '',
    acceptsDonations: false,
    suggestedDonationValue: '',
    billingText: '',
    sessionZeroFree: false,

    type: 'campanha',
    ageRating: 'livre',
    experienceLevel: 'todos',
    tableLevel: '',
    audience: 'livre',
    language: 'pt-BR',
    contentWarnings: [],
    safetyTools: [],

    publisherRole: 'gm',
    actualGmName: '',
    masterDisplayName: '',
    contacts: [{
      channel: 'whatsapp',
      value: '',
      label: '',
      discord_server_url: '',
    }],
    tableGmBio: '',
    campaignLength: '',
    levelRange: '',

    technicalRequirements: '',
    isCovil: false,
    ddal: {
      is_ddal: false,
      ddal_code: '',
      ddal_name: '',
      ddal_tier: '',
      ddal_season: '',
      ddal_duration: '',
      ddal_format: '',
      ddal_org_code: '',
      ddal_setting: '',
      ddal_rules_notes: '',
    },

    parseCaseId: null,
  };
}

/** Mescla initialData sobre o default, ignorando chaves `undefined`. */
export function buildInitialEditorState(
  initialData?: TableEditorInitialData,
): TableEditorState {
  const base = createDefaultEditorState();
  if (!initialData) return base;
  const merged: TableEditorState = { ...base };
  for (const key of Object.keys(initialData) as (keyof TableEditorState)[]) {
    const value = initialData[key];
    if (value !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

// ── Perfil do mestre: herança (T4.0p), criação no publish (T4.0p2) e
//    sincronização deliberada (T4.0q). ────────────────────────────────────────

/**
 * Estado do GET /gm/me no editor. `'none'` é a única situação em que o
 * publish cria o perfil (T4.0p2): com `'loading'`/`'error'` o publish segue
 * SEM criar — criar às cegas poderia duplicar perfil de mestre que já existe
 * (o backend valida slug, não user_id) quando o GET falhou por rede.
 */
export type GmProfileStatus =
  | { kind: 'loading' }
  | { kind: 'profile'; profile: GmProfileSnapshot }
  | { kind: 'none' }
  | { kind: 'error' };

/** Referência de "o mestre editou?" — o snapshot do perfil no carregamento. */
interface InheritedBaseline {
  displayName: string;
  bio: string;
  contacts: ContactMethodInput[];
}

/** Slug canônico do perfil a partir do nickname (mesma regra do formulário antigo). */
export function slugifyFromNickname(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // `[^a-z0-9]+` já colapsa cada lacuna num único hífen, então só sobram os
    // das pontas — sem alternância `^-+|-+$`, que o Sonar aponta por
    // backtracking super-linear.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');
}

/**
 * Rota de escrita do publish: PUT quando a mesa já existe no servidor (edição,
 * ou criação cujo autosave remoto já criou o rascunho — reusar o id evita mesa
 * duplicada + rascunho órfão); POST só na criação sem rascunho prévio.
 */
function resolveWriteTarget(
  isEditing: boolean,
  stateId: string | undefined,
  draftId: string | null,
): { method: 'PUT' | 'POST'; endpoint: string; reusesExistingTable: boolean } {
  if (isEditing) {
    return { method: 'PUT', endpoint: `/api/v1/gm/tables/${stateId}`, reusesExistingTable: true };
  }
  if (draftId !== null) {
    return { method: 'PUT', endpoint: `/api/v1/gm/tables/${draftId}`, reusesExistingTable: true };
  }
  return { method: 'POST', endpoint: '/api/v1/gm/tables', reusesExistingTable: false };
}

/**
 * Escreve o conteúdo da mesa e devolve o id NOVO quando foi um POST de criação
 * (null quando a escrita reusou uma mesa que já existia).
 */
async function writeTable(
  target: { method: 'PUT' | 'POST'; endpoint: string; reusesExistingTable: boolean },
  payload: EditorPayload,
  isEditing: boolean,
): Promise<string | null> {
  const res = target.method === 'PUT'
    ? await authPut(target.endpoint, payload)
    : await authPost(target.endpoint, payload);

  if (!res.ok) {
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error(submitErrorMessage(json, isEditing));
  }

  if (target.reusesExistingTable) return null;

  const json = (await res.json().catch(() => ({}))) as { data?: { id?: unknown } };
  // Criação sem id de volta é falha de publicação, não sucesso silencioso: sem
  // id não há como promover para 'active', e seguir adiante limparia o rascunho
  // local de uma mesa que ficou em draft.
  if (typeof json.data?.id !== 'string') {
    throw new Error('Erro ao criar mesa: resposta do servidor sem identificador.');
  }
  return json.data.id;
}

/** PATCH de promoção — o único caminho que grava `published_at`. */
async function promoteTableToActive(tableId: string): Promise<void> {
  const res = await authPatch(`/api/v1/gm/tables/${tableId}/status`, { status: 'active' });
  if (res.ok) return;

  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  throw new Error(
    (typeof json.error === 'string' && json.error) ||
    'Erro ao publicar a mesa. O rascunho foi salvo — tente publicar novamente.',
  );
}

/** Mensagem de erro do submit, na ordem json.error → json.message → default. */
function submitErrorMessage(json: Record<string, unknown>, isEditing: boolean): string {
  if (typeof json.error === 'string' && json.error) return json.error;
  if (typeof json.message === 'string' && json.message) return json.message;
  // Paridade com o wizard antigo, removido na T4.8 (useCreateTableForm:264-268).
  return isEditing ? 'Erro ao editar mesa' : 'Erro ao criar mesa';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ── B1 (revisão adversarial Fase 4): shape do rascunho local restaurado ──
// O draftStorage valida só o ENVELOPE (version/updatedAt/data); o DATA é
// mesclado sem checar tipo — campo de array que não é array (JSON antigo/
// adulterado) crasha no publish (.filter/.map/.some sobre não-array).
// Validar antes de mesclar: inválido → descarta o draft inteiro com warn
// (o editor nasce limpo em vez de travar no publish).

/** Campos de array do estado — os que o publish percorre. */
const DRAFT_ARRAY_FIELDS = [
  'schedules',
  'contacts',
  'settingStyles',
  'contentWarnings',
  'safetyTools',
] as const;

function isDraftContact(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.channel === 'string' &&
    typeof value.value === 'string'
  );
}

function isDraftSchedule(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.day_of_week === 'string' &&
    typeof value.start_time === 'string' &&
    typeof value.frequency === 'string' &&
    typeof value.is_ongoing === 'boolean' &&
    typeof value.sort_order === 'number'
  );
}

function isValidDraftState(value: unknown): value is TableEditorState {
  if (!isRecord(value)) return false;
  for (const key of DRAFT_ARRAY_FIELDS) {
    if (value[key] !== undefined && !Array.isArray(value[key])) return false;
  }
  // ddal alimenta o publish (state.ddal.is_ddal) — precisa ser objeto.
  if (value.ddal !== undefined && !isRecord(value.ddal)) return false;
  // Elementos corrompidos dentro dos dois arrays que o payload percorre
  // (contato não-objeto crasha em c.value.trim(); schedule é lido pelo
  // deriveSchedule).
  const contacts = value.contacts;
  if (Array.isArray(contacts) && !contacts.every(isDraftContact)) return false;
  const schedules = value.schedules;
  if (Array.isArray(schedules)) {
    if (!schedules.every(isDraftSchedule)) return false;
    // O editor tem UMA configuração de horário e o WhenPart lê schedules[0]
    // direto: rascunho com lista VAZIA (array válido, logo aceito pelas
    // checagens acima) deixaria esse acesso undefined e quebraria o render da
    // parte "Quando joga". Todo caminho legítimo nasce com uma linha
    // (estado inicial e mapeamento da mesa existente), então lista vazia é
    // draft corrompido — descarta inteiro, como os demais casos daqui.
    if (schedules.length === 0) return false;
  }
  return true;
}

/** Compara listas de contato ignorando linhas sem value (shape de edição). */
function contactsEqual(a: readonly ContactMethodInput[], b: readonly ContactMethodInput[]): boolean {
  const normalize = (list: readonly ContactMethodInput[]) =>
    list
      .filter((c) => c.value.trim().length > 0)
      .map((c) => ({
        channel: c.channel,
        value: c.value,
        label: c.label ?? '',
        discord_server_url: c.discord_server_url ?? '',
      }));
  const left = normalize(a);
  const right = normalize(b);
  if (left.length !== right.length) return false;
  return left.every(
    (contact, index) =>
      contact.channel === right[index].channel &&
      contact.value === right[index].value &&
      contact.label === right[index].label &&
      contact.discord_server_url === right[index].discord_server_url,
  );
}

export interface TableEditorApi {
  state: TableEditorState;
  /** Atualiza um campo (marca dirty e limpa o erro do campo editado). */
  patch: (partial: Partial<TableEditorState>) => void;
  /** Substitui o estado inteiro (rascunho restaurado, prévia do parser). */
  replaceState: (next: TableEditorState) => void;
  /** Valida um campo no blur — nunca a cada tecla. */
  validateFieldOnBlur: (fieldId: string) => void;
  errors: EditorErrorMap;
  /** true depois de tentativa de publicar com pendências (A4). */
  revealedPending: boolean;
  /** Publica: valida tudo; com pendências, revela e NÃO salva nada. */
  publish: () => Promise<boolean>;
  publishError: string | null;
  publishing: boolean;
  isDirty: boolean;
  draftStatus: DraftStatus;
  isEditing: boolean;
  isActive: boolean;
  // Modal de rascunho local ("Rascunho encontrado" — A15).
  showRestoreModal: boolean;
  savedDraft: TableEditorState | null;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  /** Primeiro campo com erro após publicar com pendências (alvo do foco, A4). */
  firstErrorFieldToFocus: string | null;
  // ── Perfil do mestre (T4.0p/T4.0p2/T4.0q) ─────────────────────────────
  /** GET /gm/me ainda em voo — o editor não sabe se há perfil. */
  gmProfileLoading: boolean;
  /** Perfil de mestre EXISTE (T4.0q: o botão de sincronizar só faz sentido com ele). */
  hasGmProfile: boolean;
  /** Por campo herdado, true quando o mestre EDITOU (valor != snapshot do perfil). */
  inheritedEdits: { displayName: boolean; bio: boolean; contacts: boolean };
  /** Algum campo herdado foi editado (condição do botão de sincronizar). */
  hasInheritedEdit: boolean;
  /**
   * T4.0q: grava nickname/bio/contatos atuais da mesa no perfil via
   * PUT /gm/profile. É a ÚNICA escrita mesa→perfil do editor — salvar a
   * mesa SEM clicar nunca toca gm_profiles (A20, coberto por teste).
   */
  syncProfileToMaster: () => Promise<boolean>;
  syncingProfile: boolean;
}

export function useTableEditor({ initialData, onPublished }: TableEditorOptions): TableEditorApi {
  const { user } = useAuth();
  const [state, setState] = useState<TableEditorState>(() =>
    buildInitialEditorState(initialData),
  );
  const [errors, setErrors] = useState<EditorErrorMap>({});
  const [revealedPending, setRevealedPending] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Perfil do mestre (T4.0p/T4.0p2/T4.0q) ──────────────────────────────
  const [gmProfileStatus, setGmProfileStatus] = useState<GmProfileStatus>({ kind: 'loading' });
  const [inheritedBaseline, setInheritedBaseline] = useState<InheritedBaseline | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);

  const isEditing = typeof state.id === 'string' && state.id.length > 0;
  const isActive = state.status === 'active';

  // ── Instrumentação (T4.0i, R15): editor_open/publish/abandon/parser_use ──
  // Convenção REAL do repo (MesaPage.tsx/CatalogoPage.tsx): import direto do
  // pacote @artificio/analytics, evento snake_case, props sem PII. Sem
  // `window.gtag` (jsdom/teste) o pacote é no-op — nenhum teste quebra.
  //
  // Snapshot do último render para o evento de ABANDONO: o cleanup do unmount
  // não pode ler o estado (já é o de um render velho). Definição sensível de
  // abandono: sair do editor com mudanças não salvas (isDirty) numa mesa que
  // ainda NÃO está no ar — mesa ativa não "abandona" (já está publicada) e
  // mestre que abre e sai sem tocar nada também não conta.
  const analyticsSnapshotRef = useRef({
    isEditing,
    isActive,
    isDirty: false,
    id: state.id,
  });
  useEffect(() => {
    analyticsSnapshotRef.current = { isEditing, isActive, isDirty, id: state.id };
  });

  // Início (montagem do editor). O guard de ref absorve o efeito de mount
  // duplo do StrictMode em dev (o remount preserva refs — dispara UMA vez).
  const trackedOpenRef = useRef(false);
  useEffect(() => {
    if (trackedOpenRef.current) return;
    trackedOpenRef.current = true;
    const snapshot = analyticsSnapshotRef.current;
    trackEvent('editor_open', {
      mode: snapshot.isEditing ? 'edit' : 'create',
      mesa_id: snapshot.id,
    });
  }, []);

  useEffect(() => {
    return () => {
      const snapshot = analyticsSnapshotRef.current;
      if (snapshot.isDirty && !snapshot.isActive) {
        trackEvent('editor_abandon', {
          mesa_id: snapshot.id,
          mode: snapshot.isEditing ? 'edit' : 'create',
        });
      }
    };
  }, []);

  // Carga do perfil + herança (T4.0p), UMA vez no mount. A herança só
  // preenche campo VAZIO e só para mestre (`gm`): mesa em edição com valor
  // salvo mantém o salvo; anunciante não herda nada. Preencher aqui NÃO
  // marca dirty — o valor herdado é estado inicial, não edição do mestre
  // (marcar dirty criaria rascunho remoto só por abrir o editor).
  useEffect(() => {
    let active = true;
    void (async () => {
      let status: GmProfileStatus;
      try {
        const res = await authGet('/api/v1/gm/me');
        if (!res.ok) {
          // 404 = mestre SEM perfil (contrato do backend, gmPanel.ts GET /me).
          status = res.status === 404 ? { kind: 'none' } : { kind: 'error' };
        } else {
          const json: unknown = await res.json().catch(() => null);
          const data = isRecord(json) ? json.data : null;
          const snapshot = mapGmMeToSnapshot(data);
          status = snapshot ? { kind: 'profile', profile: snapshot } : { kind: 'error' };
        }
      } catch {
        status = { kind: 'error' };
      }
      if (!active) return;

      setGmProfileStatus(status);
      if (status.kind === 'profile') {
        const profile = status.profile;
        setInheritedBaseline({
          displayName: profile.nickname,
          bio: profile.bioLong,
          contacts: profile.contactMethods,
        });
        setState((prev) => {
          if (prev.publisherRole !== 'gm') return prev;
          const next = { ...prev };
          let changed = false;
          if (!next.masterDisplayName.trim() && profile.nickname) {
            next.masterDisplayName = profile.nickname;
            changed = true;
          }
          if (!next.tableGmBio && profile.bioLong) {
            next.tableGmBio = profile.bioLong;
            changed = true;
          }
          // Contatos: TODOS os do perfil, com remover/adicionar livres
          // (decisão 2026-08-24); sem marca de origem — o campo vir
          // preenchido já comunica.
          if (!next.contacts.some((c) => c.value.trim()) && profile.contactMethods.length > 0) {
            next.contacts = profile.contactMethods.map((c) => ({ ...c }));
            changed = true;
          }
          return changed ? next : prev;
        });
      }
    })();
    return () => { active = false; };
  }, []);

  // "Editou?" por campo herdado — comparação com o snapshot do perfil
  // (não com flag por keystroke: editar de volta ao valor do perfil desfaz a
  // edição, e mesa legada com valor personalizado nasce já "editada").
  // Anunciante (publisherRole !== 'gm') NUNCA tem edição herdada: não herda
  // nada do perfil, e sem o filtro o botão de sincronizar apareceria para ele
  // com os campos vazios "diferentes" do perfil (enviaria vazio no PUT).
  const inheritedEdits = useMemo(() => {
    if (!inheritedBaseline || state.publisherRole !== 'gm') {
      return { displayName: false, bio: false, contacts: false };
    }
    return {
      displayName: state.masterDisplayName !== inheritedBaseline.displayName,
      bio: state.tableGmBio !== inheritedBaseline.bio,
      contacts: !contactsEqual(state.contacts, inheritedBaseline.contacts),
    };
  }, [state.masterDisplayName, state.tableGmBio, state.contacts, state.publisherRole, inheritedBaseline]);

  const hasInheritedEdit =
    inheritedEdits.displayName || inheritedEdits.bio || inheritedEdits.contacts;

  // A19: campos herdados NÃO editados saem do payload (a mesa espelha o
  // perfil). Contatos NÃO entram aqui: a mesa pública não tem fallback de
  // contatos para o perfil (tableViewMapper lê só table_contacts) — os
  // contatos pré-carregados são gravados na mesa no publish, e é isso que
  // fecha o elo perfil→mesa (T4.0p).
  const omitInherited = useMemo(() => {
    const omitted = new Set<'masterDisplayName' | 'tableGmBio'>();
    if (inheritedBaseline && state.publisherRole === 'gm') {
      if (!inheritedEdits.displayName) omitted.add('masterDisplayName');
      if (!inheritedEdits.bio) omitted.add('tableGmBio');
    }
    return omitted;
  }, [inheritedBaseline, state.publisherRole, inheritedEdits]);

  // Rascunho local: cache de digitação (7 dias), o mesmo contrato do fluxo
  // antigo — debounce 1s no useAutosave. C2 (revisão adversarial Fase 4):
  // SÓ na criação — em edição, gravar na chave global contaminaria a próxima
  // criação com o modal "Rascunho encontrado" apontando para OUTRA mesa
  // (edita mesa → volta sem publicar → Nova mesa → conteúdo da mesa anterior).
  // A edição de rascunho já é coberta pelo autosave REMOTO (PUT a cada 2,5s);
  // a recuperação de rascunho da CRIAÇÃO continua intacta.
  const { draftStatus, clearDraft } = useAutosave(state, {
    key: EDITOR_DRAFT_KEY,
    enabled: !isEditing,
  });

  // Aviso ao fechar a aba com mudanças não salvas — só quando isDirty
  // (paridade com o wizard antigo, removido na T4.8: useCreateTableForm
  // :171-181).
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // `preventDefault()` sozinho dispara o aviso nativo do navegador;
        // `e.returnValue` é deprecado e a mensagem custom é ignorada desde o
        // Chrome 51/Firefox 44 — o browser sempre mostra o texto dele.
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const patch = useCallback((partial: Partial<TableEditorState>) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, ...partial }));
    // Campo editado limpa o próprio erro (validação é no blur/publicar,
    // nunca a cada tecla — erro velho não deve ficar pairando).
    setErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(partial)) {
        if (key in next) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setPublishError(null);
  }, []);

  const replaceState = useCallback((next: TableEditorState) => {
    // T4.0i: aplicar a prévia do parser fecha o loop de uso do parser (R8,
    // spec 079). A restauração de rascunho chama replaceState com parseCaseId
    // null (limpo de propósito) — não dispara.
    if (typeof next.parseCaseId === 'string' && next.parseCaseId.length > 0) {
      trackEvent('editor_parser_use', { parse_case_id: next.parseCaseId });
    }
    setState(next);
    setErrors({});
    setRevealedPending(false);
    setPublishError(null);
  }, []);

  const validateFieldOnBlur = useCallback((fieldId: string) => {
    const message = validateEditorField(fieldId, state);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[fieldId] = message;
      else delete next[fieldId];
      return next;
    });
  }, [state]);

  // Restauração de rascunho local — só na CRIAÇÃO (sem id): em edição, o
  // dado que vale é o do servidor, e o modal competiria com ele.
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [savedDraft, setSavedDraft] = useState<TableEditorState | null>(null);

  useEffect(() => {
    if (isEditing) return;
    let active = true;
    // setState deferido p/ fora do corpo síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      const draft = draftStorage.load<TableEditorState>(EDITOR_DRAFT_KEY);
      if (!draft) return;
      // B1: shape inválido → descarta (o modal nunca oferece um estado que
      // quebraria o publish) e limpa o storage para não reaparecer.
      if (!isValidDraftState(draft)) {
        console.warn('[useTableEditor] Rascunho local com shape inválido — descartando.');
        draftStorage.clear(EDITOR_DRAFT_KEY);
        return;
      }
      setSavedDraft(draft);
      setShowRestoreModal(true);
    })();
    return () => { active = false; };
  }, [isEditing]);

  const handleRestoreDraft = useCallback(() => {
    if (!savedDraft) return;
    // parseCaseId é limpo ao restaurar rascunho (paridade com o wizard
    // antigo, removido na T4.8, CreateTableForm.tsx:164): o draft não
    // persiste o id do preview, e reenviá-lo contaminaria discord_parse_cases
    // com o resultado de mesa não relacionada.
    replaceState({ ...buildInitialEditorState(savedDraft), parseCaseId: null });
    setSavedDraft(null);
    setShowRestoreModal(false);
    toast.success('Rascunho restaurado');
  }, [savedDraft, replaceState]);

  const handleDiscardDraft = useCallback(() => {
    draftStorage.clear(EDITOR_DRAFT_KEY);
    setSavedDraft(null);
    setShowRestoreModal(false);
  }, []);

  // Rascunho NO SERVIDOR (T4.7): debounce de 2,5s após a última mudança —
  // o draft cruza máquinas e o local continua sendo cache de digitação.
  // SÓ rascunho: mesa no ar (isActive) nunca é alterada pelo autosave — a
  // mudança na mesa publicada espera o clique de "Salvar alterações".
  // Na criação, o primeiro POST cria a mesa draft e guarda o id (os saves
  // seguintes viram PUT); falha de save não bloqueia a digitação (toast).
  const [remoteDraftId, setRemoteDraftId] = useState<string | null>(
    typeof state.id === 'string' && state.id.length > 0 ? state.id : null,
  );

  // C1 (revisão adversarial Fase 4): ref de "publicando" + timer pendente do
  // autosave. O estado `publishing` não pode ser lido de dentro do timer
  // (closure velho), então o ref espelha a condição; o ref do timer deixa o
  // publish cancelar o autosave agendado antes do await da cadeia de publicar
  // (>2,5s) — sem isso o timer dispara no meio do publish com remoteDraftId
  // null e faz POST concorrente (mesa duplicada + rascunho órfão).
  const publishingRef = useRef(false);
  // Espelho do remoteDraftId para leitura DENTRO do publish: o id pode ser
  // criado pelo próprio publish (POST) e precisa valer já na chamada seguinte,
  // antes de qualquer re-render recompor a closure do useCallback.
  const remoteDraftIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serializa a CRIAÇÃO do rascunho remoto: sem isto, digitar de novo (ou
  // publicar) enquanto o primeiro POST está em voo dispara um segundo POST,
  // porque `remoteDraftId` ainda é null — dois rascunhos da mesma mesa no
  // painel. Guarda a promessa em curso para que a próxima escrita a aguarde em
  // vez de recriar (achado Codex, PR #286).
  const draftCreationRef = useRef<Promise<string | null> | null>(null);

  /**
   * Aguarda uma criação de rascunho JÁ em voo (não inicia nenhuma).
   *
   * O autosave pode ter disparado o POST segundos antes do publish. Sem esta
   * espera, o publish lê `remoteDraftId === null` — o POST ainda não voltou — e
   * cria a mesa de novo: dois rascunhos da mesma mesa no painel. Falha da
   * criação em voo não derruba o publish: ele segue e cria por conta própria.
   */
  const pendingDraftCreation = useCallback(async (): Promise<string | null> => {
    if (!draftCreationRef.current) return null;
    try {
      return await draftCreationRef.current;
    } catch {
      return null;
    }
  }, []);

  /**
   * Cria o rascunho no servidor e devolve o id, registrando a promessa em
   * `draftCreationRef` para que quem chegar no meio a aguarde em vez de emitir
   * um segundo POST (é o que a `pendingDraftCreation` lê).
   */
  const startDraftCreation = useCallback(async (payload: EditorPayload): Promise<string | null> => {
    const creation = (async () => {
      const res = await authPost('/api/v1/gm/tables', payload);
      if (!res.ok) throw new Error('POST rascunho falhou');
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: unknown } };
      if (typeof json.data?.id !== 'string') return null;
      // O id é gravado no ref ANTES de qualquer guard de desmonte: a mesa JÁ
      // existe no servidor. Descartá-lo aqui (o `if (!active) return` que vivia
      // nesta linha) fazia a próxima escrita ver `remoteDraftId === null` e
      // criar a mesa outra vez.
      remoteDraftIdRef.current = json.data.id;
      return json.data.id;
    })();

    draftCreationRef.current = creation;
    try {
      return await creation;
    } catch (err) {
      // Nada foi gravado: liberar para a próxima tentativa criar de novo.
      draftCreationRef.current = null;
      throw err;
    }
  }, []);

  /** Uma passada do autosave remoto: PUT no rascunho conhecido, ou cria um. */
  const saveRemoteDraft = useCallback(async (): Promise<string | null> => {
    // Mesma regra A19 do publish: o rascunho remoto não materializa campo
    // herdado que o mestre não editou (senão o draft viraria a "decisão" da
    // mesa antes do publish).
    const payload = editorStateToPayload(state, { omitInherited });
    // Uma criação em voo vale por todas: se outro disparo já está criando o
    // rascunho, espera o id dele em vez de emitir um segundo POST.
    const knownId = remoteDraftIdRef.current ?? remoteDraftId ?? (await pendingDraftCreation());

    if (knownId) {
      const res = await authPut(`/api/v1/gm/tables/${knownId}`, payload);
      if (!res.ok) throw new Error('PUT rascunho falhou');
      return null;
    }

    return startDraftCreation(payload);
  }, [state, omitInherited, remoteDraftId, pendingDraftCreation, startDraftCreation]);

  useEffect(() => {
    if (publishingRef.current || !isDirty || isActive) return;
    let active = true;

    const runAutosave = async () => {
      // C1: o timer pode ter disparado um instante antes do publish — rechecar
      // antes de qualquer fetch fecha a janela restante.
      if (!active || publishingRef.current) return;
      try {
        const createdId = await saveRemoteDraft();
        // setState só depois do guard — o cleanup do effect alcança o timer,
        // não o corpo async já em voo (C4a).
        if (createdId && active) setRemoteDraftId(createdId);
      } catch {
        if (active) toast.error('Não foi possível salvar o rascunho no servidor.');
      }
    };

    const timer = setTimeout(() => {
      if (!active || publishingRef.current) return;
      void runAutosave();
    }, 2500);
    autosaveTimerRef.current = timer;
    return () => {
      active = false;
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
      clearTimeout(timer);
    };
  }, [isDirty, isActive, saveRemoteDraft]);

  /** Cancela o timer pendente do autosave remoto (usado pelo publish — C1). */
  const cancelPendingAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  // Publicar: com pendências REVELA e não salva nada (A4); sem pendências,
  // grava o conteúdo (POST sem status na criação sem rascunho remoto → nasce
  // 'draft'; PUT na edição e na criação em que o autosave remoto JÁ criou o
  // rascunho — reusar o id evita mesa duplicada + rascunho órfão) e promove
  // para 'active' via PATCH /gm/tables/:id/status — o único caminho aceito
  // pelo backend (PUT rejeita 'status'; o PATCH grava published_at, notifica
  // admins e dispara o scrape de OG).

  /**
   * T4.0p2: cria o perfil do mestre no PRIMEIRO publish (só quando o GET
   * /gm/me respondeu 404 — nunca com estado de carga falho). Nickname vem do
   * campo da mesa, com fallback no nome da conta; o slug é derivado do
   * nickname e, em conflito (409), ganha sufixo numérico — o mestre não tem
   * onde editar slug dentro do editor, então o conflito se resolve sozinho.
   */
  const createGmProfileOnFirstPublish = useCallback(async (): Promise<boolean> => {
    const nickname = state.masterDisplayName.trim() || (user?.name ?? '').trim();
    if (!nickname) {
      setPublishError('Informe o nome de exibição do mestre para criar seu perfil.');
      return false;
    }

    const contactMethods = toProfileContactMethods(state.contacts);
    const baseSlug = slugifyFromNickname(nickname) || 'mestre';
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      const res = await authPost('/api/v1/gm/profile', {
        slug: candidateSlug,
        nickname,
        bio_long: state.tableGmBio,
        contact_methods: contactMethods,
      });

      if (res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const created = isRecord(json) ? mapGmMeToSnapshot(json.data) : null;
        const profile: GmProfileSnapshot = created ?? {
          nickname,
          bioLong: state.tableGmBio,
          contactMethods: state.contacts,
        };
        setGmProfileStatus({ kind: 'profile', profile });
        // O que o perfil TEM agora é o estado atual da mesa — referência
        // zerada para "nada foi editado ainda" (o botão de sincronizar só
        // volta quando o mestre editar de novo).
        setInheritedBaseline({
          displayName: nickname,
          bio: state.tableGmBio,
          contacts: state.contacts,
        });
        return true;
      }

      if (res.status !== 409) {
        const json: unknown = await res.json().catch(() => null);
        const message =
          isRecord(json) && typeof json.error === 'string'
            ? json.error
            : 'Erro ao criar perfil de mestre';
        throw new Error(message);
      }
      // 409 (slug em uso): tenta o sufixo numérico.
    }

    throw new Error('Não foi possível criar o perfil de mestre (identificador em uso).');
  }, [state.masterDisplayName, state.tableGmBio, state.contacts, user?.name]);

  const publish = useCallback(async (): Promise<boolean> => {
    // C1: levantar o guard ANTES de qualquer await — o effect do autosave
    // checa publishingRef ao agendar e o timer checa antes de disparar.
    publishingRef.current = true;
    setPublishing(true);
    setPublishError(null);

    const allErrors = validateEditorAll(state);
    if (Object.keys(allErrors).length > 0) {
      publishingRef.current = false;
      setErrors(allErrors);
      setRevealedPending(true);
      setPublishing(false);
      return false;
    }

    // C1: cancelar o timer pendente do autosave — ele dispararia com closure
    // velho (remoteDraftId null) durante o await da cadeia de publish e
    // criaria mesa duplicada + rascunho órfão. O guard acima já neutraliza o
    // disparo; o cancelamento evita o timer morto e o re-agendamento.
    cancelPendingAutosave();

    try {
      // T4.0p2 (spec 096, R12): mestre SEM perfil cria o perfil JUNTO com a
      // mesa, na ordem PERFIL primeiro, depois a mesa. Se a mesa falhar
      // DEPOIS, o perfil fica criado — comportamento ACEITO e documentado na
      // spec: o perfil criado é válido e a próxima tentativa de publish o
      // reaproveita (o GET /gm/me volta a vê-lo). Anunciante não tem perfil
      // de mestre e não herda nada — publica a mesa direto.
      if (state.publisherRole === 'gm' && gmProfileStatus.kind === 'none') {
        const profileReady = await createGmProfileOnFirstPublish();
        if (!profileReady) return false;
      }

      // T4.0i: id publicado para o evento de publicação (na criação o id
      // nasce do POST/PATCH de promoção; em mesa já ativa é o state.id).
      let publishedTableId: string | undefined = state.id;
      // Id devolvido pelo POST de criação (null nas demais rotas de escrita).
      let createdTableId: string | null = null;

      // C3: o parse_case_id só viaja no SUBMIT (publish) — o autosave remoto
      // usa o default (omite) para não reenviar o id do preview a cada 2,5s.
      const payload = editorStateToPayload(state, { omitInherited, includeParseCaseId: true });

      // Na criação, o autosave remoto pode já ter criado — ou estar criando
      // AGORA — o rascunho no servidor. Aguardar a criação em voo (em vez de só
      // ler o id) fecha a corrida que duplicava a mesa: com um POST a caminho,
      // o publish espera o id e faz PUT nele; sem nenhum, cria aqui.
      const draftIdNow = isEditing
        ? null
        : remoteDraftIdRef.current ?? remoteDraftId ?? (await pendingDraftCreation());

      const target = resolveWriteTarget(isEditing, state.id, draftIdNow);
      createdTableId = await writeTable(target, payload, isEditing);
      if (createdTableId) {
        // O POST acabou de materializar a mesa: guardar o id ANTES do próximo
        // await. Se o PATCH de promoção falhar, a mesa criada continua lá como
        // rascunho — sem isto, o próximo autosave/publish faria um SEGUNDO POST.
        remoteDraftIdRef.current = createdTableId;
        setRemoteDraftId(createdTableId);
      }

      // Promoção para o ar: criação sempre (nasceu draft) e edição de mesa que
      // ainda estava em rascunho. Mesa já ativa não passa pelo PATCH, que
      // promove o MESMO id da escrita acima.
      const tableId = createdTableId ?? (isEditing ? state.id : draftIdNow);
      if (!isActive && tableId) {
        await promoteTableToActive(tableId);
        publishedTableId = tableId;
      }

      // T4.0i: publicação com sucesso (só este caminho chega aqui — qualquer
      // falha acima lança e cai no catch).
      trackEvent('editor_publish', {
        mesa_id: publishedTableId,
        mode: isEditing ? 'edit' : 'create',
      });

      setIsDirty(false);
      clearDraft();
      setRevealedPending(false);
      onPublished();
      return true;
    } catch (err: unknown) {
      setPublishError(err instanceof Error && err.message ? err.message : 'Erro inesperado');
      return false;
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [
    state,
    isEditing,
    isActive,
    remoteDraftId,
    pendingDraftCreation,
    clearDraft,
    onPublished,
    gmProfileStatus.kind,
    omitInherited,
    cancelPendingAutosave,
    createGmProfileOnFirstPublish,
  ]);

  /**
   * T4.0q: grava nickname/bio/contatos atuais da mesa no perfil do mestre.
   * É a ÚNICA escrita mesa→perfil do editor, e só acontece neste clique —
   * o publish/autosave da mesa nunca tocam gm_profiles (A20, teste no
   * useTableEditor.test.tsx). Sucesso = a referência de herança passa a ser
   * o estado atual (o botão some até a próxima edição).
   */
  const syncProfileToMaster = useCallback(async (): Promise<boolean> => {
    if (gmProfileStatus.kind !== 'profile') {
      toast.error('Perfil de mestre não encontrado para sincronizar.');
      return false;
    }
    const nickname = state.masterDisplayName.trim();
    if (!nickname) {
      toast.error('Informe o nome de exibição antes de sincronizar.');
      return false;
    }

    setSyncingProfile(true);
    try {
      const res = await authPut('/api/v1/gm/profile', {
        nickname,
        bio_long: state.tableGmBio,
        contact_methods: toProfileContactMethods(state.contacts),
      });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const message =
          isRecord(json) && typeof json.error === 'string'
            ? json.error
            : 'Erro ao sincronizar o perfil.';
        throw new Error(message);
      }

      setInheritedBaseline({
        displayName: nickname,
        bio: state.tableGmBio,
        contacts: state.contacts,
      });
      setGmProfileStatus({
        kind: 'profile',
        profile: {
          nickname,
          bioLong: state.tableGmBio,
          contactMethods: state.contacts,
        },
      });
      toast.success('Perfil sincronizado!');
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : 'Erro ao sincronizar o perfil.');
      return false;
    } finally {
      setSyncingProfile(false);
    }
  }, [gmProfileStatus.kind, state.masterDisplayName, state.tableGmBio, state.contacts]);

  // Campo com erro para foco no A4 (o TableEditor foca quando revealedPending
  // muda). Derivado do mapa de erros, na ordem das partes.
  const firstField = useMemo(() => firstErrorField(errors), [errors]);

  return {
    state,
    patch,
    replaceState,
    validateFieldOnBlur,
    errors,
    revealedPending,
    publish,
    publishError,
    publishing,
    isDirty,
    draftStatus,
    isEditing,
    isActive,
    showRestoreModal,
    savedDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    firstErrorFieldToFocus: firstField,
    gmProfileLoading: gmProfileStatus.kind === 'loading',
    hasGmProfile: gmProfileStatus.kind === 'profile',
    inheritedEdits,
    hasInheritedEdit,
    syncProfileToMaster,
    syncingProfile,
  };
}
