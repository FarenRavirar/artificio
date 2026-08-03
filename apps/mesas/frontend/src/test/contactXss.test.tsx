// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactMethodsEditor } from '../components/mestre/ContactMethodsEditor';
import { MestreContactMethods } from '../components/mestre/MestreContactMethods';
import { ContactsFormBlock } from '../components/ContactsFormBlock';
import { TableContactsBlock } from '../features/table/components/TableContactsBlock';
import { handleCTA } from '../features/table/utils/uiHelpers';
import { toSafeHttpsUrl, validateHttpsUrl } from '../utils/safeExternalUrl';

vi.mock('../hooks/useTracking', () => ({
  useTracking: () => ({ trackGmContactClick: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navegação externa segura', () => {
  it.each(['javascript:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)', 'http://example.com'])(
    'rejeita esquema inseguro %s',
    (unsafeUrl) => {
      expect(toSafeHttpsUrl(unsafeUrl)).toBeNull();
    },
  );

  it('canonicaliza endereço sem esquema e explica a exigência para http explícito', () => {
    expect(toSafeHttpsUrl('forms.gle/abc')).toBe('https://forms.gle/abc');
    expect(validateHttpsUrl('http://forms.gle/abc')).toEqual({
      success: false,
      message: expect.stringContaining('https://'),
    });
  });

  it('C: CTA não abre javascript e abre HTTPS sem acesso à página de origem', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    handleCTA({ label: 'Entrar', disabled: false, variant: 'primary', action: 'external-link', actionUrl: 'javascript:alert(1)' });
    expect(openSpy).not.toHaveBeenCalled();

    handleCTA({ label: 'Entrar', disabled: false, variant: 'primary', action: 'external-link', actionUrl: 'forms.gle/abc' });
    expect(openSpy).toHaveBeenCalledWith('https://forms.gle/abc', '_blank', 'noopener,noreferrer');
  });

  it('X1: neutraliza os dois hrefs Discord hostis e mantém os dois quando válidos', () => {
    const contact = {
      channel: 'discord' as const,
      value: 'mestre',
      label: null,
      discord_server_url: 'javascript:alert(1)',
      sort_order: 0,
    };
    const { rerender } = render(<TableContactsBlock contacts={[contact]} />);
    expect(screen.queryByRole('link', { name: /Entrar no servidor Discord/i })).not.toBeInTheDocument();

    rerender(<TableContactsBlock contacts={[{ ...contact, discord_server_url: 'discord.gg/convite' }]} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute('href') === 'https://discord.gg/convite')).toBe(true);
  });

  it('L2: contato de email usa mailto em vez de https://email', () => {
    render(<TableContactsBlock contacts={[{
      channel: 'email',
      value: 'mestre@example.com',
      label: null,
      discord_server_url: null,
      sort_order: 0,
    }]} />);

    expect(screen.getByRole('link', { name: /Enviar e-mail/i })).toHaveAttribute('href', 'mailto:mestre@example.com');
  });

  it('X2: formulário hostil não abre; formulário sem esquema abre HTTPS com isolamento', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { rerender } = render(
      <MestreContactMethods contacts={[{ channel: 'form', value: 'javascript:alert(1)' }]} gmSlug="mestre" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Preencher formulário/i }));
    expect(openSpy).not.toHaveBeenCalled();

    rerender(<MestreContactMethods contacts={[{ channel: 'form', value: 'forms.gle/abc' }]} gmSlug="mestre" />);
    fireEvent.click(screen.getByRole('button', { name: /Preencher formulário/i }));
    expect(openSpy).toHaveBeenCalledWith('https://forms.gle/abc', '_blank', 'noopener,noreferrer');
  });

  it('X2: href Discord hostil é omitido; convite sem esquema é canonicalizado', () => {
    const { rerender } = render(
      <MestreContactMethods
        contacts={[{ channel: 'discord', value: 'mestre', discord_server_url: 'https://evil.example/invite/x' }]}
        gmSlug="mestre"
      />,
    );
    expect(screen.queryByRole('link', { name: /Entrar no servidor/i })).not.toBeInTheDocument();

    rerender(
      <MestreContactMethods
        contacts={[{ channel: 'discord', value: 'mestre', discord_server_url: 'discord.com/invite/abc' }]}
        gmSlug="mestre"
      />,
    );
    expect(screen.getByRole('link', { name: /Entrar no servidor/i })).toHaveAttribute(
      'href',
      'https://discord.com/invite/abc',
    );
  });
});

describe('formulários explicam e aplicam HTTPS antes do envio', () => {
  it('perfil mostra regra e bloqueia http explícito com mensagem específica', () => {
    const onSave = vi.fn();
    render(<ContactMethodsEditor contacts={[{ channel: 'form', value: 'http://forms.gle/abc' }]} onSave={onSave} />);

    expect(screen.getByText(/Endereço sem esquema será salvo como https:\/\//i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Somente URLs https:// são aceitas.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('edição de mesa mostra regra para formulário e convite Discord', () => {
    const { rerender } = render(
      <ContactsFormBlock
        contacts={[{ channel: 'form', value: '', label: '', discord_server_url: '' }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Endereço sem esquema será salvo como https:\/\//i)).toBeInTheDocument();

    rerender(
      <ContactsFormBlock
        contacts={[{ channel: 'discord', value: '', label: '', discord_server_url: '' }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Discord não oferece link direto por @usuário/i)).toBeInTheDocument();
  });
});
