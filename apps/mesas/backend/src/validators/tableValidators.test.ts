import { contactMethodsSchema, createTableSchema, updateTableSchema } from './tableValidators.js';

describe('updateTableSchema — Markdown de usuário', () => {
  it.each([
    'description',
    'rules_notes',
    'synopsis',
    'style_text',
    'listing_excerpt',
    'technical_requirements',
    'synopsis_narrative',
    'benefits_text',
    'table_gm_bio',
  ] as const)('remove HTML executável de %s antes da escrita', (field) => {
    const result = updateTableSchema.parse({
      [field]: '**Markdown** <script>alert(1)</script><img src=x onerror=alert(2)>',
    });

    expect(result[field]).toContain('**Markdown**');
    expect(result[field]).not.toMatch(/script|onerror|<img|alert\(/i);
  });
});

const maliciousDiscordUrls = [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'http://discord.gg/inseguro',
  'https://example.com/falso-discord',
] as const;

describe('schemas de mesa — URLs de contato', () => {
  it.each(maliciousDiscordUrls)('POST /gm/tables rejeita URL Discord insegura: %s', (discordServerUrl) => {
    const result = createTableSchema.safeParse({
      title: 'Mesa segura',
      system_id: '123e4567-e89b-42d3-a456-426614174000',
      type: 'campanha',
      modality: 'online',
      contacts: [{ channel: 'discord', value: 'mestre', discord_server_url: discordServerUrl }],
    });

    expect(result.success).toBe(false);
  });

  it.each(maliciousDiscordUrls)('PUT /gm/tables/:id rejeita URL Discord insegura: %s', (discordServerUrl) => {
    const result = updateTableSchema.safeParse({
      contacts: [{ channel: 'discord', value: 'mestre', discord_server_url: discordServerUrl }],
    });

    expect(result.success).toBe(false);
  });

  it('canonicaliza URL sem esquema para https', () => {
    const result = updateTableSchema.parse({
      contacts: [{ channel: 'form', value: 'forms.gle/abc' }],
    });

    expect(result.contacts?.[0]?.value).toBe('https://forms.gle/abc');
  });

  it('erro de http explícito informa que somente https é aceito', () => {
    const result = updateTableSchema.safeParse({
      contacts: [{ channel: 'form', value: 'http://forms.gle/abc' }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('https://');
    }
  });

  it.each(['uwill', '.zero9899', 'kauarang', 'localhost'])(
    'recusa %s como link de contato e aponta o canal Discord',
    (value) => {
      // Sintaxe válida não basta: `https://uwill/` é URL bem-formada que morre
      // em erro de DNS. Regra do mantenedor 2026-08-03.
      const result = updateTableSchema.safeParse({ contacts: [{ channel: 'form', value }] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Discord');
      }
    },
  );

  it('link com host real continua aceito', () => {
    const result = updateTableSchema.safeParse({
      contacts: [{ channel: 'form', value: 'https://forms.gle/abc' }],
    });

    expect(result.success).toBe(true);
  });
});

describe('contactMethodsSchema — perfil do mestre', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)', 'http://forms.gle/abc'])(
    'rejeita formulário inseguro: %s',
    (value) => {
      expect(contactMethodsSchema.safeParse([{ channel: 'form', value }]).success).toBe(false);
    },
  );

  it('rejeita host Discord falso', () => {
    const result = contactMethodsSchema.safeParse([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: 'https://example.com/convite',
    }]);

    expect(result.success).toBe(false);
  });

  it('restringe perfil aos quatro canais suportados', () => {
    expect(contactMethodsSchema.safeParse([{ channel: 'facebook', value: 'facebook.com/mestre' }]).success).toBe(false);
  });

  it('preserva validações de email e WhatsApp da rota antiga', () => {
    expect(contactMethodsSchema.safeParse([{ channel: 'email', value: 'invalido' }]).success).toBe(false);
    expect(contactMethodsSchema.safeParse([{ channel: 'whatsapp', value: '11999999999' }]).success).toBe(false);
  });
});
