// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterDrawer } from './FilterDrawer';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';

describe('FilterDrawer — contrato modal da spec 094', () => {
  it('contém Tab e Shift+Tab dentro do dialog', () => {
    render(
      <FilterDrawer isOpen onClose={vi.fn()} onClear={vi.fn()} onApply={vi.fn()}>
        <select aria-label="Filtro de teste"><option>Todos</option></select>
      </FilterDrawer>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusables[0];
    const last = focusables.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    last?.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('Aplicar confirma pelo callback próprio antes de fechar', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <FilterDrawer isOpen onClose={onClose} onClear={vi.fn()} onApply={onApply}>
        <p>Conteúdo</p>
      </FilterDrawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
