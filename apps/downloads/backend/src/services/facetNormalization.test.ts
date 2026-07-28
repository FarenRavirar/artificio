import {
  normalizeAuthorKey,
  normalizeCreditNames,
  normalizePublisherKey,
  splitCreditNames,
} from './facetNormalization';

describe('facetNormalization', () => {
  it('une grafias equivalentes sem alterar o nome exibido', () => {
    expect(normalizePublisherKey('Grimórios & Dados Editora')).toBe('grimorios e dados');
    expect(normalizePublisherKey('  Grimorios e Dados  ')).toBe('grimorios e dados');
  });

  it('não funde editoras distintas', () => {
    expect(normalizePublisherKey('Editora Abril')).not.toBe(normalizePublisherKey('Abril Cultural'));
    expect(normalizePublisherKey('Dados Editora')).not.toBe(normalizePublisherKey('Dados Livres'));
  });

  it('não produz faceta só com sufixo societário', () => {
    expect(normalizePublisherKey('Editora')).toBe('');
  });

  it('estrutura múltiplos créditos e remove duplicata por chave', () => {
    const parsed = normalizeCreditNames(splitCreditNames('Ágata; Agata\nBruno'));
    expect(parsed).toEqual({ labels: ['Ágata', 'Bruno'], keys: ['agata', 'bruno'] });
    expect(normalizeAuthorKey('João da Silva')).toBe('joao da silva');
  });

  it('preserva vírgula interna de nome observado em fonte real', () => {
    expect(splitCreditNames('Angevine, Dall.e')).toEqual(['Angevine, Dall.e']);
  });
});
