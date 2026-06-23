import { z } from 'zod';

export const discordChatExporterAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  discriminator: z.string().optional(),
  nickname: z.string().optional(),
  color: z.string().optional(),
  isBot: z.boolean().optional(),
  roles: z.array(z.unknown()).optional(),
  avatarUrl: z.string().optional(),
});

export const discordChatExporterAttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().optional(),
});

export const discordChatExporterEmbedSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  thumbnail: z.object({ url: z.string() }).optional(),
  footer: z.object({ text: z.string() }).optional(),
  author: z.object({ name: z.string() }).optional(),
  color: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
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

export const discordChatExporterReferenceSchema = z.object({
  messageId: z.string(),
  channelId: z.string().optional(),
  guildId: z.string().optional(),
});

export const discordChatExporterForwardedMessageSchema = z.object({
  content: z.string().optional(),
  author: z.object({ name: z.string() }),
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

export const discordChatExporterDateRangeSchema = z.object({
  after: z.string().optional(),
  before: z.string().optional(),
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
