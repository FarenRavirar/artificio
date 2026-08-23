import {
  contactMethodsSchema,
  createTableSchema,
  updateTableSchema,
  pricingConsistencySchema,
  mergePricingState,
} from './tableValidators.js';

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

/**
 * O enquadramento do banner precisa sobreviver ao `PUT` como qualquer outro
 * campo. Enquanto o `updateData` da rota trazia só `banner_url`, editar
 * qualquer outro dado da mesa apagava o recorte já escolhido.
 */
describe('updateTableSchema — enquadramento do banner', () => {
  it('preserva recorte e dimensões válidos', () => {
    const parsed = updateTableSchema.parse({
      banner_url: 'https://res.cloudinary.com/demo/banner.png',
      banner_crop_data: { x: 0, y: 30, width: 1200, height: 650 },
      banner_width: 1600,
      banner_height: 900,
    });

    expect(parsed.banner_crop_data).toEqual({ x: 0, y: 30, width: 1200, height: 650 });
    expect(parsed.banner_width).toBe(1600);
    expect(parsed.banner_height).toBe(900);
  });

  it('aceita null explícito para limpar o enquadramento', () => {
    const parsed = updateTableSchema.parse({
      banner_crop_data: null,
      banner_width: null,
      banner_height: null,
    });
    expect(parsed.banner_crop_data).toBeNull();
    expect(parsed.banner_width).toBeNull();
  });

  it('omitir os campos deixa undefined, que o Kysely lê como "não mexe"', () => {
    const parsed = updateTableSchema.parse({ title: 'Mesa de teste' });
    expect(parsed.banner_crop_data).toBeUndefined();
    expect(parsed.banner_width).toBeUndefined();
    expect(parsed.banner_height).toBeUndefined();
  });

  it('recusa retângulo com dimensão zero ou origem negativa', () => {
    expect(updateTableSchema.safeParse({ banner_crop_data: { x: 0, y: 0, width: 0, height: 10 } }).success).toBe(false);
    expect(updateTableSchema.safeParse({ banner_crop_data: { x: -1, y: 0, width: 10, height: 10 } }).success).toBe(false);
  });

  it('recusa dimensão não inteira, zero ou negativa', () => {
    expect(updateTableSchema.safeParse({ banner_width: 0 }).success).toBe(false);
    expect(updateTableSchema.safeParse({ banner_width: -10 }).success).toBe(false);
    expect(updateTableSchema.safeParse({ banner_height: 12.5 }).success).toBe(false);
  });
});

/**
 * `price_value_monthly` é o valor individual por sessão no pacote mensal —
 * adicional opcional da mesa paga, nunca percentual. Sem CHECK de relação com
 * o avulso no banco; a regra "mensal exige mesa paga" vive aqui no schema.
 */
