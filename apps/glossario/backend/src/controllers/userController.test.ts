import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../config/database.js', () => ({ db: { query } }));

import { listUsers, updateProfile } from './userController.js';

describe('userController sem papel global local', () => {
  beforeEach(() => query.mockReset());

  it('lista membros sem expor users.role local', async () => {
    query.mockResolvedValue({ rows: [] });
    const json = vi.fn();
    await listUsers({} as never, { json, status: vi.fn().mockReturnThis() } as never);

    expect(query.mock.calls[0][0]).not.toContain('role');
  });

  it('preserva papel e capacidade globais ao atualizar perfil', async () => {
    query.mockResolvedValue({ rows: [{ id: 'local-1', full_name: 'Nome', email: 'pessoa@example.com' }] });
    const json = vi.fn();
    const req = {
      body: { full_name: 'Nome' },
      user: { id: 'local-1', is_global_admin: false, is_global_moderator: true },
    } as never;

    await updateProfile(req, { json, status: vi.fn().mockReturnThis() } as never);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ role: 'member', is_global_moderator: true }));
  });

  it('responde 404 quando o perfil autenticado não existe', async () => {
    query.mockResolvedValue({ rows: [] });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await updateProfile({ body: { full_name: 'Nome' }, user: { id: 'missing' } } as never, { json, status } as never);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: 'Usuário não encontrado.' });
  });
});
