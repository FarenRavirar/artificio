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
 * mudaria e não grava; `--apply` grava. Idempotente: alvo já corrigido é pulado.
 */
const DOOR = 'scripts/fixGmIdentity';

const ALVOS = [
  { gmId: 'fc9bc16c-c0f8-446c-a84c-0bc204c381f0', slugAtual: 'patorico027', nickname: 'VOID' },
  { gmId: '0baa5cd4-9ecc-4824-aa22-55106bbd7793', slugAtual: 'academiahardya', nickname: 'Albert' },
  { gmId: '8d7e62a6-12a8-4321-ae32-b09308e555cc', slugAtual: 'dadoviciadopodcast', nickname: 'Dado Viciado' },
  { gmId: 'a30cd21d-9999-4ec8-a290-a70d8669c09a', slugAtual: 'endyrpg13', nickname: 'Endy' },
];

const apply = process.argv.includes('--apply');

async function main(): Promise<boolean> {
  const admins = await db.selectFrom('users').select('id').where('role', '=', 'admin').execute();
  // Mais de um admin: o autor da correção ficaria ambíguo na auditoria.
  if (admins.length !== 1) throw new Error(`esperado 1 admin, achei ${admins.length}`);
  const actorId = admins[0].id;

  let falhou = false;
  for (const alvo of ALVOS) {
    const novoSlug = slugifyGmName(alvo.nickname);
    const gm = await db
      .selectFrom('gm_profiles')
      .select(['id', 'slug', 'nickname', 'user_id'])
      .where('id', '=', alvo.gmId)
      .executeTakeFirst();
    if (!gm) {
      console.error(`[fixGmIdentity] ${alvo.slugAtual}: perfil ${alvo.gmId} não existe`);
      falhou = true;
      continue;
    }
    if (gm.slug === novoSlug && gm.nickname === alvo.nickname) {
      console.log(`[fixGmIdentity] ${alvo.slugAtual}: já corrigido (${gm.slug}, "${gm.nickname}")`);
      continue;
    }
    // O dado mudou desde a medição: não adivinhar.
    if (gm.slug !== alvo.slugAtual && gm.slug !== novoSlug) {
      console.error(`[fixGmIdentity] ${alvo.slugAtual}: slug atual é "${gm.slug}", não o medido`);
      falhou = true;
      continue;
    }
    const taken = gm.slug !== novoSlug && (await isGmSlugTaken(novoSlug, db, gm.id));
    console.log(
      `[fixGmIdentity] ${alvo.slugAtual}: slug ${gm.slug} → ${novoSlug}${taken ? ' (OCUPADO)' : ''}; ` +
        `nickname "${gm.nickname}" → "${alvo.nickname}"`,
    );
    if (taken) {
      falhou = true;
      continue;
    }
    if (!apply) continue;

    try {
      if (gm.slug !== novoSlug) await renameGmSlug({ gmId: gm.id, newSlug: novoSlug, actorId, door: DOOR });
      if (gm.nickname !== alvo.nickname) {
        await db.transaction().execute(async (trx) => {
          await trx.updateTable('gm_profiles').set({ nickname: alvo.nickname }).where('id', '=', gm.id).execute();
          await auditIdentityChange(
            { actorId, targetUserId: gm.user_id, field: 'nickname', from: gm.nickname, to: alvo.nickname, door: DOOR, entityId: gm.id },
            trx,
          );
        });
      }
      console.log(`[fixGmIdentity] ${alvo.slugAtual}: gravado`);
    } catch (error: unknown) {
      falhou = true;
      console.error(`[fixGmIdentity] ${alvo.slugAtual}: erro`, error);
    }
  }
  return !falhou;
}

try {
  const ok = await main();
  console.log(`[fixGmIdentity] ${apply ? 'apply' : 'dry-run'} ${ok ? 'ok' : 'com falha'}`);
  await db.destroy();
  process.exit(ok ? 0 : 1);
} catch (error: unknown) {
  console.error('[fixGmIdentity] Erro:', error);
  process.exit(1);
}
