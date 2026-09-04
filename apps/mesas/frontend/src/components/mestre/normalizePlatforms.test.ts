import { describe, it, expect } from 'vitest';
import { normalizePlatforms } from './normalizePlatforms';

/**
 * O catálogo vem de rota HTTP, então é `unknown` até passar por aqui (regra
 * pétrea de normalização do `AGENTS.md`). O código anterior fazia
 * `setPlatforms(json.data || [])`: um `200` com `{"data": {}}` passava pelo
 * `||`, entrava no estado, e só estourava no `platforms.map(...)` do render —
 * derrubando a seção inteira de edição em vez de mostrar erro (achado de
 * review, PR #307).
 */
describe('normalizePlatforms', () => {
  it('aceita o payload real da rota', () => {
    const out = normalizePlatforms({
      data: [
        { id: 'a1', name: 'Discord', slug: 'discord', website_url: 'https://discord.com' },
      ],
    });
    expect(out).toEqual([
      { id: 'a1', name: 'Discord', slug: 'discord', logo_filename: null, website_url: 'https://discord.com' },
    ]);
  });

  it('devolve [] quando `data` não é array — o caso que derrubava o render', () => {
    // Cada um destes chegava ao `.map` com a versão anterior.
    expect(normalizePlatforms({ data: {} })).toEqual([]);
    expect(normalizePlatforms({ data: 'texto' })).toEqual([]);
    expect(normalizePlatforms({})).toEqual([]);
    expect(normalizePlatforms(null)).toEqual([]);
    expect(normalizePlatforms(undefined)).toEqual([]);
  });

  it('descarta item sem id ou sem name em vez de renderizar torto', () => {
    const out = normalizePlatforms({
      data: [
        { id: 'ok', name: 'Meet', slug: 'meet', website_url: null },
        { name: 'sem id' },
        { id: 'sem-name' },
        'lixo',
        null,
        42,
      ],
    });
    expect(out.map((p) => p.id)).toEqual(['ok']);
  });

  it('tolera a ausência de `logo_filename` — communication_platforms não tem a coluna', () => {
    const [p] = normalizePlatforms({
      data: [{ id: 'c1', name: 'Telegram', slug: 'telegram', website_url: null }],
    });
    expect(p.logo_filename).toBeNull();
  });
});
