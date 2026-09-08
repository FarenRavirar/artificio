// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const URL_HOSPEDADA = vi.hoisted(
  () =>
    'https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg',
);

// Precisa carregar a PASTA do Artifício: é ela, não o host, que distingue
// upload nosso de Cloudinary de terceiro (`isArtificioHostedImage`).
const URL_IMPORTADA = vi.hoisted(
  () =>
    'https://res.cloudinary.com/dnln0btbo/image/upload/v1/artificio_profile_banners/importada.jpg',
);

// Os dois caminhos que produzem uma URL hospedada batem na API; aqui o alvo é o
// que a tela mostra DEPOIS que a URL chega ao campo (achado de review, PR #310).
const uploadFile = vi.fn(async () => ({ url: URL_HOSPEDADA, width: 1200, height: 650 }));
vi.mock('../hooks/useImageUpload', () => ({
  useImageUpload: () => ({ isUploading: false, uploadFile, validateFile: () => null }),
}));

vi.mock('../services/apiClient', () => ({
  authPost: vi.fn(async () => ({
    ok: true,
    json: async () => ({ secure_url: URL_IMPORTADA }),
  })),
}));

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


function renderUploader(value: string, onChange = vi.fn()) {
  const props = {
    label: 'Banner do perfil',
    value,
    onChange,
    onError: vi.fn(),
    idPrefix: 'teste-banner',
    kind: 'profile_banner' as const,
  };
  const utils = render(<ImageUploader {...props} />);
  // O componente é controlado: `onChange` sobe a URL, e quem a devolve como
  // `value` é o pai. O rerender simula esse ciclo.
  const aplicar = (url: string) => utils.rerender(<ImageUploader {...props} value={url} />);
  return { ...utils, aplicar };
}

describe('ImageUploader — URL de imagem hospedada (F6.4c/F6.4d)', () => {
  it('não expõe a URL do Cloudinary como texto editável', () => {
    const { container } = renderUploader(URL_HOSPEDADA);

    expect(container.querySelector('#teste-banner-url')).toBeNull();
    expect(screen.queryByDisplayValue(URL_HOSPEDADA)).toBeNull();
  });

  it('oferece caminho de volta para trocar por link, e leva o foco junto', () => {
    const { container } = renderUploader(URL_HOSPEDADA);

    fireEvent.click(screen.getByRole('button', { name: 'Trocar por um link de imagem' }));

    const campo = container.querySelector('#teste-banner-url');
    expect(campo).toBeTruthy();
    expect((campo as HTMLInputElement).value).toBe(URL_HOSPEDADA);
    // O botão DESMONTA ao ser clicado: sem mover o foco, ele cai no `<body>` e
    // quem navega por teclado recomeça do topo da página, na ação que acabou de
    // pedir (achado de review, PR #310).
    expect(document.activeElement).toBe(campo);
  });

  it('mantém o campo de link visível em campo vazio', () => {
    const { container } = renderUploader('');

    expect(container.querySelector('#teste-banner-url')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Trocar por um link de imagem' }),
    ).toBeNull();
  });

  it('mantém visível o Cloudinary DE TERCEIRO mantido como link direto', () => {
    // `isCloudinaryUrl` (que governa a importação) diz `true` para qualquer
    // `*.cloudinary.com`, e usá-lo aqui escondia o link de terceiro como se
    // fosse upload nosso. A exibição olha a PASTA, que só o nosso backend
    // escreve (achado de review, PR #310).
    const externa = 'https://res.cloudinary.com/outra-conta/image/upload/v1/foto.jpg';
    const { container } = renderUploader(externa);

    const campo = container.querySelector('#teste-banner-url') as HTMLInputElement;
    expect(campo).toBeTruthy();
    expect(campo.value).toBe(externa);
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

describe('ImageUploader — troca com o campo de link aberto (PR #310)', () => {
  it('fecha o campo depois de subir arquivo, em vez de repor a URL crua', async () => {
    const onChange = vi.fn();
    // Começa COM imagem hospedada e o campo reaberto pelo mestre: é o estado em
    // que `mostrarCampoDeLink` está `true`, e sem ele o teste não exerceria
    // nada — passaria mesmo com a correção revertida.
    const { container, aplicar } = renderUploader(URL_HOSPEDADA, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar por um link de imagem' }));
    expect(container.querySelector('#teste-banner-url')).toBeTruthy();

    const input = container.querySelector('#teste-banner-file') as HTMLInputElement;
    const arquivo = new File(['x'], 'banner.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [arquivo] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(URL_HOSPEDADA));
    aplicar(URL_HOSPEDADA);

    await waitFor(() => expect(container.querySelector('#teste-banner-url')).toBeNull());
  });

  it('fecha o campo depois de o link colado ser importado para a hospedagem', async () => {
    const onChange = vi.fn();
    // Parte de imagem hospedada e campo reaberto: é o estado que a correção
    // precisa desfazer quando a nova URL chega já hospedada.
    const { container, aplicar } = renderUploader(URL_HOSPEDADA, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar por um link de imagem' }));

    const campo = container.querySelector('#teste-banner-url') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'https://exemplo.com/externa.jpg' } });
    aplicar('https://exemplo.com/externa.jpg');
    fireEvent.blur(container.querySelector('#teste-banner-url') as HTMLInputElement);

    // O blur importa para a hospedagem do Artifício e devolve a URL nova. Sem o
    // fecho, o mestre voltaria a encarar a URL crua — o defeito de F6.4c
    // reaberto pela porta ao lado.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(URL_IMPORTADA));
    aplicar(URL_IMPORTADA);

    await waitFor(() => expect(container.querySelector('#teste-banner-url')).toBeNull());
    expect(
      screen.getByRole('button', { name: 'Trocar por um link de imagem' }),
    ).toBeTruthy();
  });
});
