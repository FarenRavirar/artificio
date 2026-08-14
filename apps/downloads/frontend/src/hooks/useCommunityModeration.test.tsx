import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityModerationActions, useCommunityModerationQueue } from './useCommunityModeration';

const validQueue = { items: [], new_account_comments: [] };

function Probe() {
  const queue = useCommunityModerationQueue();
  const actions = useCommunityModerationActions();
  return <div><output>{queue.isError ? 'erro' : queue.data ? `fila:${queue.data.items.length}` : 'carregando'}</output><button type="button" onClick={() => void actions.remove('comment-1', 'motivo')}>retirar</button></div>;
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
}

describe('useCommunityModeration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'idempotency-1' });
  });

  it('valida a fila com Zod na fronteira', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: 'não-array' }), { status: 200 })));
    renderProbe();
    expect(await screen.findByText('erro')).toBeInTheDocument();
  });

  it('invalida e recarrega a fila depois da mutação', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validQueue), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validQueue), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();
    await screen.findByText('fila:0');
    screen.getByRole('button', { name: 'retirar' }).click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ 'Idempotency-Key': 'idempotency-1' });
  });
});
