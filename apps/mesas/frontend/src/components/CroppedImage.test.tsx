import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CroppedImage } from './CroppedImage';

afterEach(cleanup);

describe('CroppedImage', () => {
  it('aplica o enquadramento escolhido em vez do centro', () => {
    render(
      <CroppedImage
        src="https://res.cloudinary.com/demo/foto.png"
        alt="Avatar"
        kind="profile_avatar"
        crop={{ x: 0, y: 0, width: 400, height: 400 }}
        imageWidth={800}
        imageHeight={800}
      />,
    );
    const image = screen.getByAltText('Avatar');
    expect(image.style.objectPosition).toBe('0% 0%');
  });

  // Comportamento anterior preservado: sem recorte salvo, o centro continua
  // sendo o padrão — a mudança não altera o que já estava no ar.
  it('cai no centro quando não há enquadramento salvo', () => {
    render(
      <CroppedImage src="https://res.cloudinary.com/demo/foto.png" alt="Avatar" kind="profile_avatar" />,
    );
    expect(screen.getByAltText('Avatar').style.objectPosition).toBe('50% 50%');
  });

  it('avatar renderiza em 1:1, mesmo com imagem retangular', () => {
    const { container } = render(
      <CroppedImage src="https://res.cloudinary.com/demo/larga.png" alt="Avatar" kind="profile_avatar" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe('1 / 1');
    expect(wrapper.className).toContain('rounded-full');
  });

  it('banner de mesa mantém a proporção 1200x650', () => {
    const { container } = render(
      <CroppedImage src="https://res.cloudinary.com/demo/banner.png" alt="Banner" kind="table_banner" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    // Aqui o valor é um decimal simples, sem normalização em fração.
    // Fração canônica, não decimal: `1200/650` em ponto flutuante vira
    // `1.8461538461538463`, que o CSS trunca ou rejeita.
    expect(wrapper.style.aspectRatio).toBe('1200 / 650');
    expect(wrapper.className).not.toContain('rounded-full');
  });

  it('mostra o placeholder quando não há imagem nem fallback', () => {
    render(
      <CroppedImage
        src={null}
        alt="Avatar"
        kind="profile_avatar"
        placeholder={<span>M</span>}
      />,
    );
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.queryByAltText('Avatar')).toBeNull();
  });

  it('usa o fallback quando o src é inutilizável', () => {
    render(
      <CroppedImage
        src="data:image/png;base64,quebr ado"
        alt="Banner"
        kind="table_banner"
        fallbackSrc="/placeholder.webp"
      />,
    );
    expect((screen.getByAltText('Banner') as HTMLImageElement).getAttribute('src')).toBe('/placeholder.webp');
  });
});
