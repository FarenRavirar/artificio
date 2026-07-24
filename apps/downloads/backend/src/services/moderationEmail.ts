import { sendEmail, materialApprovedEmail, materialRejectedEmail } from '@artificio/email';
import { db } from '../db';
import { resolveUserEmail } from './accountsClient';
import type { DownloadEmailKind } from '../db/types';

const RETRY_DELAY_MS = 30_000;

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? process.env.PUBLIC_SITE_URL ?? 'https://downloads.artificiorpg.com';
}

interface RejectedInput {
  kind: 'material_rejected';
  userId: string;
  materialId: string;
  materialTitle: string;
  categoryLabel: string;
  legalBasis: string | null;
  reason: string;
}

interface ApprovedInput {
  kind: 'material_approved';
  userId: string;
  materialId: string;
  materialTitle: string;
  materialSlug: string;
}

type SendModerationEmailInput = RejectedInput | ApprovedInput;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildEmail(input: SendModerationEmailInput, authorName: string): Promise<{ subject: string; html: string }> {
  if (input.kind === 'material_rejected') {
    return materialRejectedEmail({
      authorName,
      materialTitle: input.materialTitle,
      categoryLabel: input.categoryLabel,
      legalBasis: input.legalBasis,
      reason: input.reason,
      editUrl: `${frontendUrl()}/painel/materiais/${input.materialId}/editar`,
    });
  }

  return materialApprovedEmail({
    authorName,
    materialTitle: input.materialTitle,
    publicUrl: `${frontendUrl()}/materiais/${input.materialSlug}`,
  });
}

async function attemptSend(
  kind: DownloadEmailKind,
  to: string,
  materialId: string,
  built: { subject: string; html: string },
): Promise<{ status: 'sent' | 'failed'; providerMessageId: string | null; errorDetail: string | null }> {
  try {
    const result = await sendEmail({ to, subject: built.subject, html: built.html, tags: { kind, materialId } });
    return { status: 'sent', providerMessageId: result.messageId, errorDetail: null };
  } catch (error: unknown) {
    return { status: 'failed', providerMessageId: null, errorDetail: error instanceof Error ? error.message : String(error) };
  }
}

// T5.2 (spec 083) — orquestra resolveUserEmail -> sendEmail -> grava log,
// com 1 retry (backoff 30s) em falha de envio. Nunca lanca: chamador
// (routes/moderation.ts) roda isto de forma best-effort, mesmo padrao ja
// usado para emitNotification — falha de e-mail nunca bloqueia a transicao
// de estado do material.
export async function sendModerationEmail(input: SendModerationEmailInput): Promise<void> {
  const resolved = await resolveUserEmail(input.userId);

  if (!resolved) {
    await db
      .insertInto('download_email_log')
      .values({
        user_id: input.userId,
        material_id: input.materialId,
        kind: input.kind,
        to_email: null,
        status: 'skipped_no_email',
        provider_message_id: null,
        error_detail: 'Não foi possível resolver e-mail do autor via accounts.',
        attempts: 1,
      })
      .execute();
    return;
  }

  const built = await buildEmail(input, resolved.displayName);
  const firstAttempt = await attemptSend(input.kind, resolved.email, input.materialId, built);

  if (firstAttempt.status === 'sent') {
    await db
      .insertInto('download_email_log')
      .values({
        user_id: input.userId,
        material_id: input.materialId,
        kind: input.kind,
        to_email: resolved.email,
        status: 'sent',
        provider_message_id: firstAttempt.providerMessageId,
        error_detail: null,
        attempts: 1,
      })
      .execute();
    return;
  }

  await sleep(RETRY_DELAY_MS);
  const retryAttempt = await attemptSend(input.kind, resolved.email, input.materialId, built);

  await db
    .insertInto('download_email_log')
    .values({
      user_id: input.userId,
      material_id: input.materialId,
      kind: input.kind,
      to_email: resolved.email,
      status: retryAttempt.status,
      provider_message_id: retryAttempt.providerMessageId,
      error_detail: retryAttempt.errorDetail,
      attempts: 2,
    })
    .execute();
}
