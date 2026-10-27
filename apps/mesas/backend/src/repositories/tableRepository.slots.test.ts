vi.mock('../db/index.js', () => ({ db: {} }));
vi.mock('../services/systemCatalogProvider.js', () => ({ hydrateTableSystemFields: vi.fn() }));

import { withoutLegacySlots } from './tableRepository.js';

// Spec 106 T8.2: a leitura do editor/admin não devolve a coluna legada `slots_filled`,
// cujo valor velho contradiz `slots_open`.
describe('withoutLegacySlots', () => {
  it('remove slots_filled e preserva o resto, sem mutar a entrada', () => {
    const row = { id: 't1', slots_total: 5, slots_open: 1, slots_filled: 2 };
    const out = withoutLegacySlots(row);
    expect(out).toEqual({ id: 't1', slots_total: 5, slots_open: 1 });
    expect('slots_filled' in out).toBe(false);
    expect(row.slots_filled).toBe(2);
  });
});
