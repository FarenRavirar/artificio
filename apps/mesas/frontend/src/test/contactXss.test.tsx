// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactMethodsEditor } from '../components/mestre/ContactMethodsEditor';
import { MestreContactMethods } from '../components/mestre/MestreContactMethods';
import { ContactsFormBlock } from '../components/ContactsFormBlock';
import { TableContactsBlock } from '../features/table/components/TableContactsBlock';
import { handleCTA } from '../features/table/utils/uiHelpers';
import {
  toSafeHttpsUrl,
  toSafeMailtoUrl,
  toSafeSocialProfileUrl,
  toWhatsAppUrl,
  validateContactLinkUrl,
  validateHttpsUrl,
} from '../utils/safeExternalUrl';
import { validators } from '../features/create-table/utils/validation';

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

describe('canais de contato continuam alcançáveis após a validação de URL', () => {
  it('D10: telefone vira wa.me em vez de sumir da página', () => {
    // Regressão registrada pelo Codex na PR #236: com toSafeHttpsUrl puro, o
    // formato sugerido pelo próprio formulário deixava o contato invisível.
    expect(toWhatsAppUrl('(11) 99999-9999')).toBe('https://wa.me/5511999999999');
    expect(toWhatsAppUrl('+5511999999999')).toBe('https://wa.me/5511999999999');
    expect(toWhatsAppUrl('123')).toBeNull();
  });

  it('D10: telefone renderiza botão de WhatsApp na página pública', () => {
    render(<TableContactsBlock contacts={[{
      channel: 'phone',
      value: '(11) 99999-9999',
      label: null,
      discord_server_url: null,
      sort_order: 0,
    }]} />);

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', 'https://wa.me/5511999999999');
  });

  it('D10: username de rede social vira perfil, host estranho é recusado', () => {
    expect(toSafeSocialProfileUrl('facebook', 'meuperfil')).toBe('https://facebook.com/meuperfil');
    expect(toSafeSocialProfileUrl('instagram', '@meuperfil')).toBe('https://instagram.com/meuperfil');
    expect(toSafeSocialProfileUrl('instagram', 'instagram.com/meuperfil')).toBe('https://instagram.com/meuperfil');
    expect(toSafeSocialProfileUrl('instagram', 'https://evil.example/meuperfil')).toBeNull();
    expect(toSafeSocialProfileUrl('facebook', 'javascript:alert(1)')).toBeNull();
  });

  it('D10: mailto rejeita injeção de cabeçalho e endereço malformado', () => {
    expect(toSafeMailtoUrl('mestre@example.com')).toBe('mailto:mestre@example.com');
    expect(toSafeMailtoUrl('vitima@x.com\nBcc: outro@x.com')).toBeNull();
    expect(toSafeMailtoUrl('vitima@x.com%0ABcc:todos@x.com')).toBeNull();
    expect(toSafeMailtoUrl('sem-arroba')).toBeNull();
    expect(toSafeMailtoUrl('a@b')).toBeNull();
  });

  it('D10: mailto recusa campos de mensagem embutidos no endereço', () => {
    // Achado do CodeRabbit na PR #236: `?subject=`/`?body=` passavam pela lista
    // de caracteres proibidos e o cliente de e-mail os trata como campos,
    // pré-preenchendo a mensagem da vítima.
    expect(toSafeMailtoUrl('vitima@x.com?subject=Urgente&body=clique')).toBeNull();
    expect(toSafeMailtoUrl('a@b.com&x=1')).toBeNull();
    expect(toSafeMailtoUrl('a+tag@sub.example.co.uk')).toBe('mailto:a+tag@sub.example.co.uk');
  });
});

describe('link de contato exige endereço alcançável', () => {
  it('recusa identificador solto e explica o canal Discord', () => {
    // Espelha isResolvableUrl do backend. Sem isso `uwill` virava
    // `https://uwill/` — URL bem-formada, erro de DNS para o jogador.
    for (const value of ['uwill', '.zero9899', 'kauarang', 'localhost']) {
      const result = validateContactLinkUrl(value);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.message).toContain('Discord');
    }
  });

  it('aceita endereço com host real, com ou sem esquema', () => {
    expect(validateContactLinkUrl('https://forms.gle/abc')).toEqual({
      success: true,
      url: 'https://forms.gle/abc',
    });
    expect(validateContactLinkUrl('forms.gle/abc').success).toBe(true);
  });

  it('mantém a recusa de esquema hostil herdada de validateHttpsUrl', () => {
    expect(validateContactLinkUrl('javascript:alert(1)').success).toBe(false);
    expect(validateContactLinkUrl('http://forms.gle/abc').success).toBe(false);
  });

  it('formulário de criação de mesa bloqueia nick em canal de URL', () => {
    expect(validators.contacts([
      { channel: 'form', value: 'uwill', label: '', discord_server_url: '' },
    ])).toContain('Discord');

    expect(validators.contacts([
      { channel: 'form', value: 'https://forms.gle/abc', label: '', discord_server_url: '' },
    ])).toBeNull();
  });

  it('formulário de criação de mesa bloqueia e-mail malformado', () => {
    expect(validators.contacts([
      { channel: 'email', value: 'vitima@x.com?subject=x', label: '', discord_server_url: '' },
    ])).toContain('e-mail');

    expect(validators.contacts([
      { channel: 'email', value: 'mestre@example.com', label: '', discord_server_url: '' },
    ])).toBeNull();
  });

  it('aviso do formulário diz o que é aceito e para onde vai o nick', () => {
    render(
      <ContactsFormBlock
        contacts={[{ channel: 'form', value: '', label: '', discord_server_url: '' }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Nome de usuário sozinho não funciona como link/i)).toBeInTheDocument();
  });
});

describe('formulários explicam e aplicam HTTPS antes do envio', () => {
  it('perfil mostra regra e bloqueia http explícito com mensagem específica', () => {
    const onSave = vi.fn();
    render(<ContactMethodsEditor contacts={[{ channel: 'form', value: 'http://forms.gle/abc' }]} onSave={onSave} />);

    expect(screen.getByText(/Nome de usuário sozinho não funciona como link/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Nome de usuário sozinho não funciona como link/i)).toBeInTheDocument();

    rerender(
      <ContactsFormBlock
        contacts={[{ channel: 'discord', value: '', label: '', discord_server_url: '' }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Discord não oferece link direto por @usuário/i)).toBeInTheDocument();
  });
});
