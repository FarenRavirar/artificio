vi.mock('../db/index.js', () => ({ db: {} }));
vi.mock('./activityLogger.js', () => ({ logActivity: vi.fn() }));
vi.mock('./adminNotifications.js', () => ({ notifyAdmins: vi.fn() }));

import { CONTACT_TAIL_RE } from './contactTailSweep.js';

// A mesma regex vai para o Postgres (`~`); aqui só se confere a sintaxe e o alvo.
describe('CONTACT_TAIL_RE', () => {
  const re = new RegExp(CONTACT_TAIL_RE);
  it.each(['https://forms.gle/x)__', 'https://forms.gle/x**', 'https://forms.gle/x]', 'https://forms.gle/x>', 'https://forms.gle/x~~', 'https://forms.gle/x``'])('acusa %s', (v) => {
    expect(re.test(v)).toBe(true);
  });
  it.each(['https://forms.gle/mVvUiUTq7Z5yJTWT9', 'https://instagram.com/perfil', 'https://instagram.com/mestre_'])('não acusa %s', (v) => {
    expect(re.test(v)).toBe(false);
  });
});
