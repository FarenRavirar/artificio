// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { trapModalTab } from './focusTrap';

describe('trapModalTab', () => {
  it('ignora controles em árvores hidden, aria-hidden ou inert', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button data-visible>Visível</button>
      <div hidden><button data-hidden>Hidden</button></div>
      <div aria-hidden="true"><button data-aria-hidden>Aria hidden</button></div>
      <div inert><button data-inert>Inert</button></div>
    `;
    document.body.append(container);
    const visible = container.querySelector<HTMLElement>('[data-visible]')!;
    visible.focus();

    trapModalTab(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }), container);

    expect(document.activeElement).toBe(visible);
    container.remove();
  });

  it('torna o container focável quando não há controles elegíveis', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    trapModalTab(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(container.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(container);
    container.remove();
  });
});
