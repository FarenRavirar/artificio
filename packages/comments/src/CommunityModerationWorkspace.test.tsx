// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CommentReportPanel, CommunityModerationWorkspace } from './CommunityModerationWorkspace.js';
import type { CommunityModerationAdapter, ModerationCase, ModerationQueue } from './moderation.js';

const queue: ModerationQueue = {
  items: [{
    case_id: 'case-1', comment_id: 'comment-1', source_app: 'downloads', status: 'open',
    opened_at: '2026-08-14T10:00:00.000Z', active_report_count: 2,
    reason_codes: ['spam'], priority: 1, comment_visibility_state: 'visible',
  }],
  new_account_comments: [],
};

const reactTestEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(() => { reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false; });

function adapter(remove = vi.fn().mockResolvedValue({})): CommunityModerationAdapter {
  return {
    remove,
    restore: vi.fn().mockResolvedValue({}),
    resolveCase: vi.fn().mockResolvedValue({}),
    decideAppeal: vi.fn().mockResolvedValue({}),
    applySanction: vi.fn().mockResolvedValue({}),
  };
}

function button(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Botão não encontrado: ${text}`);
  return match;
}

function confirmButton(): HTMLButtonElement {
  const match = document.querySelector('.artificio-confirm-btn-confirm');
  if (!(match instanceof HTMLButtonElement)) throw new Error('confirmação ausente');
  return match;
}

async function setTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector('#moderation-reason');
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('textarea ausente');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function changeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, event = 'change') {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(event, { bubbles: true }));
  });
}

afterEach(() => { document.body.innerHTML = ''; });

describe('CommunityModerationWorkspace', () => {
  it('cancela e confirma retirada individual no ConfirmDialog compartilhado', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); const remove = vi.fn().mockResolvedValue({});
    await act(async () => root.render(<CommunityModerationWorkspace queue={queue} adapter={adapter(remove)} />));
    await setTextarea(container, 'Motivo auditável');

    await act(async () => button('Retirar').click());
    await act(async () => button('Cancelar').click());
    expect(remove).not.toHaveBeenCalled();

    await act(async () => button('Retirar').click());
    await act(async () => { confirmButton().click(); await Promise.resolve(); });
    expect(remove).toHaveBeenCalledWith('comment-1', 'Motivo auditável');
    await act(async () => root.unmount());
  });

  it('preserva seleção e anuncia conflito 409 em ação destrutiva em lote', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const remove = vi.fn().mockRejectedValue(new Error('Conflito 409: recarregue.'));
    await act(async () => root.render(<CommunityModerationWorkspace queue={queue} adapter={adapter(remove)} />));
    await setTextarea(container, 'Motivo auditável');
    const checkbox = container.querySelector('input[aria-label="Selecionar comentário comment-1"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('seleção ausente');
    await act(async () => checkbox.click());
    await act(async () => button('Retirar selecionados').click());
    await act(async () => { confirmButton().click(); await Promise.resolve(); });

    expect(checkbox.checked).toBe(true);
    expect(container.textContent).toContain('Conflito 409: recarregue.');
    // A contagem entra junto da causa: em lote, saber quantos passaram decide
    // se o moderador repete tudo ou só o que faltou (achado de review, #262).
    expect(container.querySelector('[data-moderation-error]')?.textContent)
      .toContain('1 falhou(ram) e seguem como estavam');
    await act(async () => root.unmount());
  });

  it('mantém vereditos mistos e identidade expurgada no workspace de caso', async () => {
    const selectedCase: ModerationCase = {
      case_id: 'case-1', comment_id: 'comment-1', reported_author_actor_id: 'actor-1', status: 'open', terminal_action: null,
      opened_at: '2026-08-14T10:00:00.000Z', closed_at: null, decision_reason: null,
      reports: [
        { id: 'r1', reason_code: 'spam', details: null, state: 'active', created_at: '2026-08-14T10:00:00.000Z', reported_version_id: 'v1', reporter_actor_id: 'a1', reporter_display_name: null },
        { id: 'r2', reason_code: 'harassment', details: 'Ataque', state: 'active', created_at: '2026-08-14T10:01:00.000Z', reported_version_id: 'v1', reporter_actor_id: 'a2', reporter_display_name: 'Bia' },
      ],
    };
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); const currentAdapter = adapter();
    await act(async () => root.render(<CommunityModerationWorkspace queue={queue} selectedCase={selectedCase} adapter={currentAdapter} />));
    expect(container.textContent).toContain('Identidade expurgada');
    await changeValue(container.querySelector('#verdict-r1') as HTMLSelectElement, 'upheld');
    await changeValue(container.querySelector('#verdict-r2') as HTMLSelectElement, 'dismissed');
    await changeValue(container.querySelector('#case-reason') as HTMLTextAreaElement, 'Decisão granular', 'input');
    await act(async () => button('Fechar caso').click());
    await act(async () => { confirmButton().click(); await Promise.resolve(); });
    expect(currentAdapter.resolveCase).toHaveBeenCalledWith('case-1', expect.objectContaining({
      verdicts: [{ report_id: 'r1', verdict: 'upheld' }, { report_id: 'r2', verdict: 'dismissed' }],
    }));
    await act(async () => root.unmount());
  });

  it('bloqueia denúncia com detalhe obrigatório vazio e usa catálogo recebido', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); const onSubmit = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<CommentReportPanel commentId="comment-1" reasons={[{ code: 'other', label: 'Outro', priority: 2, details_policy: 'required' }]} reports={[]} onSubmit={onSubmit} onWithdraw={vi.fn()} />));
    await changeValue(container.querySelector('select') as HTMLSelectElement, 'other');
    expect(button('Enviar denúncia').disabled).toBe(true);
    await changeValue(container.querySelector('textarea') as HTMLTextAreaElement, 'Contexto', 'input');
    expect(button('Enviar denúncia').disabled).toBe(false);
    await act(async () => { button('Enviar denúncia').click(); await Promise.resolve(); });
    expect(onSubmit).toHaveBeenCalledWith('other', 'Contexto');
    await act(async () => root.unmount());
  });
});
