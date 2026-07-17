/** Domínio: todas as origens que produzem DiscordRawMessage. Ampla — inclui 'manual_paste' (inbox). */
export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json' | 'manual_paste';
export type DiscordSourceChannelType = 'text' | 'announcement' | 'forum';

export type DiscordImportMessageStatus =
  | 'pending'
  | 'parsed'
  | 'needs_review'
  | 'synced'
  | 'ignored'
  | 'error';

export type DiscordImportDraftStatus =
  | 'draft'
  | 'ready'
  | 'needs_review'
  | 'synced'
  | 'rejected';

export type TableDraftType = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
export type TableDraftModality = 'online' | 'presencial' | 'hibrida';
export type TableDraftPriceType = 'gratuita' | 'paga';
export type TableDraftFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa';
export type CoverQuality = 'standard' | 'low';
/** Fase B (spec 058): mesmos enums de `TablesTable` (db/types.ts) — mantidos em sincronia manual.
 * ATENÇÃO ao formato do enum Postgres real: `+18` (sinal ANTES do número), não `18+`.
 * Formato invertido aqui + em db/types.ts causou 500 "invalid input value for enum
 * age_rating: 18+" no sync de draft (achado do mantenedor 2026-07-08). */
export type TableDraftAgeRating = 'livre' | '+10' | '+12' | '+14' | '+16' | '+18';
export type TableDraftExperienceLevel = 'todos' | 'iniciante' | 'intermediario' | 'veterano';
export type TableDraftTableLevel = 'iniciante' | 'intermediario' | 'avancado';
export type DiscordImageUploadStatus =
  | 'pending'
  | 'success'
  | 'expired_url'
  | 'network'
  | 'cloudinary'
  | 'permanent_fail';
export type SlotsAmbiguitySource = 'x_slash_y';

export interface DiscordSlotsAmbiguity {
  first: number;
  second: number;
  source: SlotsAmbiguitySource;
}

export interface DiscordTableDraftSource {
  guild_id: string;
  channel_id: string;
  message_id: string;
  message_url: string;
  author_id?: string;
  author_name?: string;
}

