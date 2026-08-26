/**
 * T7.4b (spec 096) — backfill do histórico de `notifications` para o outbox.
 *
 * Lê as notificações que o mesas gravou na tabela própria e as enfileira em
 * `mesas_notification_outbox`, preservando o `created_at` original como
 * `occurred_at` — sem isso o sino do usuário reordenaria o histórico inteiro
 * pela hora do backfill.
 *
 * **Não escreve no `accounts.` diretamente**: enfileira, e a entrega normal
 * (sweep ou disparo) faz o POST. Assim o backfill herda de graça a idempotência
 * por `event_id`, o retry e o registro de erro — rodar duas vezes não duplica
 * aviso, porque o `event_id` é derivado do id da notificação (v5-like: o mesmo
 * id de origem sempre gera o mesmo `event_id`).
 *
 * Medido em 2026-08-25 (produção): 70 notificações, 62 não lidas —
 * 41 `suggestion_rejected`, 28 `suggestion_approved`, 1 `system`. Dessas, 69 têm
 * destinatário com id central resolvível; 1 cai no `google_id` legado de 21
 * dígitos e é PULADA com registro, não silenciosamente.
 *
 * **PRÉ-REQUISITO: a credencial de serviço do `mesas` precisa do escopo
 * `notification.migrate` — e precisa MANTÊ-LO até a fila drenar.**
 *
 * Os avisos já lidos viajam com `read_at` para nascerem lidos no `accounts.`, e
 * o ingest recusa esse campo com 403 (`forbidden_scope`) sem o escopo — trava
 * deliberada, porque criar aviso já lido é silenciar aviso (achado de review,
 * PR #289, CodeRabbit). Nenhuma credencial tem o escopo por padrão.
 *
 * **A janela que engana (achado de review, PR #289, CodeRabbit):** `--apply` só
 * ENFILEIRA. Quem entrega é o sweep, que roda a cada 5 min, ou o disparo
 * pós-commit de outra ação. Entre o script terminar e a fila drenar existe um
 * intervalo em que o escopo ainda é necessário; removê-lo ao ver o script
 * imprimir "enfileiradas" deixa exatamente os avisos já lidos presos com
 * `last_error: HTTP 403`. Nada se perde — o outbox retenta em backoff —, mas
 * nada chega até o escopo voltar.
 *
 * Procedimento, na ordem:
 *   1. conceder `notification.migrate` à credencial do `mesas`;
 *   2. `--apply`;
 *   3. `--status` até dizer que a fila drenou (o sweep leva até ~5 min);
 *   4. só então remover o escopo.
 *
 * **Onde roda:** dentro do container do `mesas-api`, pelos scripts do
 * `package.json` — que é o único caminho que existe em produção (achado de
 * review, PR #289, Codex P1). O arquivo vive em `src/scripts/` de propósito: é o
 * padrão dos outros scripts operacionais do app (`og:worker`, `discord:sync`,
 * `metrics:cleanup`), e é o que garante as duas coisas que faltavam quando ele
 * estava em `scripts/` na raiz —
 *
 *   1. o `tsconfig.json` só inclui `src/**`, então o arquivo NÃO era checado por
 *      tipo por nada: nem `tsc -p`, nem `tsc -b`, nem o build (mesmo defeito de
 *      falso-verde registrado em `errors.md` E022);
 *   2. o `Dockerfile` copia apenas `apps/mesas/backend/dist` e a instalação
 *      `--prod` não traz `tsx` nem `ts-node`, então `tsx scripts/...` era um
 *      comando que não existia no container — e sem ele o histórico legado
 *      ficaria fora do `accounts.` para sempre, já que esta fase removeu as
 *      rotas antigas do `mesas`.
 *
 * Uso (dry-run é o default — nada é gravado sem `--apply`):
 *   docker exec mesas-api pnpm run notifications:backfill
 *   docker exec mesas-api pnpm run notifications:backfill -- --apply
 *   docker exec mesas-api pnpm run notifications:backfill -- --status
 *
 * Localmente, com `ts-node` disponível:
 *   pnpm run notifications:backfill:dev
 */
import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
// Achado real (review PR #289, CodeRabbit, nitpick): o script mantinha cópias
// locais da regex de id central e da validação de path. Regra duplicada
// diverge — e aqui ela decide o que é migrado.
import { CENTRAL_USER_ID_RE, isValidCanonicalPath } from '../services/notificationOutbox.js';

/** `notifications.type` → `event_type` do registro central. */
const EVENT_TYPE: Record<string, string> = {
  suggestion_approved: 'mesas.suggestion.approved',
  suggestion_rejected: 'mesas.suggestion.rejected',
  system: 'mesas.system.notice',
};


/**
 * `event_id` DERIVADO do id da notificação, nunca aleatório.
 *
 * É o que torna o backfill re-executável: o UNIQUE `event_id` do accounts
 * (`migration_006:471`) transforma a segunda execução em no-op, em vez de
 * duplicar 70 avisos no sino de quem já os recebeu.
 */
