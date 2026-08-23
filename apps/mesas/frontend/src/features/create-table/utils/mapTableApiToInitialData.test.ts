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

  it('popula price_value_monthly do payload na edicao', () => {
    const result = mapTableApiToInitialData({ price_value_monthly: 40 });
    expect(result.form?.price_value_monthly).toBe('40');
  });

  it('price_value_monthly fica vazio quando ausente no payload (mesa sem pacote mensal)', () => {
    const result = mapTableApiToInitialData({ price_type: 'paga', price_value: 55 });
    expect(result.form?.price_value_monthly).toBe('');
  });

  it('popula accepts_donations do payload na edicao (mesa gratuita que aceita doacoes)', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita', accepts_donations: true });
    expect(result.form?.accepts_donations).toBe(true);
  });

  it('accepts_donations fica false quando ausente no payload (mesa sem doacoes)', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita' });
    expect(result.form?.accepts_donations).toBe(false);
  });

  it('popula suggested_donation_value do payload como string na edicao', () => {
    const result = mapTableApiToInitialData({ accepts_donations: true, suggested_donation_value: 10 });
    expect(result.form?.suggested_donation_value).toBe('10');
  });

  it('suggested_donation_value fica vazio quando ausente no payload', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita', accepts_donations: true });
    expect(result.form?.suggested_donation_value).toBe('');
  });

  it('price_type ausente vira gratuita, nao o valor fantasma legado free (achado Codex PR #283)', () => {
    const result = mapTableApiToInitialData({ title: 'Mesa X' });
    expect(result.form?.price_type).toBe('gratuita');
  });
});
