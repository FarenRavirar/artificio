import { describe, expect, it } from 'vitest';
import { gmProfileSchema, profileSchema } from './profileSchemas';

/**
 * `z.object` remove chave desconhecida no parse. Como o resultado do parse é o
 * que vai no corpo do PATCH, campo não declarado aqui NUNCA chega ao backend —
 * sem erro, sem aviso: some.
 *
 * Foi assim que a foto e o banner do mestre eram descartados: o
 * `gmProfileSchema` não declarava `avatar_url` nem `banner_url`, então o PATCH
 * saía sem eles enquanto a tela mostrava a imagem aplicada pelo estado local.
 */
describe('gmProfileSchema', () => {
  it('preserva imagem e enquadramento do mestre no payload', () => {
    const parsed = gmProfileSchema.parse({
      nickname: 'Mago',
      avatar_url: 'https://res.cloudinary.com/demo/avatar.png',
      avatar_crop_data: { x: 10, y: 20, width: 400, height: 400 },
      avatar_width: 800,
      avatar_height: 800,
      banner_url: 'https://res.cloudinary.com/demo/banner.png',
      banner_crop_data: { x: 0, y: 0, width: 1200, height: 650 },
      banner_width: 1600,
      banner_height: 900,
    });

    expect(parsed.avatar_url).toBe('https://res.cloudinary.com/demo/avatar.png');
    expect(parsed.avatar_crop_data).toEqual({ x: 10, y: 20, width: 400, height: 400 });
    expect(parsed.avatar_width).toBe(800);
    expect(parsed.avatar_height).toBe(800);
    expect(parsed.banner_url).toBe('https://res.cloudinary.com/demo/banner.png');
    expect(parsed.banner_crop_data).toEqual({ x: 0, y: 0, width: 1200, height: 650 });
    expect(parsed.banner_width).toBe(1600);
    expect(parsed.banner_height).toBe(900);
  });

  it('aceita null explícito para limpar imagem e enquadramento', () => {
    const parsed = gmProfileSchema.parse({
      avatar_url: null,
      avatar_crop_data: null,
      avatar_width: null,
      avatar_height: null,
    });
    expect(parsed.avatar_crop_data).toBeNull();
    expect(parsed.avatar_width).toBeNull();
  });

  it('recusa retângulo de recorte inválido', () => {
    expect(gmProfileSchema.safeParse({ avatar_crop_data: { x: 0, y: 0, width: 0, height: 10 } }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ avatar_crop_data: { x: -1, y: 0, width: 10, height: 10 } }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ avatar_crop_data: { x: 0, y: 0, width: 10 } }).success).toBe(false);
  });

  it('recusa dimensão não inteira, zero ou negativa', () => {
    expect(gmProfileSchema.safeParse({ avatar_width: 0 }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ avatar_width: -5 }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ avatar_width: 12.5 }).success).toBe(false);
  });

  it('recusa URL de imagem malformada', () => {
    expect(gmProfileSchema.safeParse({ banner_url: 'nao-e-url' }).success).toBe(false);
  });

  it('aceita os campos do perfil público v2 que o PUT grava', () => {
    const parsed = gmProfileSchema.parse({
      tagline: 'Mesas imersivas',
      promo_badge_text: 'Top 10 do mês',
      badges: ['selo-a', 'selo-b'],
      selling_points: [
        { icon: 'clock', title: 'Pontual', description: 'Começo no horário' },
        { icon: 'shield', title: 'Segurança', description: 'Sessão zero', highlight: 'Sempre' },
      ],
    });
    expect(parsed.tagline).toBe('Mesas imersivas');
    expect(parsed.promo_badge_text).toBe('Top 10 do mês');
    expect(parsed.badges).toEqual(['selo-a', 'selo-b']);
    expect(parsed.selling_points).toEqual([
      { icon: 'clock', title: 'Pontual', description: 'Começo no horário' },
      { icon: 'shield', title: 'Segurança', description: 'Sessão zero', highlight: 'Sempre' },
    ]);
  });

  it('aceita null explícito para limpar tagline/promo_badge_text/badges/selling_points', () => {
    const parsed = gmProfileSchema.parse({
      tagline: null,
      promo_badge_text: null,
      badges: null,
      selling_points: null,
    });
    expect(parsed.tagline).toBeNull();
    expect(parsed.promo_badge_text).toBeNull();
    expect(parsed.badges).toBeNull();
    expect(parsed.selling_points).toBeNull();
  });

  it('recusa selling_points com item sem title', () => {
    expect(gmProfileSchema.safeParse({
      selling_points: [{ icon: 'clock', description: 'sem title' }],
    }).success).toBe(false);
  });

  it('recusa tagline acima de 200 caracteres', () => {
    expect(gmProfileSchema.safeParse({ tagline: 'a'.repeat(201) }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ tagline: 'a'.repeat(200) }).success).toBe(true);
  });

  it('recusa promo_badge_text acima de 120 caracteres', () => {
    expect(gmProfileSchema.safeParse({ promo_badge_text: 'b'.repeat(121) }).success).toBe(false);
  });

  it('nickname exige entre 2 e 40 caracteres', () => {
    expect(gmProfileSchema.safeParse({ nickname: 'M' }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ nickname: 'M'.repeat(41) }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ nickname: 'Mago' }).success).toBe(true);
  });

  it('descarta gm_style/tools/game_format (não aceitos pelo PUT)', () => {
    const parsed = gmProfileSchema.parse({
      nickname: 'Mago',
      gm_style: { narrative: 5, tactical: 4 },
      tools: ['Foundry VTT'],
      game_format: { session_length: '4h', frequency: 'semanal', group_size: '5' },
    });
    expect(parsed.nickname).toBe('Mago');
    expect(parsed).not.toHaveProperty('gm_style');
    expect(parsed).not.toHaveProperty('tools');
    expect(parsed).not.toHaveProperty('game_format');
  });

  it('aceita os campos de grupo fechado que o PUT grava', () => {
    const parsed = gmProfileSchema.parse({
      closed_group_enabled: true,
      closed_group_systems: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
      closed_group_description: 'Campanha **sob medida** para o seu grupo.',
      closed_group_min_price_cents: 1050,
    });
    expect(parsed.closed_group_enabled).toBe(true);
    expect(parsed.closed_group_systems).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);
    expect(parsed.closed_group_description).toBe('Campanha **sob medida** para o seu grupo.');
    expect(parsed.closed_group_min_price_cents).toBe(1050);
  });

  it('aceita null explícito para limpar os campos de grupo fechado', () => {
    const parsed = gmProfileSchema.parse({
      closed_group_enabled: null,
      closed_group_systems: null,
      closed_group_description: null,
      closed_group_min_price_cents: null,
    });
    expect(parsed.closed_group_enabled).toBeNull();
    expect(parsed.closed_group_systems).toBeNull();
    expect(parsed.closed_group_description).toBeNull();
    expect(parsed.closed_group_min_price_cents).toBeNull();
  });

  it('recusa preço mínimo de grupo fechado negativo ou fracionário', () => {
    expect(gmProfileSchema.safeParse({ closed_group_min_price_cents: -1 }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ closed_group_min_price_cents: 10.5 }).success).toBe(false);
    expect(gmProfileSchema.safeParse({ closed_group_min_price_cents: 0 }).success).toBe(true);
  });

  it('descarta average_price — campo removido do editor por D4 (spec 099 B9)', () => {
    // Se o campo voltar ao schema, `z.object` passa a preservá-lo no parse e
    // este teste falha (critério A9). O backend continua aceitando a chave;
    // o front é que não a envia mais.
    const parsed = gmProfileSchema.parse({ nickname: 'Mago', average_price: 50 });
    expect(parsed).not.toHaveProperty('average_price');
  });
});

describe('profileSchema', () => {
  it('preserva o enquadramento do avatar geral', () => {
    const parsed = profileSchema.parse({
      display_name: 'Paulo',
      avatar_url: 'https://res.cloudinary.com/demo/eu.png',
      avatar_crop_data: { x: 5, y: 5, width: 200, height: 200 },
      avatar_width: 400,
      avatar_height: 400,
    });
    expect(parsed.avatar_crop_data).toEqual({ x: 5, y: 5, width: 200, height: 200 });
    expect(parsed.avatar_width).toBe(400);
    expect(parsed.avatar_height).toBe(400);
  });
});