function deterministicEventId(notificationId: string): string {
  const hash = createHash('sha256').update(`mesas:notification:${notificationId}`).digest('hex');
  // Formata como UUID v4-shaped: o ingest valida `z.string().uuid()`.
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    ((Number.parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Uma linha de `notifications` com o `google_id` do destinatário já resolvido. */
type LinhaLegada = {
  id: string;
  user_id: string;
  type: unknown;
  title: string;
  message: string;
  action_url: unknown;
  metadata: unknown;
  read: boolean;
  created_at: Date;
  google_id: string | null;
};

/** Linha aprovada para migração, com o que a decisão já resolveu. */
type Migravel = {
  eventType: string;
  centralId: string;
  canonicalPath: string;
  /** Preenchido só para aviso já lido — faz o recibo nascer lido. */
  readAt: Date | null;
};

/**
 * Decide se uma linha legada vira evento no outbox.
 *
 * Extraída de `main` (Sonar: complexidade cognitiva 16 > 15). As três exclusões
 * respondem à mesma pergunta — "esta linha é migrável?" —, então lê melhor junto
 * do que intercalado com o laço de escrita.
 */
function avaliarLinha(row: LinhaLegada): Migravel | { motivo: string } {
  const eventType = EVENT_TYPE[row.type as string];
  if (!eventType) {
    return { motivo: `type desconhecido: ${String(row.type)}` };
  }

  const centralId = row.google_id;
  if (typeof centralId !== 'string' || !CENTRAL_USER_ID_RE.test(centralId)) {
    return { motivo: `destinatário ${row.user_id} sem id central em UUID` };
  }

  // `action_url` é a origem do `canonical_path`. Nulo ou degenerado cai no
  // painel — o aviso continua chegando, só sem destino específico.
  const rawPath = typeof row.action_url === 'string' ? row.action_url : '';
  return {
    eventType,
    centralId,
    canonicalPath: isValidCanonicalPath(rawPath) ? rawPath : '/gestao',
    // Aviso JÁ LIDO migra igual, com o estado preservado (achado de review,
    // PR #289, Codex P2 — duas rodadas).
    //
    // A rodada anterior EXCLUÍA o lido, para não reapresentar como pendente algo
    // que o usuário já tinha despachado. Mas esta fase removeu
    // `/api/v1/notifications` do `mesas` e o `NotificationBell` passou a ler só
    // do consolidado: excluir deixava os 4 lidos (medido em 2026-08-26, contra
    // 66 não lidos) sem NENHUM caminho de leitura. Trocava um defeito por uma
    // perda de histórico.
    //
    // `read_at` no ingest (migration_012 do `accounts`) resolve os dois: o
    // recibo nasce lido, aparece no histórico e não conta no `/unread-count`.
    //
    // `created_at` como aproximação de quando foi lido: a tabela do `mesas` só
    // tem `read` booleano, sem timestamp. É a data do FATO, não da leitura —
    // e ordena o histórico pelo mesmo critério dos não lidos, que é o que o
    // usuário espera ver.
    readAt: row.read === true ? row.created_at : null,
  };
}

/**
 * Relata o dreno das entradas do backfill, para que a remoção do escopo
 * `notification.migrate` seja uma decisão MEDIDA e não um palpite de tempo
 * (achado de review, PR #289, CodeRabbit).
 *
 * Olha só o que este script escreveu (`subject_type = 'legacy_notification'`),
 * então tráfego normal do outbox não polui a contagem.
 */
async function relatarStatus(): Promise<void> {
  const linhas = await db
    .selectFrom('mesas_notification_outbox')
    .select(['id', 'delivered_at', 'attempt_count', 'last_error', 'read_at'])
    .where('subject_type', '=', 'legacy_notification')
    .execute();

  if (linhas.length === 0) {
    console.log('[status] nenhuma entrada de backfill no outbox — rode --apply primeiro.');
    return;
  }

  const entregues = linhas.filter((l) => l.delivered_at !== null);
  const pendentes = linhas.filter((l) => l.delivered_at === null);
  const lidas = linhas.filter((l) => l.read_at !== null);
  // 403 é o sintoma exato do escopo ausente ou removido cedo demais.
  const bloqueadas = pendentes.filter((l) => l.last_error?.includes('403'));

  console.log(`[status] entradas do backfill: ${linhas.length} (${lidas.length} com read_at)`);
  console.log(`[status] entregues: ${entregues.length}`);
  console.log(`[status] pendentes: ${pendentes.length}`);

  if (bloqueadas.length > 0) {
    console.log(`[status] ${bloqueadas.length} recusadas com 403 — a credencial do mesas está SEM \`notification.migrate\`.`);
    console.log('[status] conceda o escopo; o sweep reentrega sozinho no próximo ciclo.');
    return;
  }

  if (pendentes.length > 0) {
    console.log('[status] AINDA NÃO remova o escopo: o sweep roda a cada ~5 min.');
    for (const l of pendentes) {
      console.log(`  - ${l.id}: tentativas=${l.attempt_count} último erro=${l.last_error ?? '(nenhum)'}`);
    }
    return;
  }

  console.log('[status] fila drenada. Pode remover `notification.migrate` da credencial do mesas.');
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  // `--status` não lê `notifications` nem grava nada: só confere o dreno.
  if (process.argv.includes('--status')) {
    await relatarStatus();
    return;
  }

  const rows = await db
    .selectFrom('notifications as n')
    .innerJoin('users as u', 'u.id', 'n.user_id')
    .select([
      'n.id', 'n.user_id', 'n.type', 'n.title', 'n.message',
      'n.action_url', 'n.metadata', 'n.read', 'n.created_at',
      'u.google_id',
    ])
    .orderBy('n.created_at', 'asc')
    .execute();

  let enfileirados = 0;
  // Contado à parte para o dry-run mostrar quantos avisos migram JÁ LIDOS — é o
  // número que prova que o estado de leitura foi preservado, e não que 4 avisos
  // antigos vão reaparecer como pendentes no sino de alguém.
  let jaLidos = 0;
  const pulados: Array<{ id: string; motivo: string }> = [];

  for (const row of rows) {
    const decisao = avaliarLinha(row as LinhaLegada);
    if ('motivo' in decisao) {
      pulados.push({ id: row.id, motivo: decisao.motivo });
      continue;
    }
    const { eventType, centralId, canonicalPath, readAt } = decisao;
    if (readAt) jaLidos++;

    if (!apply) {
      enfileirados++;
      continue;
    }

    await db
      .insertInto('mesas_notification_outbox')
      .values({
        event_id: deterministicEventId(row.id),
        event_type: eventType,
        event_version: 1,
        subject_type: 'legacy_notification',
        subject_id: row.id,
        canonical_path: canonicalPath,
        snapshot: JSON.stringify({
          // `metadata` é JSONB de origem — dado externo, `unknown` até checado.
          // Vem PRIMEIRO de propósito (achado de review, PR #289): com ele por
          // último, uma linha antiga com `metadata.legacy_body` sobrescreveria o
          // texto real do aviso, e `metadata.title`/`legacy_type` mentiriam
          // sobre a origem. Campo reservado do snapshot não se deixa redefinir
          // por payload legado.
          ...asRecord(row.metadata),
          // Campo que o formatador do `accounts.` lê para evento externo
          // (`notificationFormatter.ts:76`). Sem ele, o aviso migrado apareceria
          // como "Notificação: mesas.suggestion.approved" — achado de review
          // (PR #289, Codex, P1).
          legacy_body: row.message,
          legacy_type: row.type,
          title: row.title,
          backfilled: true,
        }),
        recipients: JSON.stringify([centralId]),
        // Hora do FATO, não do backfill.
        created_at: row.created_at,
        read_at: readAt,
      })
      .onConflict((oc) => oc.column('event_id').doNothing())
      .execute();
    enfileirados++;
  }

  console.log(`[backfill] lidas: ${rows.length}`);
  console.log(`[backfill] ${apply ? 'enfileiradas' : 'seriam enfileiradas'}: ${enfileirados}`);
  console.log(`[backfill] destas, já lidas (recibo nasce lido): ${jaLidos}`);
  console.log(`[backfill] puladas: ${pulados.length}`);
  for (const p of pulados) console.log(`  - ${p.id}: ${p.motivo}`);
  if (!apply) {
    console.log('[backfill] DRY-RUN — nada foi gravado. Rode com --apply para valer.');
    return;
  }

  if (jaLidos > 0) {
    console.log('');
    console.log(`[backfill] ${jaLidos} entrada(s) viajam com \`read_at\` e exigem \`notification.migrate\` NA ENTREGA.`);
    console.log('[backfill] A entrega é do sweep (~5 min), não deste script: NÃO remova o escopo agora.');
    console.log('[backfill] Confirme com: tsx scripts/backfillNotificationOutbox.ts --status');
  }
}

// Achado real (review PR #289, inline): o `db.destroy()` ficava no fim de
// `main()`, então uma rejeição no meio deixava o pool aberto e o processo
// pendurado — justo no caminho de erro, em que o operador precisa ver a falha e
// o script sair. O `finally` fecha em qualquer desfecho, e exatamente uma vez.
//
// Top-level await em vez de cadeia de promise (Sonar): o módulo é ESM
// (`"type": "module"`), e o `try/catch/finally` deixa a ordem — falhou, registra,
// fecha o pool — legível de cima para baixo.
try {
  await main();
} catch (error: unknown) {
  console.error('[backfill] falhou:', error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
