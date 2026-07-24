import { Resend } from 'resend';

let client: Resend | null = null;

function getClient(apiKey: string): Resend {
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  tags?: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string;
}

// Client fino sobre o Resend SDK — nao decide template, so envia. Chamador
// (services/moderationEmail.ts em downloads) decide retry/log; esta funcao
// so lanca em caso de erro do provider (chamador captura).
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurado.');
  }
  if (!from) {
    throw new Error('EMAIL_FROM_ADDRESS não configurado.');
  }

  const resend = getClient(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    tags: input.tags
      ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
      : undefined,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail via Resend: ${error.message}`);
  }
  if (!data) {
    throw new Error('Resend não retornou id de mensagem.');
  }

  return { messageId: data.id };
}
