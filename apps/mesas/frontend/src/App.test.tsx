// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackendStatusScreen } from './App';

describe('BackendStatusScreen — temas light/dark', () => {
  it.each([
    ['loading', 'Conectando ao backend...'],
    ['unavailable', 'Atualização sendo executada'],
  ] as const)('usa tokens de superfície e texto no estado %s', (status, text) => {
    render(<BackendStatusScreen status={status} />);

    const screenRoot = screen.getByText(text).parentElement?.parentElement;
    expect(screenRoot).toHaveStyle({
      backgroundColor: 'var(--surface)',
      color: 'var(--fg)',
    });
  });
});
