import { describe, expect, it } from 'vitest';
import { validators } from './validation';

describe('validators.sessions', () => {
  it('aceita sessão com dia e início, sem horário de término', () => {
    expect(validators.sessions([{
      day_of_week: 'saturday',
      start_time: '19:00',
      end_time: '',
    }])).toBeNull();
  });
});
