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
} from './types';

// Configuração
export { discordConfig } from './config';

// Funções de pipeline (adicionadas conforme implementação das Fases 2–4)
export { discoverDiscordChannels, discoverDiscordGuilds, DiscordDiscoveryError } from './discovery';
export type { DiscordDiscoveredChannel, DiscordDiscoveredGuild } from './discovery';
export { DiscordIngestError, ingestForumMessages, ingestMessages } from './ingestMessages';
export type { IngestResult } from './ingestMessages';
export { parseDiscordAnnouncement } from './parseDiscordAnnouncement';
export type { SystemEntry } from './parseDiscordAnnouncement';
export { normalizeDiscordTableDraft } from './normalizeDiscordTableDraft';
export type { NormalizedDraftStatus } from './normalizeDiscordTableDraft';
export { DiscordDraftSyncValidationError, refreshDiscordDraftImage, syncDiscordDraftToTable } from './syncDiscordDraftToTable';
export type { DiscordImageRefreshResult, SyncResult } from './syncDiscordDraftToTable';
export { assertDraftReadyTransition } from './draftValidation';
export type { DraftReadyTransitionInput, DraftReadyTransitionResult } from './draftValidation';
export { uploadDiscordImageToCloudinary } from './uploadDiscordImage';
export type { DiscordImageUploadResult } from './uploadDiscordImage';
