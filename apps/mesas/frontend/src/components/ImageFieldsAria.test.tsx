// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarField, type AvatarValue } from './AvatarField';
import { ImageUploader } from './ImageUploader';

/**
 * Campos de imagem do editor de perfil (spec 099, B7): avatar e banner exibem
 * hint e erro, então o controle acionável principal (botão de envio/seleção —
 * o input de arquivo é `display:none` e não recebe foco) carrega o
 * aria-describedby apontando para os ids do hint/erro.
 */

const { validateFile } = vi.hoisted(() => ({
  validateFile: vi.fn<() => string | null>(() => null),
}));

vi.mock('../hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    isUploading: false,
    uploadFile: vi.fn(),
    validateFile,
  }),
}));

vi.mock('../hooks/useImageUrlImport', () => ({
  useImageUrlImport: () => ({
    isImportingUrl: false,
    importUrlIfNeeded: vi.fn(),
    keepDirectLink: false,
    setKeepDirectLink: vi.fn(),
    directLinkTooltip: '',
  }),
}));

vi.mock('@artificio/image-editor', () => ({
  ImageEditor: () => null,
}));

const avatarValue: AvatarValue = { url: '', crop: null, width: null, height: null };

describe('AvatarField — aria-describedby (B7)', () => {
  it('com description: botão de envio aponta para o <p> da descrição', () => {
    render(
      <AvatarField
        idPrefix="avatar"
        label="Foto de Perfil"
        description="Esta é a sua foto de usuário."
        value={avatarValue}
        onChange={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /Enviar nova imagem/ });
    expect(button).toHaveAttribute('aria-describedby', 'avatar-description');
    expect(document.getElementById('avatar-description')).not.toBeNull();
  });

  it('sem description: botão sem o atributo (regra: sem hint/erro, sem atributo)', () => {
    render(
      <AvatarField idPrefix="avatar" label="Foto de Perfil" value={avatarValue} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Enviar nova imagem/ })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('erro de validação: botão descreve também o <small> do erro', () => {
    validateFile.mockReturnValue('Imagem acima do limite.');
    const { container } = render(
      <AvatarField
        idPrefix="avatar"
        label="Foto de Perfil"
        description="Esta é a sua foto de usuário."
        value={avatarValue}
        onChange={() => {}}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    expect(screen.getByText('Imagem acima do limite.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Enviar nova imagem/ })).toHaveAttribute(
      'aria-describedby',
      'avatar-description avatar-error',
    );
    expect(document.getElementById('avatar-error')).not.toBeNull();
  });
});

describe('ImageUploader (banner) — aria-describedby (B7)', () => {
  it('botão de seleção aponta para o span de hint (proporção/formatos)', () => {
    render(
      <ImageUploader
        idPrefix="gm-banner"
        label="Banner do Perfil (opcional)"
        kind="profile_banner"
        value=""
        onChange={() => {}}
        onError={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: /Selecionar imagem/ });
    expect(button).toHaveAttribute('aria-describedby', 'gm-banner-hint');
    expect(document.getElementById('gm-banner-hint')).not.toBeNull();
  });

  it('com erro: botão descreve hint e o <p> do erro', () => {
    render(
      <ImageUploader
        idPrefix="gm-banner"
        label="Banner do Perfil (opcional)"
        kind="profile_banner"
        value=""
        onChange={() => {}}
        onError={() => {}}
        hasError
      />,
    );
    expect(screen.getByRole('button', { name: /Selecionar imagem/ })).toHaveAttribute(
      'aria-describedby',
      'gm-banner-hint gm-banner-error',
    );
    expect(document.getElementById('gm-banner-error')).not.toBeNull();
  });
});

/**
 * O rótulo do campo de imagem NÃO pode ser `<label for>` do input de arquivo.
 * Como `display:block`, ele ocupava a largura inteira do formulário (818px
 * medidos em beta, 2026-09-04) e qualquer clique na faixa — inclusive no vazio
 * longe do texto — abria o seletor de arquivos. Quem dispara o upload é o
 * botão; o vínculo acessível fica por `aria-labelledby`.
 */
describe('campos de imagem — o rótulo não dispara o seletor de arquivos', () => {
  it('AvatarField: nenhum <label for> aponta para o input de arquivo', () => {
    const { container } = render(
      <AvatarField idPrefix="avatar" label="Foto de Mestre" value={avatarValue} onChange={() => {}} />,
    );

    const fileInput = container.querySelector('input[type="file"]')!;
    expect(fileInput).not.toBeNull();
    expect(container.querySelector(`label[for="${fileInput.id}"]`)).toBeNull();
    const rotuloId = fileInput.getAttribute('aria-labelledby')!;
    expect(document.getElementById(rotuloId)?.textContent).toBe('Foto de Mestre');
  });
});

/**
 * O botão VISÍVEL cita o campo no nome acessível. O `aria-labelledby` do input
 * não resolve isso: ele é `display:none`/`hidden` e nunca recebe foco, então
 * quem o leitor de tela anuncia é o botão. Com dois campos de imagem na mesma
 * tela ("Foto de Mestre" e "Banner do Perfil"), sem isso saem dois botões de
 * nome idêntico e indistinguível (achado de review, PR #307).
 */
describe('campos de imagem — o botão de upload diz de qual campo é', () => {
  it('AvatarField: o nome do botão inclui o rótulo do campo', () => {
    render(
      <AvatarField idPrefix="avatar" label="Foto de Mestre" value={avatarValue} onChange={() => {}} />,
    );

    expect(screen.getByRole('button', { name: /Foto de Mestre/ })).toBeTruthy();
  });

  it('ImageUploader: idem, e dois campos na mesma tela ficam distinguíveis', () => {
    render(
      <>
        <ImageUploader
          idPrefix="gm-banner"
          label="Banner do Perfil (opcional)"
          value=""
          onChange={() => {}}
          onError={() => {}}
          kind="gm_banner"
        />
        <ImageUploader
          idPrefix="table-banner"
          label="Banner da Mesa"
          value=""
          onChange={() => {}}
          onError={() => {}}
          kind="table_banner"
        />
      </>,
    );

    // Nomes distintos: a busca por cada rótulo devolve exatamente um botão.
    expect(screen.getByRole('button', { name: /Banner do Perfil/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Banner da Mesa/ })).toBeTruthy();
  });
});
