import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageEditor } from './ImageEditor.js';
import type { CropRect } from '@artificio/media/image-kinds';

afterEach(cleanup);

/**
 * jsdom não decodifica imagem: `naturalWidth`/`width` ficam em 0 e o `onLoad`
 * nunca dispara sozinho. Definimos as dimensões no elemento e disparamos o
 * evento à mão, que é o que o navegador faria — assim o teste exercita a
 * conversão de escala real do componente, não um mock dela.
 */
function loadImage(natural: [number, number], rendered: [number, number]) {
  const image = screen.getByAltText('Imagem sendo enquadrada') as HTMLImageElement;
  Object.defineProperty(image, 'naturalWidth', { value: natural[0], configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: natural[1], configurable: true });
  Object.defineProperty(image, 'width', { value: rendered[0], configurable: true });
  Object.defineProperty(image, 'height', { value: rendered[1], configurable: true });
  fireEvent.load(image);
  return image;
}

function renderEditor(overrides: Partial<Parameters<typeof ImageEditor>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ImageEditor
      imageSrc="blob:teste"
      kind="profile_avatar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ImageEditor', () => {
  it('abre como diálogo acessível', () => {
    renderEditor();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('avatar propõe recorte quadrado, independente da forma da imagem', () => {
    const { onConfirm } = renderEditor();
    // Imagem larga (800x400): o recorte 1:1 não pode virar 800x400.
    loadImage([800, 400], [400, 200]);
    fireEvent.click(screen.getByText('Aplicar'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [crop] = onConfirm.mock.calls[0] as [CropRect, number, number];
    expect(crop.width).toBe(crop.height);
  });

  it('banner de mesa mantém a proporção 1200x650', () => {
    const { onConfirm } = renderEditor({ kind: 'table_banner' });
    loadImage([1200, 1200], [600, 600]);
    fireEvent.click(screen.getByText('Aplicar'));

    const [crop] = onConfirm.mock.calls[0] as [CropRect, number, number];
    expect(crop.width / crop.height).toBeCloseTo(1200 / 650, 1);
  });

  // Regressão do defeito do editor antigo: ele devolvia coordenadas do
  // elemento renderizado, que muda de tamanho com a janela. O retângulo salvo
  // não correspondia à imagem e o enquadramento saía errado.
  it('devolve o recorte em pixels da imagem ORIGINAL, não do elemento na tela', () => {
    const { onConfirm } = renderEditor();
    // Renderizada com metade do tamanho natural: escala 2x.
    loadImage([1000, 1000], [500, 500]);
    fireEvent.click(screen.getByText('Aplicar'));

    const [crop, naturalWidth, naturalHeight] = onConfirm.mock.calls[0] as [CropRect, number, number];
    expect(naturalWidth).toBe(1000);
    expect(naturalHeight).toBe(1000);
    // O recorte centralizado cobre a imagem inteira (1:1 sobre 1:1).
    expect(crop.width).toBe(1000);
    expect(crop.height).toBe(1000);
  });

  it('reabre no enquadramento já salvo', () => {
    const initialCrop: CropRect = { x: 100, y: 200, width: 400, height: 400 };
    const { onConfirm } = renderEditor({ initialCrop });
    loadImage([1000, 1000], [500, 500]);
    fireEvent.click(screen.getByText('Aplicar'));

    const [crop] = onConfirm.mock.calls[0] as [CropRect, number, number];
    expect(crop).toEqual(initialCrop);
  });

  it('não confirma antes de a imagem carregar', () => {
    const { onConfirm } = renderEditor();
    const confirm = screen.getByText('Aplicar') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Cancelar e Esc fecham sem salvar', () => {
    const { onCancel, onConfirm } = renderEditor();
    loadImage([1000, 1000], [500, 500]);

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('o zoom escala a imagem, não o modal', () => {
    renderEditor();
    const image = loadImage([1000, 1000], [500, 500]);
    const panel = document.querySelector('.artificio-image-editor__panel') as HTMLElement;

    fireEvent.change(screen.getByLabelText('Nível de aproximação'), { target: { value: '2' } });

    expect(image.style.transform).toBe('scale(2)');
    expect(panel.style.transform).toBe('');
  });

  it('oferece voltar à imagem inteira só quando há aproximação', () => {
    renderEditor();
    loadImage([1000, 1000], [500, 500]);
    expect(screen.queryByText('Ver imagem inteira')).toBeNull();

    fireEvent.change(screen.getByLabelText('Nível de aproximação'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Ver imagem inteira'));

    const image = screen.getByAltText('Imagem sendo enquadrada') as HTMLImageElement;
    expect(image.style.transform).toBe('scale(1)');
  });

  it('mostra prévia do enquadramento antes de aplicar', () => {
    renderEditor();
    loadImage([1000, 1000], [500, 500]);
    const preview = screen.getByAltText('Prévia do enquadramento') as HTMLImageElement;
    expect(preview.style.objectPosition).toBeTruthy();
  });
});
