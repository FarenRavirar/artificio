/**
 * Fronteira pública do módulo Discord.
 * Todo código fora de backend/src/discord/ deve importar exclusivamente daqui.
 */

// Tipos públicos
export type {
  ImportTableDraft,
  DiscordTableDraft,
  ImportRawMessage,
  DiscordRawMessage,
  DiscordTableDraftSource,
  DiscordTableDraftTable,
  DiscordImportSourceKind,
  DiscordSourceChannelType,
  DiscordImportMessageStatus,
  DiscordImportDraftStatus,
  TableDraftType,
  TableDraftModality,
  TableDraftPriceType,
  TableDraftFrequency,
} from './types.js';

// Configuração
export { discordConfig } from './config.js';

// Funções de pipeline (adicionadas conforme implementação das Fases 2–4)
export { discoverDiscordChannels, discoverDiscordGuilds, discoverChannelDelta, DiscordDiscoveryError, DISCORD_DELTA_PAGE_LIMIT } from './discovery.js';
export type { DiscordDiscoveredChannel, DiscordDiscoveredGuild, DiscordChannelDelta } from './discovery.js';
export { DiscordIngestError, ingestForumMessages, ingestMessages } from './ingestMessages.js';
export type { IngestResult } from './ingestMessages.js';
export { parseDiscordAnnouncement } from './parseDiscordAnnouncement.js';
export type { SystemEntry } from './parseDiscordAnnouncement.js';
export { normalizeDiscordTableDraft } from './normalizeDiscordTableDraft.js';
export type { NormalizedDraftStatus } from './normalizeDiscordTableDraft.js';
export { DiscordDraftSyncValidationError, refreshDiscordDraftImage, syncDiscordDraftToTable } from './syncDiscordDraftToTable.js';
export type { DiscordImageRefreshResult, SyncResult } from './syncDiscordDraftToTable.js';
export { normalizeImportTableDraft, normalizeDraftPayload, DraftNotFoundError, DraftStateError } from './syncHelpers.js';
export { assertDraftReadyTransition } from './draftValidation.js';
export type { DraftReadyTransitionInput, DraftReadyTransitionResult } from './draftValidation.js';
export { uploadDiscordImageToCloudinary } from './uploadDiscordImage.js';
export type { DiscordImageUploadResult } from './uploadDiscordImage.js';