export interface DiscordTableDraftTable {
  title: string | null;
  system_name: string | null;
  system_id: string | null;
  /**
   * Texto bruto extraído do nome do thread antes do ":" que o parser
   * tentou resolver como sistema mas não encontrou correspondência no banco.
   * Usado para criar system_suggestion automática e mostrar ao revisor
   * o que chegou do Discord antes de qualquer normalização.
   */
  raw_system_hint: string | null;
  /** Texto efetivamente usado no matching, preservado mesmo quando houve match. */
  _system_source_hint?: string | null;
  /** Alternativas determinísticas do catálogo para revisão rápida no picker. */
  _system_candidates?: Array<{
    system_id: string;
    name: string;
    score: number;
    reasons: string[];
  }> | null;
  type: TableDraftType | null;
  modality: TableDraftModality | null;
  price_type: TableDraftPriceType | null;
  price_value: number | null;
  slots_total: number | null;
  slots_filled: number | null;
  slots_open: number | null;
  day_of_week: string | null;
  start_time: string | null;
  frequency: TableDraftFrequency | null;
  description: string | null;
  /**
   * Achado do mantenedor (2026-07-17): campo já existe na tabela `tables`
   * (`rules_notes`, migration_04) e no form manual de onboarding, mas nunca
   * era extraído do texto/Discord — anúncio com "Regras da mesa:" (heading
   * ou label simples) se perdia no draft de import. Texto livre, distinto de
   * `description` — opcional, sem impacto em missing_fields/confidence.
   */
  rules_notes: string | null;
  contact_discord: string | null;
  /** Achado CodeRabbit (PR #140): contact_discord pode ser fallback pro autor
   * da mensagem quando não há menção/URL explícita (DEB-048-26). Este campo
   * distingue contato publicado de verdade vs. fallback — usado pelo filtro
   * "importar só com contato confirmado" (requireExplicitContact). */
  contact_discord_explicit: boolean;
  contact_url: string | null;
  host_discord_id: string | null;
  /**
   * Requisito 7 (spec 079): nome do mestre extraído como TEXTO de labels
   * `Mestre:`/`Narrador:`/`GM:`/`DM:` (distinto de `host_discord_id`, que só
   * captura menção `<@id>`). Achado real: divulgador do anúncio nem sempre é
   * o mestre de fato ("Narrador: um conhecido meu, apenas estou postando por
   * ele") — sem isso, `syncHelpers.ts` só tinha o autor da mensagem Discord
   * como fonte de `actual_gm_name`, que fica errado nesse caso.
   */
  raw_gm_name: string | null;
  /** Fase B/C (spec 058): campos novos de auto-preenchimento — ver `auto-preenchimento-draft.md`. */
  scenario_id: string | null;
  raw_scenario_hint: string | null;
  /** Achado Codex (PR #173, P2): `raw_scenario_hint` só preenche quando o
   * cenário NÃO casou no catálogo — correção de cenário errado-mas-casado
   * (parser achou entrada errada) nunca tinha hint pro learning aprender.
   * Hint separado, sempre preenchido quando há texto de cenário no anúncio,
   * independente de ter casado ou não (mesmo princípio de
   * `_vtt_source_hint`/`_communication_source_hint`). */
  _scenario_source_hint?: string | null;
  vtt_platform_id: string | null;
  /** Achado do mantenedor (2026-07-17): texto isolado da linha "Plataforma(s)"/
   * "Local do jogo" usado no match de VTT — persistido pro learning genérico
   * (`ENTITY_HINT_FIELDS`) conseguir aprender token bruto→entidade quando o
   * mestre corrige vtt_platform_id manualmente no draft (antes o mecanismo
   * só existia pra system_entity). Null quando não há label dedicado (match
   * caiu no fullText, sem hint isolado seguro pra aprender). */
  _vtt_source_hint?: string | null;
  communication_platform_id: string | null;
  /** Mesmo princípio de `_vtt_source_hint`, para communication_platform_id. */
  _communication_source_hint?: string | null;
  age_rating: TableDraftAgeRating | null;
  setting_name: string | null;
  setting_styles: string[] | null;
  experience_level: TableDraftExperienceLevel | null;
  table_level: TableDraftTableLevel | null;
  requires_pc: boolean | null;
  requires_camera: boolean | null;
  requires_microphone: boolean | null;
  session_zero_free: boolean | null;
  cover_url: string | null;
  cover_url_source: string | null;
  cover_quality: CoverQuality | null;
  _slots_ambiguity: DiscordSlotsAmbiguity | null;
  /**
   * true quando o texto cita gratuidade E cobrança sem se encaixar no padrão
   * reconhecido de período promocional ("sessão 0 grátis", "1ª semana grátis")
   * — o parser não decidiu price_type sozinho (ficou null); precisa de
   * revisão humana. Reduz a confiança calculada (calcConfidence).
   */
  _price_ambiguity?: boolean | null;
  /**
   * true quando o texto cita 2+ timestamps Discord `<t:UNIX:FORMATO>` com dia
   * ou horário DIFERENTES (mesa com múltiplos slots recorrentes, ex.: "Terça
   * 20:00 quinzenal E Sábado 18:00 quinzenal" da mesma campanha). O campo
   * `day_of_week`/`start_time` do form é singular — o parser usa o primeiro
   * timestamp encontrado, mas marca aqui que há mais de um horário no anúncio
   * original pro revisor decidir/registrar manualmente. DEB-058-05/T9.16.
   */
  _schedule_ambiguity?: boolean | null;
  /**
   * DEB-048-29: anúncio classificado como AMBÍGUO p/ sistema autoral
   * ("baseado em"/"inspirado em"/"adaptado de"). Não é descarte nítido —
   * vira draft needs_review com badge "autoral?" p/ o revisor decidir.
   * Descarte nítido (sistema próprio/homebrew/autoral/caseiro) não chega aqui:
   * o parse retorna null antes.
   */
  _homebrew_suspect: boolean | null;
  /**
   * Spec 052 Bloco C: evidências brutas úteis para revisão humana.
   * Não entram em publicação automática; servem para explicar o parse.
   */
  _raw_evidence?: {
    role_mentions?: string[];
    user_mentions?: string[];
    attachments?: Array<{ file_name: string | null; url: string }>;
    embeds?: Array<{ title: string | null; url: string | null }>;
  } | null;
  /**
   * Spec 052 Bloco B: sugestões de IA ficam separadas dos campos determinísticos.
   * Revisor humano decide se copia/aplica. Nunca usar para publicar sozinho.
   */
  _ai_suggestions?: {
    provider: string;
    model: string;
    fields: Record<string, unknown>;
  } | null;
  /** Regras humanas ativas já aplicadas deterministicamente ao draft. */
  _learning_applied?: {
    provider: string;
    fields: Record<string, unknown>;
    applications?: Array<{
      rule_id: string;
      field: string;
      affected_fields: string[];
      before: unknown;
      after: unknown;
      confidence: number;
      scope_type: string;
      evidence: { text: string; start: number | null; end: number | null };
    }>;
  } | null;
  _notes: string[];
}

import type { ConfidenceTier } from './parseDiscordAnnouncement';

export interface ImportTableDraft {
  source: DiscordTableDraftSource;
  table: DiscordTableDraftTable;
  confidence: number;
  confidence_tier: ConfidenceTier;
  missing_fields: string[];
}

/** @deprecated Use ImportTableDraft. Mantido para compatibilidade do pipeline Discord. */
export type DiscordTableDraft = ImportTableDraft;

/** Mensagem bruta multi-origem (bot, ChatExporter, texto colado). */
export interface ImportRawMessage {
  source_kind: DiscordImportSourceKind;
  discord_message_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  discord_parent_channel_id?: string | null;
  discord_thread_id?: string | null;
  discord_thread_name?: string | null;
  discord_author_id: string | null;
  discord_author_name: string | null;
  discord_message_url: string | null;
  content_raw: string;
  attachments: unknown[];
  embeds: unknown[];
  /** Referência de reply (DiscordChatExporter). messageId da mensagem respondida. */
  reference?: { messageId: string; channelId?: string; guildId?: string } | null;
  message_created_at: Date | null;
  message_edited_at: Date | null;
}

/** @deprecated Use ImportRawMessage. Mantido para compatibilidade do pipeline Discord. */
export type DiscordRawMessage = ImportRawMessage;
