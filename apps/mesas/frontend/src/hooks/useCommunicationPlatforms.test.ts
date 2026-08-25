// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeCommunicationPlatformsResponse,
  useCommunicationPlatforms,
} from './useCommunicationPlatforms';

/**
 * Normalização de GET /communication-platforms (spec 096, T5.2): payload
 * externo é `unknown` até passar pelo schema mínimo — mesmo padrão do
 * useVttPlatforms (B3, revisão adversarial Fase 4).
 */

const zoomPayload = {
  id: 'comm-zoom',
  name: 'Zoom',
  slug: 'zoom',
  website_url: null,
  sort_order: 5,
  implies_pc: false,
  implies_microphone: true,
  implies_camera: true,
};

const discordPayload = {
  id: 'comm-discord',
  name: 'Discord',
  slug: 'discord',
  website_url: 'https://discord.com',
  sort_order: 1,
  implies_pc: false,
  implies_microphone: true,
  implies_camera: false,
};

describe('normalizeCommunicationPlatformsResponse', () => {
  it('normaliza o envelope { data: [...] } preservando os flags de implicação', () => {
    const platforms = normalizeCommunicationPlatformsResponse({
      data: [zoomPayload, discordPayload],
    });

    expect(platforms).toHaveLength(2);
    expect(platforms[0]).toEqual({
      id: 'comm-zoom',
      name: 'Zoom',
      slug: 'zoom',
      website_url: null,
      sort_order: 5,
      implies_pc: false,
      implies_microphone: true,
      implies_camera: true,
    });
    expect(platforms[1].implies_microphone).toBe(true);
    expect(platforms[1].implies_camera).toBe(false);
  });

  it('aceita catálogo vazio', () => {
    expect(normalizeCommunicationPlatformsResponse({ data: [] })).toEqual([]);
  });

  it('lança TypeError quando o envelope não tem data em array', () => {
    const message = 'Resposta de plataformas de comunicação em formato inesperado.';
    expect(() => normalizeCommunicationPlatformsResponse({})).toThrowError(
      new TypeError(message),
    );
    expect(() => normalizeCommunicationPlatformsResponse(null)).toThrowError(TypeError);
    expect(() => normalizeCommunicationPlatformsResponse({ data: 'x' })).toThrowError(
      new TypeError(message),
    );
  });

  it('lança TypeError quando um item não casa o schema (flag ausente ou tipo errado)', () => {
    const message = 'Resposta de plataformas de comunicação em formato inesperado.';
    const missingFlag: Record<string, unknown> = { ...zoomPayload };
    delete missingFlag.implies_pc;
    expect(() => normalizeCommunicationPlatformsResponse({ data: [missingFlag] })).toThrowError(
      new TypeError(message),
    );

    expect(() =>
      normalizeCommunicationPlatformsResponse({ data: [{ ...zoomPayload, sort_order: '5' }] }),
    ).toThrowError(new TypeError(message));
  });
});

describe('useCommunicationPlatforms', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expõe as plataformas normalizadas, loading e erro no hook', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [zoomPayload] }),
      }),
    );

    const { result } = renderHook(() => useCommunicationPlatforms());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.platforms).toHaveLength(1);
      expect(result.current.platforms[0]).toMatchObject({
        id: 'comm-zoom',
        implies_microphone: true,
        implies_camera: true,
      });
    });
  });

  it('vira erro legível quando a resposta vem em formato inesperado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: true }),
      }),
    );

    const { result } = renderHook(() => useCommunicationPlatforms());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(
        'Resposta de plataformas de comunicação em formato inesperado.',
      );
    });
  });
});