describe('schemas de mesa — price_value_monthly (pacote mensal)', () => {
  const basePaidTable = {
    title: 'Mesa mensal',
    system_id: '123e4567-e89b-42d3-a456-426614174000',
    type: 'campanha',
    modality: 'online',
    contacts: [{ channel: 'discord', value: 'mestre' }],
    price_type: 'paga',
    price_value: 55,
  };

  it('aceita mesa paga com pacote mensal válido', () => {
    const result = createTableSchema.safeParse({
      ...basePaidTable,
      price_value_monthly: 40,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value_monthly).toBe(40);
    }
  });

  it('aceita pacote mensal maior que o avulso (sem CHECK de relação)', () => {
    const result = createTableSchema.safeParse({
      ...basePaidTable,
      price_value_monthly: 70,
    });

    expect(result.success).toBe(true);
  });

  it('aceita mesa paga sem pacote mensal (campo opcional)', () => {
    const result = createTableSchema.safeParse(basePaidTable);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value_monthly).toBeUndefined();
    }
  });

  it('rejeita pacote mensal em mesa gratuita', () => {
    const result = createTableSchema.safeParse({
      ...basePaidTable,
      price_type: 'gratuita',
      price_value: null,
      price_value_monthly: 40,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join('.') === 'price_value_monthly' && issue.message.includes('mesas pagas'),
      )).toBe(true);
    }
  });

  it('rejeita pacote mensal negativo', () => {
    const result = createTableSchema.safeParse({
      ...basePaidTable,
      price_value_monthly: -1,
    });

    expect(result.success).toBe(false);
  });

  it('PUT: aceita price_value_monthly isolado sem price_type (relação validada no estado resultante — achado Codex PR #283, segunda rodada)', () => {
    // Antes: o default 'gratuita' materializado rejeitava o payload, impedindo
    // mesa paga de alterar só o pacote mensal. O schema agora valida a forma;
    // a relação é do merge no handler.
    const result = updateTableSchema.safeParse({ price_value_monthly: 40 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value_monthly).toBe(40);

      // Estado resultante de uma mesa paga com o mesmo payload: válido.
      const merged = mergePricingState(
        result.data,
        { price_value_monthly: 40 },
        { price_type: 'paga', price_value: 50, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      expect(pricingConsistencySchema.safeParse(merged).success).toBe(true);
    }
  });

  it('PUT: aceita price_value_monthly com price_type paga', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'paga',
      price_value_monthly: 40,
    });

    expect(result.success).toBe(true);
  });

  it('PUT: price_value_monthly com price_type explícito gratuita passa no schema; o estado resultante rejeita', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'gratuita',
      price_value_monthly: 40,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const merged = mergePricingState(
        result.data,
        { price_type: 'gratuita', price_value_monthly: 40 },
        { price_type: 'gratuita', price_value: null, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      const pricing = pricingConsistencySchema.safeParse(merged);
      expect(pricing.success).toBe(false);
      if (!pricing.success) {
        expect(pricing.error.issues[0].message).toBe('Pacote mensal só é permitido em mesas pagas');
      }
    }
  });

  it('PUT: aceita price_value_monthly null para limpar o pacote mensal', () => {
    const result = updateTableSchema.safeParse({ price_value_monthly: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value_monthly).toBeNull();
    }
  });
});

/**
 * Doações são exclusivas de mesa gratuita (decisão do mantenedor, sessão
 * 26-08-22_1): `accepts_donations` + `suggested_donation_value` opcional.
 * Regras de relação vivem no Zod, sem CHECK no banco (paridade com o mensal).
 */
describe('schemas de mesa — doações (aceita doações / valor sugerido)', () => {
  const baseDonationTable = {
    title: 'Mesa gratuita',
    system_id: '123e4567-e89b-42d3-a456-426614174000',
    type: 'campanha',
    modality: 'online',
    contacts: [{ channel: 'discord', value: 'mestre' }],
    price_type: 'gratuita',
    price_value: null,
  };

  it('aceita mesa gratuita que aceita doações, sem valor sugerido', () => {
    const result = createTableSchema.safeParse({
      ...baseDonationTable,
      accepts_donations: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accepts_donations).toBe(true);
      expect(result.data.suggested_donation_value).toBeUndefined();
    }
  });

  it('rejeita doação em mesa paga', () => {
    const result = createTableSchema.safeParse({
      ...baseDonationTable,
      price_type: 'paga',
      price_value: 55,
      accepts_donations: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.message.includes('mesas gratuitas'),
      )).toBe(true);
    }
  });

  it('rejeita valor sugerido sem marcar "Aceita doações"', () => {
    const result = createTableSchema.safeParse({
      ...baseDonationTable,
      suggested_donation_value: 10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join('.') === 'suggested_donation_value' &&
        issue.message.includes("Aceita doações"),
      )).toBe(true);
    }
  });

  it('aceita valor sugerido junto com "Aceita doações"', () => {
    const result = createTableSchema.safeParse({
      ...baseDonationTable,
      accepts_donations: true,
      suggested_donation_value: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggested_donation_value).toBe(10);
    }
  });

  it('aceita mesa gratuita sem campos de doação (ausentes)', () => {
    const result = createTableSchema.safeParse(baseDonationTable);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accepts_donations).toBeUndefined();
      expect(result.data.suggested_donation_value).toBeUndefined();
    }
  });

  it('rejeita valor sugerido negativo', () => {
    const result = createTableSchema.safeParse({
      ...baseDonationTable,
      accepts_donations: true,
      suggested_donation_value: -1,
    });

    expect(result.success).toBe(false);
  });

  it('PUT: doação com price_type explícito paga passa no schema; o estado resultante rejeita', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'paga',
      accepts_donations: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const merged = mergePricingState(
        result.data,
        { price_type: 'paga', accepts_donations: true },
        { price_type: 'paga', price_value: 50, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      const pricing = pricingConsistencySchema.safeParse(merged);
      expect(pricing.success).toBe(false);
      if (!pricing.success) {
        expect(pricing.error.issues[0].message).toBe('Doações são exclusivas de mesas gratuitas');
      }
    }
  });

  it('PUT: valor sugerido isolado passa no schema; no estado resultante vale contra o accepts_donations salvo', () => {
    const result = updateTableSchema.safeParse({ suggested_donation_value: 10 });

    expect(result.success).toBe(true);
    if (result.success) {
      // Linha que já aceita doações: alterar só o valor sugerido é válido.
      const mergedAccepted = mergePricingState(
        result.data,
        { suggested_donation_value: 10 },
        { price_type: 'gratuita', price_value: null, price_value_monthly: null, accepts_donations: true, suggested_donation_value: 5 },
      );
      expect(pricingConsistencySchema.safeParse(mergedAccepted).success).toBe(true);

      // Linha que não aceita: rejeita.
      const mergedRejected = mergePricingState(
        result.data,
        { suggested_donation_value: 10 },
        { price_type: 'gratuita', price_value: null, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      expect(pricingConsistencySchema.safeParse(mergedRejected).success).toBe(false);
    }
  });

  it('PUT: aceita limpar valor sugerido com null', () => {
    const result = updateTableSchema.safeParse({
      accepts_donations: true,
      suggested_donation_value: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggested_donation_value).toBeNull();
    }
  });
});

