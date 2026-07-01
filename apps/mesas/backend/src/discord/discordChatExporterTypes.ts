import { z } from 'zod';

export const discordChatExporterAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  discriminator: z.string().nullish(),
  nickname: z.string().nullish(),
  color: z.string().nullish(),
  isBot: z.boolean().nullish(),
  roles: z.array(z.unknown()).nullish(),
  avatarUrl: z.string().nullish(),
});

export const discordChatExporterAttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  fileName: z.string().nullish(),
  fileSizeBytes: z.number().nullish(),
});

// DiscordChatExporter emite `null` (nao `undefined`) para campos de embed ausentes.
// `.nullish()` aceita ambos; mantem `.passthrough()` para campos extras.
export const discordChatExporterEmbedSchema = z.object({
  title: z.string().nullish(),
  url: z.string().nullish(),
  timestamp: z.string().nullish(),
  description: z.string().nullish(),
  image: z.union([z.string(), z.object({ url: z.string() })]).nullish(),
  thumbnail: z.object({ url: z.string() }).nullish(),
  footer: z.object({ text: z.string() }).nullish(),
  author: z.object({ name: z.string() }).nullish(),
  color: z.string().nullish(),
  fields: z.array(z.object({ name: z.string(), value: z.string() })).nullish(),
}).passthrough();

export const discordChatExporterMentionSchema = z.object({
  id: z.string(),
  name: z.string(),
  discriminator: z.string().optional(),
  nickname: z.string().optional(),
  isBot: z.boolean().optional(),
  roles: z.array(z.unknown()).optional(),
});

export const discordChatExporterReactionSchema = z.object({
  emoji: z.object({
    id: z.string().nullable().optional(),
    name: z.string(),
    animated: z.boolean().optional(),
  }),
  count: z.number(),
});

// DiscordChatExporter emite `null` (não `undefined`) em campos ausentes → `.nullish()`.
export const discordChatExporterReferenceSchema = z.object({
  messageId: z.string(),
  channelId: z.string().nullish(),
  guildId: z.string().nullish(),
});

export const discordChatExporterForwardedMessageSchema = z.object({
  content: z.string().nullish(),
  author: z.object({ name: z.string().nullish() }).nullish(),
}).passthrough();

export const discordChatExporterInlineEmojiSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  animated: z.boolean().optional(),
});

export const discordChatExporterMessageSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }),
  timestampEdited: z.string().datetime({ offset: true }).nullable().optional(),
  callEndedTimestamp: z.string().datetime({ offset: true }).nullable().optional(),
  isPinned: z.boolean().optional(),
  content: z.string().optional().default(''),
  author: discordChatExporterAuthorSchema,
  attachments: z.array(discordChatExporterAttachmentSchema).optional().default([]),
  embeds: z.array(discordChatExporterEmbedSchema).optional().default([]),
  stickers: z.array(z.unknown()).optional(),
  reactions: z.array(discordChatExporterReactionSchema).optional().default([]),
  mentions: z.array(discordChatExporterMentionSchema).optional().default([]),
  inlineEmojis: z.array(discordChatExporterInlineEmojiSchema).optional().default([]),
  reference: discordChatExporterReferenceSchema.nullable().optional(),
  forwardedMessage: discordChatExporterForwardedMessageSchema.nullable().optional(),
});

export const discordChatExporterGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.string().optional(),
});

export const discordChatExporterChannelSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(),
  name: z.string(),
  topic: z.string().optional(),
});

// DiscordChatExporter emite `null` (nao `undefined`) quando o filtro de data
// nao foi usado no export — mesmo padrao dos outros campos deste arquivo.
export const discordChatExporterDateRangeSchema = z.object({
  after: z.string().nullish(),
  before: z.string().nullish(),
});

export const discordChatExporterExportSchema = z.object({
  guild: discordChatExporterGuildSchema,
  channel: discordChatExporterChannelSchema,
  dateRange: discordChatExporterDateRangeSchema.optional(),
  exportedAt: z.string().optional(),
  messages: z.array(discordChatExporterMessageSchema),
  messageCount: z.number().optional(),
});

export type DiscordChatExporterExport = z.infer<typeof discordChatExporterExportSchema>;
export type DiscordChatExporterMessage = z.infer<typeof discordChatExporterMessageSchema>;
export type DiscordChatExporterAuthor = z.infer<typeof discordChatExporterAuthorSchema>;
export type DiscordChatExporterAttachment = z.infer<typeof discordChatExporterAttachmentSchema>;
