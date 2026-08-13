import { describe, expect, it, vi } from 'vitest';

import { CommentsClientError } from './transport.js';
import {
  createCommentsResource,
  createCommentsResourceKey,
  type CommentsResourceIdentity,
} from './resource.js';

const identity = (userId: string): CommentsResourceIdentity => ({
  realm: 'prod',
  sourceApp: 'downloads',
  subjectType: 'material',
  subjectId: 'material-1',
  visibility: 'private',
  userId,
});

describe('createCommentsResource', () => {
  it('representa a primeira falha como unavailable, nunca como lista vazia', async () => {
    const resource = createCommentsResource({
      identity: identity('user-a'),
      load: async () => { throw new CommentsClientError('http_error', 'falhou', { status: 500 }); },
    });

    await resource.load();

    expect(resource.getSnapshot()).toMatchObject({
      status: 'unavailable',
      data: undefined,
      error: { code: 'http_error' },
    });
  });

  it('conserva o último sucesso como stale, com idade, apenas na mesma instância', async () => {
    let now = 1_000;
    const load = vi.fn()
      .mockResolvedValueOnce(['c1'])
      .mockRejectedValueOnce(new CommentsClientError('http_error', 'falhou', { status: 500 }));
    const resource = createCommentsResource({ identity: identity('user-a'), load, now: () => now });

    await resource.load();
    expect(resource.getSnapshot()).toEqual({
      status: 'fresh',
      data: ['c1'],
      updatedAt: 1_000,
      ageMs: 0,
    });

    now = 1_350;
    await resource.load();
    expect(resource.getSnapshot()).toMatchObject({
      status: 'stale',
      data: ['c1'],
      updatedAt: 1_000,
      ageMs: 350,
      error: { code: 'http_error' },
    });
  });

  it('perde stale ao desmontar e remontar', async () => {
    const first = createCommentsResource({
      identity: identity('user-a'),
      load: vi.fn().mockResolvedValueOnce(['c1']).mockRejectedValueOnce(new Error('queda')),
    });
    await first.load();
    await first.load();
    expect(first.getSnapshot().status).toBe('stale');
    first.dispose();

    const remounted = createCommentsResource({
      identity: identity('user-a'),
      load: async () => { throw new Error('continua fora'); },
    });
    await remounted.load();

    expect(remounted.getSnapshot()).toMatchObject({ status: 'unavailable', data: undefined });
  });

  it('limpa memória no logout e não mostra dados de A para B', async () => {
    const resource = createCommentsResource({
      identity: identity('user-a'),
      load: vi.fn().mockResolvedValueOnce(['de-a']).mockRejectedValueOnce(new Error('queda')),
    });
    await resource.load();
    expect(resource.getSnapshot()).toMatchObject({ status: 'fresh', data: ['de-a'] });

    resource.logout();
    expect(resource.getSnapshot()).toMatchObject({ status: 'unavailable', data: undefined });

    resource.setIdentity(identity('user-b'));
    await resource.load();
    expect(resource.getSnapshot()).toMatchObject({ status: 'unavailable', data: undefined });
    expect(createCommentsResourceKey(identity('user-a'))).not.toBe(createCommentsResourceKey(identity('user-b')));
  });

  it('exige usuário numa chave privada', () => {
    expect(() => createCommentsResourceKey({
      realm: 'prod',
      sourceApp: 'site',
      subjectType: 'post',
      subjectId: 'post-1',
      visibility: 'private',
    })).toThrow('userId');
  });

  it('aborta consulta substituída e ignora a falha antiga depois do sucesso novo', async () => {
    let rejectFirst: ((reason: unknown) => void) | undefined;
    const signals: AbortSignal[] = [];
    const load = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length === 1) {
        return new Promise<string[]>((_, reject) => { rejectFirst = reject; });
      }
      return Promise.resolve(['mais-novo']);
    });
    const resource = createCommentsResource({ identity: identity('user-a'), load });

    const oldRequest = resource.load();
    const newRequest = resource.load();
    expect(signals[0]?.aborted).toBe(true);
    await newRequest;
    expect(resource.getSnapshot()).toMatchObject({ status: 'fresh', data: ['mais-novo'] });

    rejectFirst?.(new Error('falha atrasada'));
    await oldRequest;
    expect(resource.getSnapshot()).toMatchObject({ status: 'fresh', data: ['mais-novo'] });
  });

  it('aborta a busca ao desmontar e não publica resultado tardio', async () => {
    let resolveRequest: ((data: string[]) => void) | undefined;
    let receivedSignal: AbortSignal | undefined;
    const resource = createCommentsResource({
      identity: identity('user-a'),
      load: (signal) => {
        receivedSignal = signal;
        return new Promise<string[]>((resolve) => { resolveRequest = resolve; });
      },
    });

    const pending = resource.load();
    resource.dispose();
    expect(receivedSignal?.aborted).toBe(true);
    resolveRequest?.(['tardio']);
    await pending;

    expect(resource.getSnapshot()).toMatchObject({ status: 'unavailable', data: undefined });
  });
});