/**
 * Endurecimento A2 (decisão do mantenedor, sessão 26-08-22_1): mesa gratuita
 * não pode ter preço — nem avulso nem mensal. O refine do mensal já existia;
 * o do preço avulso era o buraco simétrico que faltava (create e update).
 */
describe('schemas de mesa — preço avulso em mesa gratuita (endurecimento A2)', () => {
  const baseFreeTable = {
    title: 'Mesa gratuita',
    system_id: '123e4567-e89b-42d3-a456-426614174000',
    type: 'campanha',
    modality: 'online',
    contacts: [{ channel: 'discord', value: 'mestre' }],
    price_type: 'gratuita',
  };

  it('POST: rejeita mesa gratuita com price_value avulso', () => {
    const result = createTableSchema.safeParse({
      ...baseFreeTable,
      price_value: 55,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        issue.path.join('.') === 'price_value' && issue.message.includes('não pode ter preço'),
      )).toBe(true);
    }
  });

  it('POST: aceita mesa gratuita com price_value null (front zera ao trocar de modalidade)', () => {
    const result = createTableSchema.safeParse({
      ...baseFreeTable,
      price_value: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value).toBeNull();
    }
  });

  it('POST: continua aceitando mesa paga com preço avulso (caminho paga intacto)', () => {
    const result = createTableSchema.safeParse({
      ...baseFreeTable,
      price_type: 'paga',
      price_value: 55,
    });

    expect(result.success).toBe(true);
  });

  it('PUT: price_value com price_type explícito gratuita passa no schema; o estado resultante rejeita', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'gratuita',
      price_value: 55,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const merged = mergePricingState(
        result.data,
        { price_type: 'gratuita', price_value: 55 },
        { price_type: 'paga', price_value: 50, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      const pricing = pricingConsistencySchema.safeParse(merged);
      expect(pricing.success).toBe(false);
      if (!pricing.success) {
        expect(pricing.error.issues.some((issue) =>
          issue.path.join('.') === 'price_value' && issue.message.includes('não pode ter preço'),
        )).toBe(true);
      }
    }
  });

  it('PUT: price_value isolado sem price_type passa no schema; o estado resultante rejeita (achado Codex PR #283, segunda rodada)', () => {
    const result = updateTableSchema.safeParse({ price_value: 55 });

    expect(result.success).toBe(true);
    if (result.success) {
      const merged = mergePricingState(
        result.data,
        { price_value: 55 },
        { price_type: 'gratuita', price_value: null, price_value_monthly: null, accepts_donations: false, suggested_donation_value: null },
      );
      const pricing = pricingConsistencySchema.safeParse(merged);
      expect(pricing.success).toBe(false);
      if (!pricing.success) {
        expect(pricing.error.issues[0].message).toBe('Mesa gratuita não pode ter preço — use o valor sugerido de doação');
      }
    }
  });

  it('PUT: aceita price_value null com price_type gratuita (limpar preço ao trocar para gratuita)', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'gratuita',
      price_value: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value).toBeNull();
    }
  });

  it('PUT: aceita price_value com price_type paga (edição de mesa paga continua passando)', () => {
    const result = updateTableSchema.safeParse({
      price_type: 'paga',
      price_value: 55,
    });

    expect(result.success).toBe(true);
  });
});

