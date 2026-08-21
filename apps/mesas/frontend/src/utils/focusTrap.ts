const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Mantém Tab/Shift+Tab dentro de um dialog modal (spec 094, R16). */
export function trapModalTab(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;

  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.closest('[hidden], [aria-hidden="true"], [inert]'));
  if (focusable.length === 0) {
    event.preventDefault();
    container.tabIndex = -1;
    container.focus();
    return;
  }

  // `focusable.length > 0` acima garante ambos; o TS não estreita índice/`at()`, daí o `!`.
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
