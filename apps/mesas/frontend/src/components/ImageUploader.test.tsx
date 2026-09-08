// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageUploader } from './ImageUploader';

/**
 * F6.4d (spec 100) — o campo não devolve ao mestre a URL crua da imagem que ele
 * mesmo subiu.
 *
 * A correção anterior (placeholder intuitivo) tratou metade do caso: placeholder
 * só aparece em campo VAZIO. Depois do upload o `value` é exibido, e o mestre
 * encarava `res.cloudinary.com/.../khmxivtocytsah6o0pap.jpg` como texto
 * editável — a queixa original ("o cara acha que aquilo é código vazado").
 *
 * Falha ao reverter: sem a guarda, o `TextInput` volta a existir com a URL.
 */
const URL_HOSPEDADA =
  'https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg';

function renderUploader(value: string) {
  return render(
    <ImageUploader
      label="Banner do perfil"
      value={value}
      onChange={vi.fn()}
      onError={vi.fn()}
      idPrefix="teste-banner"
      kind="profile_banner"
    />,
  );
}

describe('ImageUploader — URL de imagem hospedada (F6.4c/F6.4d)', () => {
  it('não expõe a URL do Cloudinary como texto editável', () => {
    const { container } = renderUploader(URL_HOSPEDADA);

    expect(container.querySelector('#teste-banner-url')).toBeNull();
    expect(screen.queryByDisplayValue(URL_HOSPEDADA)).toBeNull();
  });

  it('oferece caminho de volta para trocar por link', () => {
    const { container } = renderUploader(URL_HOSPEDADA);

    fireEvent.click(screen.getByRole('button', { name: 'Trocar por um link de imagem' }));

    const campo = container.querySelector('#teste-banner-url');
    expect(campo).toBeTruthy();
    expect((campo as HTMLInputElement).value).toBe(URL_HOSPEDADA);
  });

  it('mantém o campo de link visível em campo vazio', () => {
    const { container } = renderUploader('');

    expect(container.querySelector('#teste-banner-url')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Trocar por um link de imagem' }),
    ).toBeNull();
  });

  it('mantém visível o link externo que o próprio mestre digitou', () => {
    // Link mantido por "Manter link direto": ele reconhece a URL porque a
    // digitou, e escondê-la tiraria a única forma de conferi-la.
    const { container } = renderUploader('https://exemplo.com/banner.jpg');

    const campo = container.querySelector('#teste-banner-url') as HTMLInputElement;
    expect(campo).toBeTruthy();
    expect(campo.value).toBe('https://exemplo.com/banner.jpg');
  });
});
