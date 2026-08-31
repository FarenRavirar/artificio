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
    const button = screen.getByRole('button', { name: 'Selecionar imagem' });
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
    expect(screen.getByRole('button', { name: 'Selecionar imagem' })).toHaveAttribute(
      'aria-describedby',
      'gm-banner-hint gm-banner-error',
    );
    expect(document.getElementById('gm-banner-error')).not.toBeNull();
  });
});
