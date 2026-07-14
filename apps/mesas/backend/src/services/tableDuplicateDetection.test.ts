import { scoreTableDuplicate, textSimilarity } from './tableDuplicateDetection';

const base = {
  id: 'a',
  title: 'Máscaras de Nyarlathotep',
  description: 'Uma campanha investigativa ao redor do mundo.',
  systemId: 'system-a',
  sourceUrl: null,
};

describe('tableDuplicateDetection', () => {
  it('normaliza acentos e caixa na similaridade', () => {
    expect(textSimilarity('Máscaras de Nyarlathotep', 'mascaras de nyarlathotep')).toBe(1);
  });

  it('classifica cópia textual mesmo com sistema diferente', () => {
    const result = scoreTableDuplicate(base, { ...base, id: 'b', systemId: 'system-b' });
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.signals.same_system).toBe(false);
  });

  it('usa URL igual como sinal forte', () => {
    const result = scoreTableDuplicate(
      { ...base, sourceUrl: 'https://example.com/form', description: '' },
      { ...base, id: 'b', title: 'Outro título', description: '', sourceUrl: 'https://example.com/form' },
    );
    expect(result.signals.same_source_url).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it('mantém mesas sem relação abaixo do limiar', () => {
    const result = scoreTableDuplicate(base, {
      id: 'b',
      title: 'Corrida espacial de robôs',
      description: 'Competição leve em Marte.',
      systemId: 'system-b',
      sourceUrl: null,
    });
    expect(result.score).toBeLessThan(0.35);
  });
});

