// T7.1 (spec 083) — sucesso, accounts fora do ar (skipped_no_email), Resend
// fora do ar com retry (1x, backoff), usuario sem e-mail resolvido.

const resolveUserEmailMock = vi.hoisted(() => vi.fn());
vi.mock('../services/accountsClient', () => ({
  resolveUserEmail: resolveUserEmailMock,
}));

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock('@artificio/email', () => ({
  sendEmail: sendEmailMock,
  materialRejectedEmail: vi.fn().mockReturnValue({ subject: 'assunto', html: '<p>corpo</p>' }),
  materialApprovedEmail: vi.fn().mockReturnValue({ subject: 'assunto', html: '<p>corpo</p>' }),
}));

const insertValuesMock = vi.hoisted(() => vi.fn());
const dbMocks = vi.hoisted(() => ({
  insertInto: vi.fn(),
}));
vi.mock('../db', () => ({
  db: { insertInto: dbMocks.insertInto },
}));

import { sendModerationEmail } from './moderationEmail';

beforeEach(() => {
  resolveUserEmailMock.mockReset();
  sendEmailMock.mockReset();
  dbMocks.insertInto.mockReset();
  insertValuesMock.mockReset();
  dbMocks.insertInto.mockReturnValue({ values: insertValuesMock.mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }) });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendModerationEmail', () => {
  it('grava skipped_no_email quando accounts. nao resolve usuario', async () => {
    resolveUserEmailMock.mockResolvedValue(null);

    await sendModerationEmail({
      kind: 'material_approved',
      userId: 'user-1',
      materialId: 'material-1',
      materialTitle: 'Aventura X',
      materialSlug: 'aventura-x',
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped_no_email', to_email: null }),
    );
  });

  it('grava sent na primeira tentativa bem-sucedida', async () => {
    resolveUserEmailMock.mockResolvedValue({ email: 'autor@example.com', displayName: 'Autor' });
    sendEmailMock.mockResolvedValue({ messageId: 'msg-1' });

    await sendModerationEmail({
      kind: 'material_approved',
      userId: 'user-1',
      materialId: 'material-1',
      materialTitle: 'Aventura X',
      materialSlug: 'aventura-x',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', provider_message_id: 'msg-1', attempts: 1 }),
    );
  });

  it('faz 1 retry apos falha e grava failed se persistir', async () => {
    resolveUserEmailMock.mockResolvedValue({ email: 'autor@example.com', displayName: 'Autor' });
    sendEmailMock.mockRejectedValue(new Error('Resend fora do ar'));

    const promise = sendModerationEmail({
      kind: 'material_rejected',
      userId: 'user-1',
      materialId: 'material-1',
      materialTitle: 'Aventura X',
      categoryLabel: 'Spam',
      legalBasis: null,
      reason: 'motivo',
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await promise;

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: 2, error_detail: 'Resend fora do ar' }),
    );
  });

  it('nao faz retry quando a primeira tentativa ja teve sucesso', async () => {
    resolveUserEmailMock.mockResolvedValue({ email: 'autor@example.com', displayName: 'Autor' });
    sendEmailMock.mockResolvedValueOnce({ messageId: 'msg-1' });

    await sendModerationEmail({
      kind: 'material_approved',
      userId: 'user-1',
      materialId: 'material-1',
      materialTitle: 'Aventura X',
      materialSlug: 'aventura-x',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
