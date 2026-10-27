// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MestreContactMethods } from './MestreContactMethods';
import type { TableContactChannel } from '../../types/tables';

vi.mock('../../hooks/useTracking', () => ({
  useTracking: () => ({ trackGmContactClick: vi.fn() }),
}));

/**
 * Spec 106 R17. Canal vem do servidor; um valor que o front não conhece derrubava a
 * página inteira (`<Icon/>` recebia `undefined`, mesmo defeito do `redfallen`).
 */
describe('MestreContactMethods', () => {
  it('canal desconhecido renderiza com fallback, sem derrubar os outros contatos', () => {
    render(
      <MestreContactMethods
        gmSlug="mestre"
        contacts={[
          { channel: 'mastodon' as TableContactChannel, value: '@alguem@mastodon.social' },
          { channel: 'email', value: 'a@b.com' },
        ]}
      />,
    );
    expect(screen.getByText('@alguem@mastodon.social')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
    // So o e-mail tem acao: o canal desconhecido mostra o valor sem botao inoperante.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Preencher formulário')).toBeNull();
  });
});
