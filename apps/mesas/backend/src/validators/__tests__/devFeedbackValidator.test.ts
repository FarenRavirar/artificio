import {
  parseDevFeedbackInput,
  DEV_FEEDBACK_LIMITS,
} from '../devFeedbackValidator.js';

const baseInput = () => ({
  kind: 'bug',
  title: 'Botao nao responde',
  description: 'Cliquei e nada aconteceu.',
});

describe('parseDevFeedbackInput - obrigatorios', () => {
  it('aceita payload minimo valido', () => {
    const r = parseDevFeedbackInput(baseInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('bug');
      expect(r.value.title).toBe('Botao nao responde');
      expect(r.value.console_errors).toEqual([]);
      expect(r.value.network_errors).toEqual([]);
      expect(r.value.screenshot).toBeNull();
    }
  });

  it('rejeita kind invalido', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), kind: 'outro' });
    expect(r.ok).toBe(false);
  });

  it('rejeita title vazio', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), title: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rejeita description vazia', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), description: '' });
    expect(r.ok).toBe(false);
  });

  it('rejeita entrada nao-objeto', () => {
    expect(parseDevFeedbackInput(null).ok).toBe(false);
    expect(parseDevFeedbackInput('x').ok).toBe(false);
    expect(parseDevFeedbackInput(undefined).ok).toBe(false);
  });
});

describe('parseDevFeedbackInput - limites e truncamento', () => {
  it('trunca title acima do limite', () => {
    const long = 'a'.repeat(DEV_FEEDBACK_LIMITS.title + 50);
    const r = parseDevFeedbackInput({ ...baseInput(), title: long });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.title.length).toBe(DEV_FEEDBACK_LIMITS.title);
  });

  it('trunca description acima do limite', () => {
    const long = 'b'.repeat(DEV_FEEDBACK_LIMITS.description + 100);
    const r = parseDevFeedbackInput({ ...baseInput(), description: long });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.description.length).toBe(DEV_FEEDBACK_LIMITS.description);
  });

  it('trunca page_url/route_path/user_agent', () => {
    const r = parseDevFeedbackInput({
      ...baseInput(),
      page_url: 'u'.repeat(DEV_FEEDBACK_LIMITS.url + 50),
      route_path: 'r'.repeat(DEV_FEEDBACK_LIMITS.routePath + 50),
      user_agent: 'g'.repeat(DEV_FEEDBACK_LIMITS.userAgent + 50),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.page_url!.length).toBe(DEV_FEEDBACK_LIMITS.url);
      expect(r.value.route_path!.length).toBe(DEV_FEEDBACK_LIMITS.routePath);
      expect(r.value.user_agent!.length).toBe(DEV_FEEDBACK_LIMITS.userAgent);
    }
  });
});

describe('parseDevFeedbackInput - console_errors', () => {
  it('vira [] quando nao-array', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), console_errors: 'nope' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.console_errors).toEqual([]);
  });

  it('normaliza itens, trunca mensagem e descarta sem message', () => {
    const r = parseDevFeedbackInput({
      ...baseInput(),
      console_errors: [
        { level: 'error', message: 'm'.repeat(DEV_FEEDBACK_LIMITS.message + 100), ts: '2026-06-02T00:00:00Z' },
        { level: 'warn' },
        { message: '' },
        'string solta',
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.console_errors.length).toBe(1);
      expect(r.value.console_errors[0].message.length).toBe(DEV_FEEDBACK_LIMITS.message);
      expect(r.value.console_errors[0].level).toBe('error');
    }
  });

  it('limita a quantidade de itens (cap)', () => {
    const many = Array.from({ length: DEV_FEEDBACK_LIMITS.arrayCap + 20 }, (_, i) => ({
      level: 'error',
      message: `erro ${i}`,
    }));
    const r = parseDevFeedbackInput({ ...baseInput(), console_errors: many });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.console_errors.length).toBe(DEV_FEEDBACK_LIMITS.arrayCap);
  });
});

describe('parseDevFeedbackInput - network_errors', () => {
  it('vira [] quando nao-array', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), network_errors: { url: 'x' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.network_errors).toEqual([]);
  });

  it('normaliza url/method/status e descarta sem url ou status nao-numerico', () => {
    const r = parseDevFeedbackInput({
      ...baseInput(),
      network_errors: [
        { url: '/api/v1/gm/tables', method: 'POST', status: 500, ts: '2026-06-02T00:00:00Z' },
        { method: 'GET', status: 404 },
        { url: '/x', status: 'oops' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.network_errors.length).toBe(1);
      expect(r.value.network_errors[0].status).toBe(500);
      expect(r.value.network_errors[0].method).toBe('POST');
    }
  });
});

describe('parseDevFeedbackInput - contact_email', () => {
  it('aceita e-mail valido', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), contact_email: 'a@b.com' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contact_email).toBe('a@b.com');
  });

  it('rejeita e-mail invalido', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), contact_email: 'nao-eh-email' });
    expect(r.ok).toBe(false);
  });

  it('vazio/ausente vira null', () => {
    const r1 = parseDevFeedbackInput({ ...baseInput(), contact_email: '' });
    const r2 = parseDevFeedbackInput(baseInput());
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok) expect(r1.value.contact_email).toBeNull();
    if (r2.ok) expect(r2.value.contact_email).toBeNull();
  });
});

describe('parseDevFeedbackInput - screenshot', () => {
  it('aceita data URI de imagem valido', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const r = parseDevFeedbackInput({ ...baseInput(), screenshot: dataUri });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.screenshot).toBe(dataUri);
  });

  it('descarta screenshot invalido (vira null, nao erro)', () => {
    const r = parseDevFeedbackInput({ ...baseInput(), screenshot: 'http://x/y.png' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.screenshot).toBeNull();
  });

  it('descarta screenshot acima do limite de tamanho', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(DEV_FEEDBACK_LIMITS.screenshotChars + 10);
    const r = parseDevFeedbackInput({ ...baseInput(), screenshot: huge });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.screenshot).toBeNull();
  });
});
