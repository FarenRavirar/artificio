// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterDrawer } from './FilterDrawer';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('FilterDrawer — contrato modal da spec 094', () => {
  it('contém Tab e Shift+Tab dentro do dialog', () => {
    render(
      <FilterDrawer isOpen onClose={vi.fn()} onClear={vi.fn()} onApply={vi.fn()}>
        <select aria-label="Filtro de teste"><option>Todos</option></select>
      </FilterDrawer>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    expect(dialog.tagName).toBe('DIALOG');
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

  it('preserva o foco durante rerender do rascunho e o devolve ao gatilho ao fechar', () => {
    const onClear = vi.fn();
    const onApply = vi.fn();
    const renderTree = (isOpen: boolean, onClose: () => void, draftValue: string) => (
      <>
        <button type="button">Mais filtros</button>
        <FilterDrawer
          isOpen={isOpen}
          onClose={onClose}
          onClear={onClear}
          onApply={onApply}
        >
          <select aria-label="Experiência" value={draftValue} onChange={() => undefined}>
            <option value="">Todas</option>
            <option value="veterano">Veterano</option>
          </select>
        </FilterDrawer>
      </>
    );

    const initialOnClose = vi.fn();
    const { rerender } = render(renderTree(false, initialOnClose, ''));
    const trigger = screen.getByRole('button', { name: 'Mais filtros' });
    trigger.focus();

    rerender(renderTree(true, initialOnClose, ''));
    const experience = screen.getByRole('combobox', { name: 'Experiência' });
    experience.focus();

    rerender(renderTree(true, vi.fn(), 'veterano'));
    expect(document.activeElement).toBe(experience);

    rerender(renderTree(false, vi.fn(), 'veterano'));
    expect(document.activeElement).toBe(trigger);
  });

  it('remove Aplicar e Limpar da navegação enquanto aplica', () => {
    render(
      <FilterDrawer isOpen isApplying onClose={vi.fn()} onClear={vi.fn()} onApply={vi.fn()}>
        <p>Conteúdo</p>
      </FilterDrawer>,
    );

    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('fecha ao cruzar o breakpoint para desktop', () => {
    const mediaQuery = {
      matches: false,
      media: '(min-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    window.matchMedia = vi.fn().mockReturnValue(mediaQuery) as unknown as typeof window.matchMedia;
    const onClose = vi.fn();
    render(
      <FilterDrawer isOpen onClose={onClose} onClear={vi.fn()} onApply={vi.fn()}>
        <p>Conteúdo</p>
      </FilterDrawer>,
    );
    const changeHandler = vi.mocked(mediaQuery.addEventListener).mock.calls.find(
      ([eventName]) => eventName === 'change',
    )?.[1] as EventListener;

    act(() => changeHandler({ matches: true } as unknown as MediaQueryListEvent));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
