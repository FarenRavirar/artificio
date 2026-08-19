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
