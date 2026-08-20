import type { Mock } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
  },
}));

import { db } from '../../db/index.js';
import { loadVttPlatformsForParser, loadCommunicationPlatformsForParser } from '../shared.js';

const mockSelectFrom = db.selectFrom as Mock;

function chain(result: unknown[]): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.where = () => c;
  c.orderBy = () => c;
  c.execute = async () => result;
  return c;
}

beforeEach(() => {
  mockSelectFrom.mockReset();
});

// D2 (spec 093): aliases vêm da tabela, não do Record hardcoded. O teste do
// "alias cadastrado pelo CRUD" (fundamento 2 de D2): uma VTT custom com alias
// no banco precisa aparecer no MatchEntry — coisa que o mapa hardcoded nunca
// permitiu (toda VTT criada pelo painel nascia sem alias).
describe('loadVttPlatformsForParser (D2, spec 093)', () => {
  it('lê aliases da tabela vtt_platform_aliases, incluindo VTT criada via CRUD', async () => {
    mockSelectFrom.mockImplementation((table: string) => {
      if (table === 'vtt_platforms') {
        return chain([
          { id: 'id-fgu', name: 'Fantasy Grounds Unity' },
          { id: 'id-custom', name: 'Minha VTT Custom' },
        ]);
      }
      if (table === 'vtt_platform_aliases') {
        return chain([
          { vtt_platform_id: 'id-fgu', alias: 'FGC' },
          { vtt_platform_id: 'id-fgu', alias: 'Fantasy Grounds Classic' },
          { vtt_platform_id: 'id-custom', alias: 'MVC' },
        ]);
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    const result = await loadVttPlatformsForParser();

    expect(result).toEqual([
      { id: 'id-fgu', name: 'Fantasy Grounds Unity', aliases: ['FGC', 'Fantasy Grounds Classic'] },
      { id: 'id-custom', name: 'Minha VTT Custom', aliases: ['MVC'] },
    ]);
  });

  it('devolve aliases: [] para plataforma sem alias (não quebra o parser)', async () => {
    mockSelectFrom.mockImplementation((table: string) => {
      if (table === 'vtt_platforms') {
        return chain([{ id: 'id-sem-alias', name: 'Sem Alias' }]);
      }
      if (table === 'vtt_platform_aliases') {
        return chain([]);
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    const result = await loadVttPlatformsForParser();

    expect(result).toEqual([{ id: 'id-sem-alias', name: 'Sem Alias', aliases: [] }]);
  });
});

describe('loadCommunicationPlatformsForParser (R16, spec 093)', () => {
  it('lê aliases da tabela communication_platform_aliases', async () => {
    mockSelectFrom.mockImplementation((table: string) => {
      if (table === 'communication_platforms') {
        return chain([
          { id: 'id-meet', name: 'Google Meet' },
          { id: 'id-teams', name: 'Microsoft Teams' },
          { id: 'id-zoom', name: 'Zoom' },
        ]);
      }
      if (table === 'communication_platform_aliases') {
        return chain([
          { communication_platform_id: 'id-meet', alias: 'Meet' },
          { communication_platform_id: 'id-teams', alias: 'Teams' },
        ]);
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    const result = await loadCommunicationPlatformsForParser();

    expect(result).toEqual([
      { id: 'id-meet', name: 'Google Meet', aliases: ['Meet'] },
      { id: 'id-teams', name: 'Microsoft Teams', aliases: ['Teams'] },
      { id: 'id-zoom', name: 'Zoom', aliases: [] },
    ]);
  });
});
