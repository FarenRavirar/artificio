import { describe, expect, it, vi, beforeEach } from 'vitest';
import { validateImageFile } from './useImageUpload';

vi.mock('../services/apiClient', () => ({ authPost: vi.fn() }));

function makeFile(bytes: number, type = 'image/png'): File {
  const file = new File(['x'], 'foto.png', { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateImageFile', () => {
  it('aceita JPG, PNG e WEBP dentro do limite', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateImageFile(makeFile(1024, type), 'profile_avatar')).toBeNull();
    }
  });

  it('recusa formato fora da lista', () => {
    const error = validateImageFile(makeFile(1024, 'image/gif'), 'profile_avatar');
    expect(error).toContain('Formato inválido');
  });

  it('recusa SVG, que carrega script', () => {
    expect(validateImageFile(makeFile(1024, 'image/svg+xml'), 'profile_avatar')).toContain('Formato inválido');
  });

  // O limite vem do contrato compartilhado. Antes cada tela tinha o seu (2 MB
  // no AvatarUploader, 5 MB inline) para o MESMO endpoint, então a mesma foto
  // era aceita ou recusada dependendo de onde a pessoa clicava.
  it('usa o limite do contrato, igual em qualquer tela', () => {
    const acima = makeFile(6 * 1024 * 1024);
    expect(validateImageFile(acima, 'profile_avatar')).toContain('Limite de 5 MB');
    expect(validateImageFile(acima, 'table_banner')).toContain('Limite de 5 MB');
  });

  it('informa o tamanho real do arquivo recusado', () => {
    const error = validateImageFile(makeFile(7 * 1024 * 1024), 'profile_avatar');
    expect(error).toContain('7.0 MB');
  });
});

describe('useImageUpload', () => {
  it('envia o tipo da imagem junto do arquivo', async () => {
    const { authPost } = await import('../services/apiClient');
    vi.mocked(authPost).mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/x/a.png', width: 800, height: 800 }),
    } as Response);

    const { useImageUpload } = await import('./useImageUpload');
    // O hook não depende de estado do React para o envio; chamamos a função
    // que ele monta, que é onde o contrato com o backend acontece.
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useImageUpload('profile_avatar'));

    const uploaded = await result.current.uploadFile(makeFile(1024));

    expect(uploaded).toEqual({ url: 'https://res.cloudinary.com/x/a.png', width: 800, height: 800 });

    // Regressão do defeito medido em produção: o backend recebia o tipo e o
    // descartava, cortando todo upload como banner de mesa 1200x650 — o avatar
    // do mestre foi gravado assim, com topo e base perdidos.
    const body = vi.mocked(authPost).mock.calls[0][1] as FormData;
    expect(body.get('purpose')).toBe('profile_avatar');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('propaga a mensagem de erro do servidor', async () => {
    const { authPost } = await import('../services/apiClient');
    vi.mocked(authPost).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Falha ao processar imagem' }),
    } as Response);

    const { useImageUpload } = await import('./useImageUpload');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useImageUpload('table_banner'));

    await expect(result.current.uploadFile(makeFile(1024))).rejects.toThrow('Falha ao processar imagem');
  });

  it('rejeita resposta sem URL, mesmo com status 200', async () => {
    const { authPost } = await import('../services/apiClient');
    vi.mocked(authPost).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    const { useImageUpload } = await import('./useImageUpload');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useImageUpload('table_banner'));

    await expect(result.current.uploadFile(makeFile(1024))).rejects.toThrow('Falha ao enviar imagem.');
  });
});

describe('useImageUpload — resposta não-JSON', () => {
  it('não vaza erro de parser quando o corpo não é JSON', async () => {
    const { authPost } = await import('../services/apiClient');
    vi.mocked(authPost).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    } as unknown as Response);

    const { useImageUpload } = await import('./useImageUpload');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useImageUpload('profile_avatar'));

    // A pessoa precisa ver algo acionável, não a mensagem do parser.
    await expect(result.current.uploadFile(makeFile(1024))).rejects.toThrow('Falha ao enviar imagem.');
  });
});

describe('useImageUpload — normalização da resposta', () => {
  async function upload(payload: unknown, ok = true) {
    const { authPost } = await import('../services/apiClient');
    vi.mocked(authPost).mockResolvedValue({ ok, json: async () => payload } as Response);
    const { useImageUpload } = await import('./useImageUpload');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useImageUpload('profile_avatar'));
    return result.current.uploadFile(makeFile(1024));
  }

  // `width`/`height` viram divisor em `cropToObjectPosition`. Valor zero,
  // negativo, fracionário ou NaN produziria `object-position` sem sentido —
  // pior que ausência, porque tem aparência de dado válido.
  it('aceita dimensão só como inteiro positivo seguro', async () => {
    for (const width of [0, -10, 12.5, Number.NaN, Number.POSITIVE_INFINITY, '800', null]) {
      const uploaded = await upload({ secure_url: 'https://res.cloudinary.com/x/a.png', width, height: 800 });
      expect(uploaded.width).toBeNull();
    }

    const valida = await upload({ secure_url: 'https://res.cloudinary.com/x/a.png', width: 800, height: 600 });
    expect(valida).toEqual({ url: 'https://res.cloudinary.com/x/a.png', width: 800, height: 600 });
  });

  it('recusa resposta com URL vazia, mesmo com status 200', async () => {
    await expect(upload({ secure_url: '   ' })).rejects.toThrow('Falha ao enviar imagem.');
  });

  it('dimensão ausente vira null em vez de quebrar', async () => {
    const uploaded = await upload({ secure_url: 'https://res.cloudinary.com/x/a.png' });
    expect(uploaded).toEqual({ url: 'https://res.cloudinary.com/x/a.png', width: null, height: null });
  });
});
