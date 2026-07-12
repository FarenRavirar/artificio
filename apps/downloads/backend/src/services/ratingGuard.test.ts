import { describe, it, expect } from 'vitest';
import { assertCanRate, RatingNotAllowedError } from './ratingGuard';

describe('ratingGuard', () => {
  it('permite avaliar quando o checker confirma download previo', async () => {
    await expect(assertCanRate('user-1', 'material-1', async () => true)).resolves.toBeUndefined();
  });

  it('bloqueia avaliar quando o checker nao confirma download previo', async () => {
    await expect(assertCanRate('user-1', 'material-1', async () => false)).rejects.toThrow(RatingNotAllowedError);
  });
});