describe('pricingConsistencySchema — estado resultante do PUT (achado Codex PR #283)', () => {
  it('rejeita mesa paga sem price_value', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'paga',
      price_value: null,
      price_value_monthly: null,
      accepts_donations: false,
      suggested_donation_value: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Valor obrigatório para mesas pagas');
      expect(result.error.issues[0].path).toEqual(['price_value']);
    }
  });

  it('rejeita mesa gratuita retendo price_value salvo (transição paga→gratuita sem zerar)', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'gratuita',
      price_value: 50,
      price_value_monthly: null,
      accepts_donations: false,
      suggested_donation_value: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Mesa gratuita não pode ter preço — use o valor sugerido de doação');
    }
  });

  it('rejeita doações em mesa paga (PUT parcial accepts_donations em mesa paga)', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'paga',
      price_value: 50,
      price_value_monthly: null,
      accepts_donations: true,
      suggested_donation_value: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Doações são exclusivas de mesas gratuitas');
    }
  });

  it('rejeita opt-out de doação mantendo valor sugerido salvo', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'gratuita',
      price_value: null,
      price_value_monthly: null,
      accepts_donations: false,
      suggested_donation_value: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Valor sugerido exige marcar 'Aceita doações'");
    }
  });

  it('aceita mesa paga válida, inclusive com NUMERIC vindo do pg como string (coerce)', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'paga',
      price_value: '50.00',
      price_value_monthly: '40.00',
      accepts_donations: false,
      suggested_donation_value: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_value).toBe(50);
      expect(result.data.price_value_monthly).toBe(40);
    }
  });

  it('aceita mesa gratuita com doações válidas', () => {
    const result = pricingConsistencySchema.safeParse({
      price_type: 'gratuita',
      price_value: null,
      price_value_monthly: null,
      accepts_donations: true,
      suggested_donation_value: 15,
    });
    expect(result.success).toBe(true);
  });
});

describe('mergePricingState — merge payload parcial × linha salva', () => {
  const saved = {
    price_type: 'paga' as const,
    price_value: 50,
    price_value_monthly: null,
    accepts_donations: false,
    suggested_donation_value: null,
  };

  it('campo enviado vence a linha salva', () => {
    const payload = updateTableSchema.parse({ accepts_donations: true });
    const merged = mergePricingState(payload, { accepts_donations: true }, saved);
    expect(merged.accepts_donations).toBe(true);
    expect(merged.price_type).toBe('paga');
    expect(merged.price_value).toBe(50);
  });

  it('campo omitido herda a linha salva (price_type default do Zod não conta como enviado)', () => {
    // Caso exato do achado Codex PR #283: PUT parcial { accepts_donations: true }
    // parseia com price_type default 'gratuita' (válido isolado), mas o estado
    // resultante contra uma linha paga é inválido — e o gate do handler rejeita.
    const payload = updateTableSchema.parse({ accepts_donations: true });
    expect(payload.price_type).toBe('gratuita');
    const merged = mergePricingState(payload, { accepts_donations: true }, saved);
    expect(merged.price_type).toBe('paga');
    expect(merged.accepts_donations).toBe(true);
    expect(pricingConsistencySchema.safeParse(merged).success).toBe(false);
  });

  it('price_value enviado como null vira null (não herda o salvo)', () => {
    const payload = updateTableSchema.parse({ price_value: null });
    const merged = mergePricingState(payload, { price_value: null }, saved);
    expect(merged.price_value).toBeNull();
  });
});
