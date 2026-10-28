import { db } from '../db/index.js';
import { isGmSlugTaken, renameGmSlug } from '../services/gmSlug.js';
import { auditIdentityChange } from '../services/identityAudit.js';
import { slugifyGmName } from '../services/profileService.js';

/**
 * Correção de dado da spec 106 (T6.1 e T6.2): 4 mestres cujo `nickname` e `slug`
 * eram o prefixo do e-mail. Lista fechada por id; o slug novo sai do nome pela
 * mesma regra do perfil novo (`slugifyGmName`), e o antigo vira redirect 301.
 *
 * Uso (dentro do `mesas-api`): `node dist/scripts/fixGmIdentity.js` imprime o que
 * mudaria e não grava; `--apply --actor=<id do admin>` grava. Idempotente: alvo já
 * corrigido é pulado.
 */
const DOOR = 'scripts/fixGmIdentity';

interface Alvo {
  gmId: string;
  slugAtual: string;
  nickname: string;
}

const ALVOS: Alvo[] = [
  { gmId: 'fc9bc16c-c0f8-446c-a84c-0bc204c381f0', slugAtual: 'patorico027', nickname: 'VOID' },
  { gmId: '0baa5cd4-9ecc-4824-aa22-55106bbd7793', slugAtual: 'academiahardya', nickname: 'Albert' },
  { gmId: '8d7e62a6-12a8-4321-ae32-b09308e555cc', slugAtual: 'dadoviciadopodcast', nickname: 'Dado Viciado' },
  { gmId: 'a30cd21d-9999-4ec8-a290-a70d8669c09a', slugAtual: 'endyrpg13', nickname: 'Endy' },
];

const apply = process.argv.includes('--apply');
const actorArg = process.argv.find((a) => a.startsWith('--actor='))?.slice('--actor='.length);

/** O dry-run não grava, então não precisa de autor. O `--apply` exige um admin existente. */
async function resolveActor(): Promise<string> {
  if (!apply) return '';
  if (!actorArg) throw new Error('--apply exige --actor=<id do admin que autorizou>');
  const admin = await db
    .selectFrom('users')
    .select('id')
    .where('id', '=', actorArg)
    .where('role', '=', 'admin')
    .executeTakeFirst();
  if (!admin) throw new Error(`--actor=${actorArg} não é um admin`);
  return admin.id;
}

/** O dono pode ter trocado o nome pelo editor sem mexer no slug: só se sobrescreve o medido ou o já corrigido. */
const nicknameEditavel = (atual: string | null, alvo: Alvo): boolean => atual === alvo.slugAtual || atual === alvo.nickname;

/** Slug, redirect, nickname e auditoria numa transação só; a releitura com trava cobre edição concorrente do dono. */
async function gravar(alvo: Alvo, novoSlug: string, actorId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const atual = await trx
      .selectFrom('gm_profiles')
      .select(['slug', 'nickname', 'user_id'])
      .where('id', '=', alvo.gmId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!nicknameEditavel(atual.nickname, alvo)) {
      throw new Error(`nickname mudou para "${atual.nickname}" durante a execução`);
    }
    if (atual.slug !== novoSlug) {
      await renameGmSlug({ gmId: alvo.gmId, newSlug: novoSlug, actorId, door: DOOR }, trx);
    }
    if (atual.nickname === alvo.nickname) return;
    await trx.updateTable('gm_profiles').set({ nickname: alvo.nickname }).where('id', '=', alvo.gmId).execute();
    await auditIdentityChange(
      { actorId, targetUserId: atual.user_id, field: 'nickname', from: atual.nickname, to: alvo.nickname, door: DOOR, entityId: alvo.gmId },
      trx,
    );
  });
}

/** Devolve `false` quando o alvo não pode ser corrigido sem revisão humana. */
async function processar(alvo: Alvo, actorId: string): Promise<boolean> {
  const tag = `[fixGmIdentity] ${alvo.slugAtual}:`;
  const novoSlug = slugifyGmName(alvo.nickname);
  const gm = await db
    .selectFrom('gm_profiles')
    .select(['slug', 'nickname'])
    .where('id', '=', alvo.gmId)
    .executeTakeFirst();
  if (!gm) {
    console.error(`${tag} perfil ${alvo.gmId} não existe`);
    return false;
  }
  if (gm.slug === novoSlug && gm.nickname === alvo.nickname) {
    console.log(`${tag} já corrigido (${gm.slug}, "${gm.nickname}")`);
    return true;
  }
  // O dado mudou desde a medição: não adivinhar.
  if (gm.slug !== alvo.slugAtual && gm.slug !== novoSlug) {
    console.error(`${tag} slug atual é "${gm.slug}", não o medido`);
    return false;
  }
  if (!nicknameEditavel(gm.nickname, alvo)) {
    console.error(`${tag} nickname atual é "${gm.nickname}", escolhido pelo dono; revisar`);
    return false;
  }
  const taken = gm.slug !== novoSlug && (await isGmSlugTaken(novoSlug, db, alvo.gmId));
  console.log(`${tag} slug ${gm.slug} → ${novoSlug}${taken ? ' (OCUPADO)' : ''}; nickname "${gm.nickname}" → "${alvo.nickname}"`);
  if (taken) return false;
  if (!apply) return true;
  try {
    await gravar(alvo, novoSlug, actorId);
    console.log(`${tag} gravado`);
    return true;
  } catch (error: unknown) {
    console.error(`${tag} erro`, error);
    return false;
  }
}

try {
  const actorId = await resolveActor();
  // Perfis, slugs e redirects distintos: os alvos não competem por linha.
  const resultados = await Promise.all(ALVOS.map((alvo) => processar(alvo, actorId)));
  const ok = resultados.every(Boolean);
  console.log(`[fixGmIdentity] ${apply ? 'apply' : 'dry-run'} ${ok ? 'ok' : 'com falha'}`);
  await db.destroy();
  process.exit(ok ? 0 : 1);
} catch (error: unknown) {
  console.error('[fixGmIdentity] Erro:', error);
  process.exit(1);
}
