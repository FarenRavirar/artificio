// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { ProfileProvider } from './ProfileContext';
import { useProfileContext } from './useProfileContext';
import type { ProfileContextValue } from './profileContextCore';

/**
 * Debounce + buffer do autosave do perfil de mestre (spec 099 B8).
 *
 * O comportamento testado vive em `ProfileContext.updateGm`: acumula o patch
 * por campo e dispara a mutation só após 500ms de pausa; mudança durante
 * request em voo fica no buffer e dispara mutation nova ao terminar (antes,
 * o guard `if (isPending) return;` descartava em silêncio).
 *
 * O módulo `../hooks/useProfileQuery` é mockado (padrão `vi.hoisted` +
 * `vi.mock` já usado nos testes do editor) — a mutation gm é uma função
 * controlada para os testes contarem chamadas e segurarem voo.
 */

const {
  mutateGmAsync,
  mutateUserAsync,
  mutateProfileAsync,
  mutatePlayerAsync,
  mutateAddSystemAsync,
  mutateRemoveSystemAsync,
} = vi.hoisted(() => ({
  mutateGmAsync: vi.fn(),
  mutateUserAsync: vi.fn(),
  mutateProfileAsync: vi.fn(),
  mutatePlayerAsync: vi.fn(),
  mutateAddSystemAsync: vi.fn(),
  mutateRemoveSystemAsync: vi.fn(),
}));

vi.mock('../hooks/useProfileQuery', () => ({
  useProfileQuery: () => ({
    data: {
      user: { id: 'u1', email: 'a@b.com', username: 'mago', location: null, role: 'gm', created_at: '2026-01-01' },
      profile: null,
      player: null,
      gm: null,
      systems: { favorite: [], gm: [] },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateUser: () => ({ isPending: false, mutateAsync: mutateUserAsync }),
  useUpdateProfile: () => ({ isPending: false, mutateAsync: mutateProfileAsync }),
  useUpdatePlayer: () => ({ isPending: false, mutateAsync: mutatePlayerAsync }),
  useUpdateGm: () => ({ isPending: false, mutateAsync: mutateGmAsync }),
  useAddSystem: () => ({ isPending: false, mutateAsync: mutateAddSystemAsync }),
  useRemoveSystem: () => ({ isPending: false, mutateAsync: mutateRemoveSystemAsync }),
}));

// Caixa mutável preenchida em effect: os rules react-hooks/globals e
// react-hooks/immutability reprovam mutar estado externo DURANTE o render
// (identificador ou propriedade); mutação em useEffect é o caminho sancionado.
const capturedBox: { value: ProfileContextValue | null } = { value: null };

function CaptureContext() {
  const value = useProfileContext();
  useEffect(() => {
    capturedBox.value = value;
  }, [value]);
  return null;
}

function renderProvider() {
  render(
    <ProfileProvider>
      <CaptureContext />
    </ProfileProvider>
  );
}

const updateGm = (patch: Parameters<ProfileContextValue['updateGm']>[0]) =>
  capturedBox.value?.updateGm(patch);

describe('ProfileContext.updateGm — autosave com debounce (spec 099 B8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateGmAsync.mockReset();
    mutateGmAsync.mockResolvedValue({});
    mutateUserAsync.mockReset();
    mutateUserAsync.mockResolvedValue({});
    mutateProfileAsync.mockReset();
    mutateProfileAsync.mockResolvedValue({});
    mutatePlayerAsync.mockReset();
    mutatePlayerAsync.mockResolvedValue({});
    mutateAddSystemAsync.mockReset();
    mutateAddSystemAsync.mockResolvedValue({});
    mutateRemoveSystemAsync.mockReset();
    mutateRemoveSystemAsync.mockResolvedValue(undefined);
    capturedBox.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('N mudanças em <500ms geram 1 chamada de mutation com o patch mesclado', async () => {
    renderProvider();

    await act(async () => {
      await updateGm({ bio_long: 'a' });
      await updateGm({ bio_long: 'ab' });
      await vi.advanceTimersByTimeAsync(300);
      await updateGm({ bio_long: 'abc', tagline: 'x' });
    });
    expect(mutateGmAsync).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(1);
    expect(mutateGmAsync).toHaveBeenCalledWith({ bio_long: 'abc', tagline: 'x' });
  });

  it('mudança durante mutation em voo dispara nova mutation ao terminar (nada descartado)', async () => {
    let resolveFirst!: (value: unknown) => void;
    const firstFlight = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mutateGmAsync.mockReturnValueOnce(firstFlight);

    renderProvider();

    await act(async () => {
      await updateGm({ bio_long: 'a' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(1);
    expect(mutateGmAsync).toHaveBeenCalledWith({ bio_long: 'a' });

    // Em voo: nova mudança entra no buffer (o guard antigo descartava aqui).
    await act(async () => {
      await updateGm({ tagline: 'x' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(1); // ainda em voo

    // O voo termina → o pump dispara a mutation nova com o que chegou depois.
    await act(async () => {
      resolveFirst({});
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(2);
    expect(mutateGmAsync).toHaveBeenLastCalledWith({ tagline: 'x' });
  });

  it('preserva null explícito — campo esvaziado grava null', async () => {
    renderProvider();

    await act(async () => {
      await updateGm({ tagline: null });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(1);
    expect(mutateGmAsync).toHaveBeenCalledWith({ tagline: null });
  });

  it('expõe saveError quando a mutation falha e limpa na gravação seguinte', async () => {
    mutateGmAsync.mockRejectedValueOnce(new Error('Biografia deve ter no máximo 2000 caracteres'));
    renderProvider();

    await act(async () => {
      await updateGm({ bio_long: 'x'.repeat(2001) });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(capturedBox.value?.saveError).toBe('Biografia deve ter no máximo 2000 caracteres');

    // Patch que falhou volta ao buffer: a próxima digitação o reenvia junto.
    await act(async () => {
      await updateGm({ tagline: 'ok' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mutateGmAsync).toHaveBeenCalledTimes(2);
    expect(mutateGmAsync).toHaveBeenLastCalledWith({
      bio_long: 'x'.repeat(2001),
      tagline: 'ok',
    });
    expect(capturedBox.value?.saveError).toBeNull();
  });
});
