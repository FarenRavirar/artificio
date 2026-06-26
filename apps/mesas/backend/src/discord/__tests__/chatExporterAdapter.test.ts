import { describe, it, expect } from 'vitest';
import { parseDiscordChatExporterJson, adaptMessageToImportRaw, DiscordChatExporterValidationError } from '../chatExporterAdapter';
import { exportWithoutGuild, exportWithNonArrayMessages } from './fixtures/chatExporterSample';

// Fixture minima espelhando o shape real do DiscordChatExporter:
// embeds com campos `null` (timestamp/image/description) — regressao da Spec 048,
// que rejeitava com 400 "embeds.0.timestamp: expected string, received null".
function buildExport(overrides: Record<string, unknown> = {}) {
  return {
    guild: { id: '111', name: 'Guild' },
    channel: { id: '222', name: 'canal', type: 'GuildTextChat' },
    messages: [
      {
        id: '900',
        timestamp: '2026-06-23T12:00:00.000+00:00',
        timestampEdited: null,
        author: { id: '5', name: 'fulano', discriminator: null, nickname: null, color: null },
        content: 'mesa de teste',
        attachments: [{ id: 'a1', url: 'https://x/y.png', fileName: null, fileSizeBytes: null }],
        embeds: [
          {
            title: 'Embed',
            url: null,
            timestamp: null,
            description: null,
            image: null,
            thumbnail: null,
            footer: null,
            author: null,
            color: null,
            fields: null,
          },
        ],
        ...overrides,
      },
    ],
  };
}

describe('parseDiscordChatExporterJson — embeds com campos null', () => {
  it('aceita embed com timestamp/image/description null (regressao 048)', () => {
    const result = parseDiscordChatExporterJson(buildExport());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].embeds).toHaveLength(1);
  });

  it('adapta mensagem para ImportRawMessage sem perder conteudo', () => {
    const data = parseDiscordChatExporterJson(buildExport());
    const adapted = adaptMessageToImportRaw(data.messages[0], data);
    expect(adapted.source_kind).toBe('discord_chat_exporter_json');
    expect(adapted.content_raw).toBe('mesa de teste');
    expect(adapted.discord_author_name).toBe('fulano');
    expect(adapted.message_created_at).toBeInstanceOf(Date);
  });

  it('rejeita JSON sem campo messages', () => {
    expect(() => parseDiscordChatExporterJson({ guild: { id: '1', name: 'g' } })).toThrow(
      /messages.*ausente/i,
    );
  });

  // ─── T-F8: reference (reply) ─────────────────────────────────────────────────

  it('mensagem COM reference gera adapted.reference populado (T-F8)', () => {
    const data = parseDiscordChatExporterJson(buildExport({
      reference: { messageId: 'msg-001', channelId: '222', guildId: '111' },
    }));
    const adapted = adaptMessageToImportRaw(data.messages[0], data);
    expect(adapted.reference).toEqual({
      messageId: 'msg-001',
      channelId: '222',
      guildId: '111',
    });
  });

  it('mensagem SEM reference gera adapted.reference = null (T-F8)', () => {
    const data = parseDiscordChatExporterJson(buildExport());
    const adapted = adaptMessageToImportRaw(data.messages[0], data);
    expect(adapted.reference).toBeNull();
  });

  // ─── DEB-048-01: schema inválido ─────────────────────────────────────────────────

  it('rejeita export sem campo guild', () => {
    expect(() => parseDiscordChatExporterJson(exportWithoutGuild))
      .toThrow(DiscordChatExporterValidationError);
  });

  it('rejeita export com messages não-array', () => {
    expect(() => parseDiscordChatExporterJson(exportWithNonArrayMessages))
      .toThrow(DiscordChatExporterValidationError);
  });

  it('mensagem de erro do schema contém detalhes úteis (não stack trace)', () => {
    let caught: unknown;
    try {
      parseDiscordChatExporterJson(exportWithoutGuild);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DiscordChatExporterValidationError);
    const msg = (caught as DiscordChatExporterValidationError).message;
    expect(msg.length).toBeGreaterThan(10); // mensagem descritiva
    expect(msg).not.toContain('at parseDiscordChatExporterJson'); // sem stack trace
  });
});
