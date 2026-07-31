import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../config/database.js', () => ({ db: { query } }));

import { getMe } from './authController.js';

describe('getMe', () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({
      rows: [{ id: 'local-1', full_name: 'Pessoa', email: 'pessoa@example.com', role: 'member' }],
    });
  });

  it('expõe a capacidade de moderator global para o frontend', async () => {
    const json = vi.fn();
    const req = { user: { id: 'local-1', is_global_moderator: true } } as never;
    const res = { json, status: vi.fn().mockReturnThis() } as never;

    await getMe(req, res);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ is_global_moderator: true }));
  });

  it('não usa admin local como fallback quando o accounts informa user', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'local-1', full_name: 'Pessoa', email: 'pessoa@example.com', role: 'admin' }],
    });
    const json = vi.fn();
    const req = { user: { id: 'local-1', is_global_admin: false, is_global_moderator: false } } as never;
    const res = { json, status: vi.fn().mockReturnThis() } as never;

    await getMe(req, res);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ role: 'member' }));
  });
});
