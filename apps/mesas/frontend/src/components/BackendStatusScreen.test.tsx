// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackendStatusScreen } from './BackendStatusScreen';

// Migrado de `src/App.test.tsx` na spec 102 T4.2, junto com o componente: o
// `App.tsx` saiu quando o framework mode passou a montar o documento em
// `root.tsx`, mas a garantia de tema continua valendo — é a tela que o visitante
// vê durante um deploy, e ela precisa respeitar light/dark como o resto do app.
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
