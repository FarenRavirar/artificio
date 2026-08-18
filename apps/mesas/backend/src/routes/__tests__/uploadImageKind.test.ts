import { describe, expect, it } from 'vitest';
import { IMAGE_KINDS, imageKindSpec, isImageKind, storageTransformation } from '@artificio/media/image-kinds';

/**
 * Contrato de upload por tipo de imagem, do ponto de vista do backend.
 *
 * Cobre o defeito medido em produção em 2026-08-18: a rota `/upload/url`
 * validava `purpose` e o descartava na chamada seguinte, então TODA imagem —
 * inclusive avatar — recebia `{ width: 1200, height: 650, crop: 'fill' }`. O
 * avatar de um mestre foi gravado 1200x650, com o topo do brasão e a base dos
 * dados descartados no upload e sem original para recuperar.
 */
describe('contrato de upload por tipo de imagem', () => {
  it('nenhum tipo usa recorte destrutivo no armazenamento', () => {
    for (const kind of Object.keys(IMAGE_KINDS)) {
      const steps = storageTransformation(kind);
      const crops = steps.map((step) => step.crop).filter(Boolean);
      expect(crops).toEqual(['limit']);
      expect(crops).not.toContain('fill');
    }
  });

  it('avatar não é mais armazenado com a geometria de banner de mesa', () => {
    const [resize] = storageTransformation('profile_avatar');
    expect(resize.width).toBe(resize.height);
    expect(resize.height).not.toBe(650);
  });

  it('avatar tem pasta própria, fora de mesas_rpg', () => {
    expect(imageKindSpec('profile_avatar').folder).toBe('artificio_avatars');
    expect(imageKindSpec('table_banner').folder).toBe('mesas_rpg');
  });

  it('purpose inválido é rejeitado antes de virar upload', () => {
    expect(isImageKind('profile_avatar')).toBe(true);
    expect(isImageKind('avatar')).toBe(false);
    expect(isImageKind('')).toBe(false);
    expect(isImageKind(undefined)).toBe(false);
  });

  it('purpose ausente cai no banner de mesa, preservando o contrato antigo', () => {
    expect(imageKindSpec(undefined)).toBe(IMAGE_KINDS.table_banner);
  });

  it('todo tipo declara limite de arquivo, para o teto do multer ser real', () => {
    for (const kind of Object.keys(IMAGE_KINDS)) {
      expect(imageKindSpec(kind).maxFileBytes).toBeGreaterThan(0);
    }
  });
});
