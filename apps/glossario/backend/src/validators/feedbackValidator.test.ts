import { describe, it, expect } from 'vitest';
import { parseFeedbackInput, FEEDBACK_LIMITS } from './feedbackValidator.js';

describe('parseFeedbackInput', () => {
  it('rejeita corpo nao-objeto', () => {
    expect(parseFeedbackInput(null).ok).toBe(false);
    expect(parseFeedbackInput('x').ok).toBe(false);
    expect(parseFeedbackInput([]).ok).toBe(false);
  });

  it('rejeita kind invalido', () => {
    const r = parseFeedbackInput({ kind: 'other', title: 't', description: 'd' });
    expect(r.ok).toBe(false);
  });

  it('exige titulo e descricao', () => {
    expect(parseFeedbackInput({ kind: 'bug', title: '', description: 'd' }).ok).toBe(false);
    expect(parseFeedbackInput({ kind: 'bug', title: 't', description: '   ' }).ok).toBe(false);
  });

  it('aceita payload minimo (anonimo, sem email)', () => {
    const r = parseFeedbackInput({ kind: 'suggestion', title: 'Ideia', description: 'Detalhe' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('suggestion');
      expect(r.value.contact_email).toBeNull();
      expect(r.value.console_errors).toEqual([]);
      expect(r.value.screenshot).toBeNull();
    }
  });

  it('valida email opt-in', () => {
    expect(parseFeedbackInput({ kind: 'bug', title: 't', description: 'd', contact_email: 'nope' }).ok).toBe(false);
    const r = parseFeedbackInput({ kind: 'bug', title: 't', description: 'd', contact_email: 'a@b.com' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contact_email).toBe('a@b.com');
  });

  it('trunca campos longos', () => {
    const r = parseFeedbackInput({
      kind: 'bug',
      title: 'a'.repeat(500),
      description: 'b'.repeat(9000),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title.length).toBe(FEEDBACK_LIMITS.title);
      expect(r.value.description.length).toBe(FEEDBACK_LIMITS.description);
    }
  });

  it('descarta itens de console/rede invalidos e respeita o cap', () => {
    const r = parseFeedbackInput({
      kind: 'bug',
      title: 't',
      description: 'd',
      console_errors: [
        { level: 'error', message: 'boom' },
        { message: '' },
        'lixo',
        null,
      ],
      network_errors: [
        { url: '/api/x', method: 'post', status: 500 },
        { url: '', status: 400 },
        { url: '/api/y', status: 'NaN' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.console_errors).toHaveLength(1);
      expect(r.value.console_errors[0].message).toBe('boom');
      expect(r.value.network_errors).toHaveLength(1);
      expect(r.value.network_errors[0].method).toBe('POST');
    }
  });

  it('rejeita screenshot fora do formato data:image e aceita valido', () => {
    const bad = parseFeedbackInput({ kind: 'bug', title: 't', description: 'd', screenshot: 'http://x/y.png' });
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.value.screenshot).toBeNull();

    const good = parseFeedbackInput({
      kind: 'bug',
      title: 't',
      description: 'd',
      screenshot: 'data:image/jpeg;base64,/9j/AAAA',
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.screenshot).toMatch(/^data:image\/jpeg;base64,/);
  });
});
