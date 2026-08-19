import { describe, expect, it } from 'vitest';
import { cropToObjectPosition } from '@artificio/media/image-kinds';
import { mapTableToView } from './tableViewMapper';
import type { TableDetail } from '../../../types/tables';

const BASE = {
  id: 'tbl-1',
  slug: 'mesa-teste',
  title: 'Mesa de teste',
  cover_url: 'https://res.cloudinary.com/demo/banner.png',
} as unknown as TableDetail;

function withCover(extra: Partial<TableDetail>): TableDetail {
  return { ...BASE, ...extra } as TableDetail;
}

describe('mapTableToView — enquadramento da capa', () => {
  it('normaliza recorte e dimensões vindos da API', () => {
    const vm = mapTableToView(
      withCover({
        cover_crop_data: { x: 200, y: 125, width: 1200, height: 650 },
        cover_width: 1600,
        cover_height: 900,
      }),
    );

    expect(vm.coverCropData).toEqual({ x: 200, y: 125, width: 1200, height: 650 });
    expect(vm.coverWidth).toBe(1600);
    expect(vm.coverHeight).toBe(900);
  });

  // O JSONB da API é `unknown` até validar. Retângulo malformado produziria
  // `NaN% NaN%`, que o navegador descarta — devolvendo o recorte central que o
  // enquadramento existe justamente para substituir.
  it('descarta recorte malformado em vez de repassá-lo à exibição', () => {
    for (const crop of [
      { x: -1, y: 0, width: 100, height: 50 },
      { x: 0, y: 0, width: 0, height: 50 },
      { x: 0, y: 0, width: 100 },
      'texto',
    ] as unknown[]) {
      const vm = mapTableToView(
        withCover({ cover_crop_data: crop as never, cover_width: 1600, cover_height: 900 }),
      );
      expect(vm.coverCropData).toBeNull();
    }
  });

  it('recorte sem dimensões vira null, porque a conversão divide por elas', () => {
    const vm = mapTableToView(
      withCover({ cover_crop_data: { x: 0, y: 0, width: 1200, height: 650 } }),
    );
    expect(vm.coverCropData).toBeNull();
  });
});

/**
 * A fórmula anterior do `TableHero` era `x / crop.width`, que não é a fração de
 * `object-position`. A fração certa é sobre a FOLGA — imagem menos recorte.
 */
describe('cropToObjectPosition — a conta que o TableHero usava errado', () => {
  it('recorte centralizado dá 50% 50%, não a fração do próprio recorte', () => {
    const crop = { x: 200, y: 125, width: 1200, height: 650 };
    const [W, H] = [1600, 900];

    expect(cropToObjectPosition(crop, W, H)).toBe('50% 50%');

    // O que a fórmula antiga produzia para exatamente o mesmo recorte.
    const antiga = `${Math.round((crop.x / crop.width) * 100)}% ${Math.round((crop.y / crop.height) * 100)}%`;
    expect(antiga).toBe('17% 19%');
  });

  it('recorte no canto superior esquerdo dá 0% 0%', () => {
    expect(cropToObjectPosition({ x: 0, y: 0, width: 1200, height: 650 }, 1600, 900)).toBe('0% 0%');
  });

  it('recorte no canto inferior direito dá 100% 100%', () => {
    expect(cropToObjectPosition({ x: 400, y: 250, width: 1200, height: 650 }, 1600, 900)).toBe('100% 100%');
  });
});
