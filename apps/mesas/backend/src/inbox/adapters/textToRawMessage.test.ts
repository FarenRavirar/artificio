import { describe, expect, it } from 'vitest';
import { textToRawMessage } from './textToRawMessage.js';

describe('textToRawMessage', () => {
  it('adapts pasted text without inventing Discord metadata', () => {
    const message = textToRawMessage('  Título: Mesa de teste  ', 'Importação manual');

    expect(message.source_kind).toBe('manual_paste');
    expect(message.content_raw).toBe('Título: Mesa de teste');
    expect(message.discord_thread_name).toBe('Importação manual');
    expect(message.discord_channel_id).toBe('');
    expect(message.discord_guild_id).toBe('');
    expect(message.discord_message_url).toBeNull();
    expect(message.discord_message_id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
