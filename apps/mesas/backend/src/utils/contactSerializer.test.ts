import { serializeContactMethods, serializeContacts } from './contactSerializer.js';

describe('serialização segura de contatos legados', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)', 'http://forms.gle/abc'])(
    'remove formulário com URL insegura: %s',
    (value) => {
      expect(serializeContacts([{ channel: 'form', value }])).toEqual([]);
    },
  );

  it('canonicaliza formulário legado sem esquema', () => {
    expect(serializeContacts([{ channel: 'form', value: 'forms.gle/abc' }])).toEqual([
      { channel: 'form', value: 'https://forms.gle/abc', discord_server_url: null },
    ]);
  });

  it.each(['facebook', 'instagram'])(
    'remove URL insegura do canal navegável %s',
    (channel) => {
      expect(serializeContacts([{ channel, value: 'javascript:alert(1)' }])).toEqual([]);
    },
  );

  it('neutraliza servidor Discord inválido sem remover username', () => {
    expect(serializeContacts([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: 'javascript:alert(1)',
    }])).toEqual([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: null,
    }]);
  });

  it('canonicaliza convite Discord sem esquema', () => {
    expect(serializeContacts([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: 'discord.gg/abc',
    }])[0]?.discord_server_url).toBe('https://discord.gg/abc');
  });

  it('trata JSONB fora do contrato como lista vazia', () => {
    expect(serializeContactMethods({ channel: 'form', value: 'https://example.com' })).toEqual([]);
  });

  it('remove canal legado que a página pública do mestre não suporta', () => {
    expect(serializeContactMethods([{ channel: 'instagram', value: 'instagram.com/mestre' }])).toEqual([]);
  });
});
