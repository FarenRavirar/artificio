import { sql } from 'kysely';
import { db } from '../db/index.js';
import { MARKDOWN_URL_TAIL_SQL, URL_VALUE_CHANNELS } from '../utils/contactUrls.js';
import { logActivity } from './activityLogger.js';
import { notifyAdmins } from './adminNotifications.js';

/**
 * Spec 106 R12 / plan §12: varredura de acusação. A escrita já limpa a cauda de
 * Markdown (`canonicalizeHttpsUrl`); isto pega o que entrou por outro caminho
 * (SQL, importação antiga) e avisa o admin. Não corrige dado: escrita em
 * produção pede autorização.
 */
// `>` só aqui: a limpeza da escrita não o remove, mas ele nunca é caminho válido.
export const CONTACT_TAIL_RE = `${MARKDOWN_URL_TAIL_SQL}|>$`;
const DEDUPE_ACTION = 'contact.tail_detected';

/** Contatos de URL com cauda suspeita. `shortcut:` só `table_contacts`; contato de perfil não é varrido, ampliar se a medição achar cauda lá. */
export async function alertContactTails(): Promise<number> {
  const rows = await db
    .selectFrom('table_contacts')
    .select(['id', 'channel'])
    .where('channel', 'in', [...URL_VALUE_CHANNELS] as Array<'form' | 'facebook' | 'instagram'>)
    .where(sql<boolean>`value ~ ${CONTACT_TAIL_RE}`)
    .execute();
  if (rows.length === 0) return 0;

  // Dedupe de 24 h: o cron roda todo dia e a linha só some quando alguém corrige.
  const recent = await db
    .selectFrom('activity_log')
    .select('id')
    .where('action', '=', DEDUPE_ACTION)
    .where('created_at', '>', sql<Date>`now() - interval '24 hours'`)
    .executeTakeFirst();
  if (recent) return 0;

  await logActivity({
    actorId: null,
    action: DEDUPE_ACTION,
    entityType: 'table_contact',
    entityId: null,
    summary: `${rows.length} contato(s) com cauda de Markdown na URL.`,
    metadata: { contact_ids: rows.slice(0, 50).map((r) => r.id) },
  });
  await notifyAdmins({
    type: 'contact_tail',
    awaitDelivery: true,
    title: 'Contato com URL quebrada',
    message: `${rows.length} contato(s) de mesa terminam em caractere de Markdown (\`)\`, \`_\`, \`*\`) e o link não abre.`,
    action_url: '/gestao',
    metadata: { count: rows.length },
  });
  return rows.length;
}
