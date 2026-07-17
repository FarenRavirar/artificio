/**
 * Tipos canônicos para o pipeline de inbox multi-origem.
 *
 * DEB-047-07 resolvido (2026-06-22): `ImportRawMessage` e `ImportTableDraft`
 * agora são os nomes canônicos em `discord/types.ts`. Os aliases `DiscordRawMessage`
 * e `DiscordTableDraft` existem para retrocompatibilidade do pipeline Discord.
 */

export type { ImportRawMessage, ImportTableDraft } from '../discord/types.js';
