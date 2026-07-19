import { describe, it, expect } from 'vitest';
import { mapTableApiToInitialData } from './mapTableApiToInitialData';

describe('mapTableApiToInitialData', () => {
  it('inclui id no objeto retornado (bug real: editar mesa criava mesa nova por id ausente)', () => {
    const result = mapTableApiToInitialData({ id: 'table-uuid-123', title: 'Mesa X' });
    expect(result.id).toBe('table-uuid-123');
  });

  it('id fica undefined quando ausente no payload da API', () => {
    const result = mapTableApiToInitialData({ title: 'Mesa sem id' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para string vazia (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: '', title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para string whitespace-only (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: '   ', title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para valor nao-string (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: 12345, title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('retorna objeto vazio para payload invalido, sem quebrar', () => {
    const result = mapTableApiToInitialData(null);
    expect(result).toEqual({});
  });
});
