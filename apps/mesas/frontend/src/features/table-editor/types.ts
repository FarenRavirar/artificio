import type { CropRect } from '@artificio/media/image-kinds';
import type { SessionSchedule } from '../../components/SessionRepeater';
import type { ContactMethodInput } from '../../types/tables';

/**
 * Editor de anúncio da mesa — spec 096, Fase 4 (R1/R2).
 *
 * Substitui o wizard (CreateTableForm + form-steps) por um editor de campos
 * sempre abertos, sem etapas, sem gaveta e sem rolagem. Criar e editar são a
 * mesma tela: a diferença é o estado (`id`/`status`) e, na UI, o selo e o
 * rótulo do botão de publicar.
 */

export type EditorPartId =
  | 'identity'
  | 'when'
  | 'where'
  | 'values'
  | 'audience'
  | 'master'
  | 'extras';

/**
 * Três níveis de campo (R6): obrigatório (marca + palavra), recomendado
 * (marca + frase do ganho) e opcional. Todos são marcados — nenhum campo fica
 * sem indicação visual do que é.
 */
export type FieldLevel = 'required' | 'recommended' | 'optional';

export interface DdalFormState {
  is_ddal: boolean;
  ddal_code: string;
  ddal_name: string;
  ddal_tier: string;
  ddal_season: string;
  ddal_duration: string;
  ddal_format: string;
  ddal_org_code: string;
  ddal_setting: string;
  ddal_rules_notes: string;
}

/**
 * Estado central do editor (~50 campos). Todos os campos aceitam
 * `initialData` — é o que faz a edição funcionar na mesma tela da criação.
 *
 * Campos de texto grande cortados por R17/A17 (spec 096 §Gap 8) NÃO existem
 * aqui de propósito: `synopsis`, `synopsis_narrative`, `style_text`,
 * `listing_excerpt` e `benefits_text`. As colunas permanecem no banco
 * (T7.3b) e o payload simplesmente não as envia — `undefined` preserva o
 * valor salvo no PUT.
 *
 * `price_frequency` ganhou campo em T7.2b2 (Fase 7): a coluna já tinha leitor,
 * escritor e exibição pública (`TableActionPanel.tsx` renderiza "/ {frequência}"
 * ao lado do preço) e só faltava o ponto de entrada no editor.
 */
export interface TableEditorState {
  /** id da mesa no servidor — presente só em edição (e após criar rascunho). */
  id?: string;
  /** status no servidor: 'draft' | 'active' | ... — decide selo e botão. */
  status?: string;
  /**
   * Slug público da mesa — presente só em edição (a resposta de GET
   * /gm/tables/:id o devolve). É o destino de "Ver como jogador" (R22): sem
   * ele a página pública não existe, e o botão fica desabilitado.
   */
  slug?: string;

  // ── Identidade ──────────────────────────────────────────────────────────
  title: string;
  description: string;
  /** "Regras e observações da mesa" — sobe para logo abaixo da Descrição (T4.0o). */
  rulesNotes: string;
  bannerUrl: string;
  bannerCropData: CropRect | null;
  bannerWidth: number | null;
  bannerHeight: number | null;
  selectedSystemId: string;
  selectedScenarioId: string | null;
  settingName: string;
  settingStyles: string[];

  // ── Quando joga ─────────────────────────────────────────────────────────
  /**
   * Lista completa de horários. A UI edita SOMENTE o primeiro (menor
   * sort_order); os demais (mesas legadas com 2+, estruturalmente possíveis
   * mas nunca ocorridos em produção) são PRESERVADOS intactos no payload —
   * T4.0u: nunca apagar o que não se mostra.
   */
  schedules: SessionSchedule[];
  /**
   * "Horário personalizado" (R20/T4.0u): grava
   * `schedule_day_status='to_define'` + texto em `table_schedules.notes` —
   * contrato existente, sem coluna nova.
   */
  isPersonalizedSchedule: boolean;
  slotsTotal: string;
  slotsOpen: string;

  // ── Onde joga ───────────────────────────────────────────────────────────
  modality: string;
  /** slug do catálogo VTT ou 'custom'. */
  vttPlatformId: string;
  gamePlatformCustom: string;
  /** uuid do catálogo de comunicação ou 'custom'. */
  communicationPlatformId: string;
  communicationPlatformCustom: string;
  requiresPc: boolean;
  requiresCamera: boolean;
  requiresMicrophone: boolean;
  /** Só aparecem quando a modalidade não é online (R23). */
  city: string;
  state: string;

  // ── Valores ─────────────────────────────────────────────────────────────
  priceType: string;
  priceValue: string;
  priceValueMonthly: string;
  /**
   * Periodicidade da cobrança (`'sessao' | 'mes' | 'campanha'`), exibida no
   * público ao lado do preço. Só existe em mesa paga — string vazia quando
   * gratuita, que o payload traduz para `null` (T7.2b2).
   */
  priceFrequency: string;
  acceptsDonations: boolean;
  suggestedDonationValue: string;
  billingText: string;
  sessionZeroFree: boolean;

  // ── Para quem é ─────────────────────────────────────────────────────────
  type: string;
  /** '' = "não informado" (coluna nullable; nunca materializar 'livre'). */
  ageRating: string;
  experienceLevel: string;
  tableLevel: string;
  audience: string;
  language: string;
  contentWarnings: string[];
  safetyTools: string[];

  // ── Mestre e contato ────────────────────────────────────────────────────
  publisherRole: 'gm' | 'announcer';
  actualGmName: string;
  masterDisplayName: string;
  /**
   * Contatos no shape de EDIÇÃO único (T4.0r): tipo consolidado em
   * types/tables.ts (`ContactMethodInput`) — a mesma lista de 7 canais do
   * backend (TABLE_CONTACT_CHANNELS) e do perfil do mestre. T4.0p: em mesa
   * nova de mestre COM perfil, o campo chega pré-carregado com TODOS os
   * contatos do perfil (herança); o mestre remove/adiciona à vontade.
   */
  contacts: ContactMethodInput[];
  /**
   * Bio do mestre NESTA mesa (coluna table_gm_bio, limite 2000). T4.0p
   * (A19): não editada, é OMITIDA do payload e a mesa pública espelha a bio
   * do perfil (`table_gm_bio ?? gm_bio_long`); editada, vira da mesa e o
   * perfil permanece intacto.
   */
  tableGmBio: string;
  campaignLength: string;
  levelRange: string;

  // ── Regras e extras ─────────────────────────────────────────────────────
  technicalRequirements: string;
  isCovil: boolean;
  ddal: DdalFormState;

  /**
   * Requisito 8 (spec 079): id do discord_parse_case do pré-preenchimento.
   * Reenviado no submit para fechar o loop de aprendizado do parser; limpo
   * ao restaurar rascunho local (senão contamina discord_parse_cases).
   */
  parseCaseId: string | null;
}
