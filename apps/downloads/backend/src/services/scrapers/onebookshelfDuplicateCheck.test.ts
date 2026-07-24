// T3.2 (spec 085) — dedupe on-demand via similarity(), nunca decide sozinho
// (só retorna candidatos, quem decide é o admin no preview).

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

import { findDuplicateCandidates } from './onebookshelfDuplicateCheck';

function makeSelectChain(result: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(result),
  };
}

describe('findDuplicateCandidates', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
  });

  it('retorna candidatos quando a query encontra materiais similares', async () => {
    const chain = makeSelectChain([
      { id: 'mat-1', slug: 'classe-o-lutador', title: 'Classe O Lutador (5E)', similarity: 0.91 },
    ]);
    dbMocks.selectFrom.mockReturnValue(chain);

    const result = await findDuplicateCandidates('Classe O Lutador (5E) - Playtest');

    expect(dbMocks.selectFrom).toHaveBeenCalledWith('download_material');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mat-1');
    expect(result[0].similarity).toBe(0.91);
  });

  it('retorna array vazio quando a query não encontra nada acima do threshold', async () => {
    const chain = makeSelectChain([]);
    dbMocks.selectFrom.mockReturnValue(chain);

    const result = await findDuplicateCandidates('Título totalmente diferente e único');

    expect(result).toEqual([]);
  });

  it('retorna array vazio sem consultar o banco quando título é vazio/só espaço', async () => {
    const result = await findDuplicateCandidates('   ');

    expect(result).toEqual([]);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });
});
