import type { CropRect } from '@artificio/media/image-kinds';
import type { Kysely, Transaction } from 'kysely';
import { toJsonbParam } from '../db/jsonb.js';
import { db } from '../db/index.js';
import { auditIdentityChange } from './identityAudit.js';
import type {
  Database,
  PlayerProfile,
  PlayerProfileUpdate,
  GmProfile,
  GmProfileUpdate,
  UserSystem,
  UserUpdate,
} from '../db/types.js';
import { getSystemCatalogProvider } from './systemCatalogProvider.js';
import {
  sanitizeNullableUserMarkdown,
  sanitizeOptionalUserMarkdown,
} from '../utils/userMarkdown.js';

/**
 * Serviço de perfil de usuário
 * Gerencia perfis de jogador, mestre, sistemas favoritos e conexão Discord
 */

// =============================================================================
// GET FULL PROFILE
// =============================================================================

export interface FullProfile {
  user: {
    id: string;
    email: string;
    username: string | null;
    location: string | null;
    role: string;
    created_at: Date;
  };
  profile: {
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_crop_data: CropRect | null;
    avatar_width: number | null;
    avatar_height: number | null;
    languages: string[];
  } | null;
  player: PlayerProfile | null;
  gm: GmProfile | null;
  systems: {
    favorite: UserSystem[];
    gm: UserSystem[];
  };
}

/**
 * Nome público de um `gm_profile` novo (spec 106 R1, D4). Substitui a ordem da
 * spec 099 E1 (`patch → username → local do e-mail → slug`): o prefixo do e-mail
 * ia parar no card, na URL e no sitemap, sem caminho de troca (caso `patorico027`,
 * mestre `VOID`). Medido: `profiles.display_name` — o nome que a pessoa digitou no
 * onboarding — nunca era lido. A garantia da 099 fica: nunca nulo, sempre 2-40.
 *
 * Ordem: patch → `profiles.display_name` → `users.username` → `user-<8 hex do id>`.
 * O e-mail não entra em degrau nenhum.
 */
export function deriveGmNickname(
  names: { displayName?: string | null; username?: string | null },
  userId: string,
  patch?: Record<string, unknown>,
): string {
  const doPatch = typeof patch?.nickname === 'string' ? patch.nickname.trim() : '';
  if (doPatch.length >= 2) return doPatch.slice(0, 40);

  for (const candidato of [names.displayName, names.username]) {
    const nome = candidato?.trim() ?? '';
    // 'Usuário' é o display_name que `updateProfile` grava quando cria a linha sem
    // nome (ex.: só a foto do Google): placeholder, não nome escolhido.
    if (nome.length >= 2 && nome.toLowerCase() !== 'usuário') return nome.slice(0, 40);
  }
  return `user-${userId.slice(0, 8)}`;
}

/** Teto do slug-base: sobra espaço para o sufixo `-N` dentro dos 40 do nickname. */
const SLUG_BASE_MAX = 36;

/** `Clézio RPG` → `clezio-rpg`. Vazio quando o nome não tem letra nem número. */
export function slugifyGmName(value: string): string {
  // split/filter/join em vez de `.replace(/^-+|-+$/g, '')`: essa alternância
  // retrocede em tempo super-linear (Sonar, PR #341) e o nome vem do usuário.
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
    .slice(0, SLUG_BASE_MAX);
  return slug.endsWith('-') ? slug.slice(0, -1) : slug; // join só deixa um '-' por vez
}

/**
 * Identidade de um `gm_profile` que ainda nao existe, para as tres portas que o
 * criam: `POST /gm/profile`, o upsert do painel (`updateGmProfile`) e o vinculo do
 * Discord. O `slug` nasce do nome (`slugifyGmName(nickname)`), com sufixo numerico
 * em colisao; o front nao deriva mais nada (spec 106 R2).
 *
 * Extraido por achado de duplicacao do Sonar (PR #302): duas copias da regra de
 * identidade divergem; foi assim que 7 perfis de producao nasceram fora do
 * contrato. O `user-<8 hex>` e o unico valor que nunca e vazio.
 *
 * `executor`: quem chama de DENTRO de uma transacao passa o `trx`. Consultar pelo
 * `db` global ali pedia uma SEGUNDA conexao enquanto a da transacao ficava presa;
 * com o pool de 10 (`db/index.ts`), 10 criacoes simultaneas travavam tudo (achado
 * de review, PR #342).
 */
export async function prepareNewGmProfileIdentity(
  userId: string,
  patch?: Record<string, unknown>,
  executor: Kysely<Database> | Transaction<Database> = db,
): Promise<{ slug: string; nickname: string }> {
  const user = await executor
    .selectFrom('users')
    .select(['username'])
    .where('id', '=', userId)
    .executeTakeFirst();
  const profile = await executor
    .selectFrom('profiles')
    .select(['display_name'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const nickname = deriveGmNickname(
    { displayName: profile?.display_name, username: user?.username },
    userId,
    patch,
  );
  const base = slugifyGmName(nickname) || `user-${userId.slice(0, 8)}`;

  // Uma consulta traz `base` e `base-N`; o primeiro N livre sai em memória, sem
  // `await` em laço. `-` e alfanuméricos não são curingas do LIKE.
  // Slug antigo (`gm_slug_redirects`) tambem esta ocupado: um perfil novo nao pode
  // herdar o 301 de outro mestre (spec 106 R3).
  const [perfis, antigos] = await Promise.all([
    executor
      .selectFrom('gm_profiles')
      .select('slug')
      .where((eb) => eb.or([eb('slug', '=', base), eb('slug', 'like', `${base}-%`)]))
      .execute(),
    executor
      .selectFrom('gm_slug_redirects')
      .select('old_slug')
      .where((eb) => eb.or([eb('old_slug', '=', base), eb('old_slug', 'like', `${base}-%`)]))
      .execute(),
  ]);
  const ocupados = new Set([...perfis.map((row) => row.slug), ...antigos.map((row) => row.old_slug)]);
  let n = 1;
  let slug = base;
  while (ocupados.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return { slug, nickname };
}

/**
 * Criar perfil de mestre eleva o papel do usuario. Estava escrito identico nos
 * dois caminhos de criacao; um `role` novo ou uma regra de elevacao diferente
 * teria de ser lembrada em dois lugares.
 */
async function promoteUserToGm(userId: string): Promise<void> {
  await db.updateTable('users').set({ role: 'gm' }).where('id', '=', userId).execute();
}

export async function getFullProfile(userId: string): Promise<FullProfile> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'username', 'location', 'role', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const profile = await db
    .selectFrom('profiles')
    .select(['display_name', 'bio', 'avatar_url', 'avatar_crop_data', 'avatar_width', 'avatar_height', 'languages'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const player = await db
    .selectFrom('player_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const gm = await db
    .selectFrom('gm_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const allSystems = await db
    .selectFrom('user_systems')
    .selectAll()
    .where('user_id', '=', userId)
    .execute();

  const systems = {
    favorite: allSystems.filter((s) => s.type === 'favorite'),
    gm: allSystems.filter((s) => s.type === 'gm'),
  };

  return {
    user,
    profile: profile ? { ...profile, bio: sanitizeNullableUserMarkdown(profile.bio) } : null,
    player: player || null,
    gm: gm
      ? {
          ...gm,
          bio_long: sanitizeNullableUserMarkdown(gm.bio_long),
          closed_group_description: sanitizeNullableUserMarkdown(gm.closed_group_description),
        }
      : null,
    systems,
  };
}

// =============================================================================
// GET USER BY ID (com refresh_token)
// =============================================================================

export async function getUserById(userId: string) {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'username', 'role', 'refresh_token'])
    .where('id', '=', userId)
    .executeTakeFirst();
}

// =============================================================================
// UPDATE USER (dados gerais)
// =============================================================================

export async function updateUser(userId: string, data: UserUpdate, door = 'profileService.updateUser') {
  // Valor anterior lido sob `FOR UPDATE`, gravacao e auditoria na MESMA transacao:
  // duas edicoes simultaneas gravavam a mesma trilha "antes → depois" nas duas
  // chamadas e a primeira mudanca sumia (achado de review, PR #342).
  await db.transaction().execute(async (trx) => {
    const antes =
      data.username === undefined
        ? undefined
        : await trx.selectFrom('users').select('username').where('id', '=', userId).forUpdate().executeTakeFirst();
    await trx
      .updateTable('users')
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();

    if (antes) {
      await auditIdentityChange(
        { actorId: userId, field: 'username', from: antes.username ?? null, to: data.username ?? null, door },
        trx,
      );
    }
  });

  return db
    .selectFrom('users')
    .select(['id', 'email', 'username', 'location', 'role', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirst();
}

// =============================================================================
// CHECK USERNAME EXISTS
// =============================================================================

export async function checkUsernameExists(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = db.selectFrom('users').select('id').where('username', '=', username);

  if (excludeUserId) {
    query = query.where('id', '!=', excludeUserId);
  }

  const result = await query.executeTakeFirst();
  return !!result;
}

// =============================================================================
// UPDATE PROFILE (display_name, bio, avatar)
// =============================================================================

export async function updateProfile(
  userId: string,
  data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    avatar_crop_data?: CropRect | null;
    avatar_width?: number | null;
    avatar_height?: number | null;
    languages?: string[];
  },
  door = 'profileService.updateProfile',
) {
  const sanitizedBio = sanitizeOptionalUserMarkdown(data.bio);
  // `avatar_crop_data` é JSONB: sai do spread para ser serializado (ver
  // `db/jsonb.ts`). Sem isto o driver `pg` mandava `[object Object]` e o
  // recorte nunca chegava a gravar — medido em beta: 0 de 18 perfis com crop.
  const { avatar_crop_data: rawCrop, ...restData } = data;
  const cropParam = toJsonbParam(rawCrop);

  // Leitura do nome anterior sob `FOR UPDATE`, escrita e auditoria numa transacao
  // so, e a auditoria usa o valor que ESTA chamada gravou (achado de review, PR
  // #342: sob concorrencia, reler a linha registrava o valor da outra requisicao).
  await db.transaction().execute(async (trx) => {
    const exists = await trx
      .selectFrom('profiles')
      .select(['id', 'display_name'])
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();

    if (exists) {
      await trx
        .updateTable('profiles')
        .set({
          ...restData,
          avatar_crop_data: cropParam,
          bio: sanitizedBio,
          updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();
    } else {
      await trx
        .insertInto('profiles')
        .values({
          user_id: userId,
          display_name: data.display_name || 'Usuário',
          bio: sanitizedBio || null,
          avatar_url: data.avatar_url || null,
          avatar_crop_data: cropParam ?? null,
          avatar_width: data.avatar_width ?? null,
          avatar_height: data.avatar_height ?? null,
          languages: data.languages || [],
        })
        .execute();
    }

    if (data.display_name !== undefined) {
      await auditIdentityChange(
        {
          actorId: userId,
          field: 'display_name',
          from: exists?.display_name ?? null,
          to: exists ? data.display_name : data.display_name || 'Usuário',
          door,
        },
        trx,
      );
    }
  });

  const result = await db
    .selectFrom('profiles')
    .select(['display_name', 'bio', 'avatar_url', 'avatar_crop_data', 'avatar_width', 'avatar_height', 'languages'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return result ? { ...result, bio: sanitizeNullableUserMarkdown(result.bio) } : result;
}

// =============================================================================
// UPDATE PLAYER PROFILE
// =============================================================================

export async function updatePlayerProfile(
  userId: string,
  data: PlayerProfileUpdate
): Promise<PlayerProfile> {
  await db
    .insertInto('player_profiles')
    .values({
      user_id: userId,
      ...data,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({
        ...data,
        updated_at: new Date(),
      })
    )
    .execute();

  const result = await db
    .selectFrom('player_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!result) {
    throw new Error('Erro ao atualizar perfil de jogador');
  }

  return result;
}

// =============================================================================
// UPDATE GM PROFILE
// =============================================================================

export async function updateGmProfile(
  userId: string,
  data: GmProfileUpdate,
  door = 'profileService.updateGmProfile',
): Promise<GmProfile> {
  const sanitizedData: GmProfileUpdate = {
    ...data,
    bio_long: sanitizeOptionalUserMarkdown(data.bio_long),
    closed_group_description: sanitizeOptionalUserMarkdown(data.closed_group_description),
  };
  // Mesma regra de `updateProfile`: leitura sob `FOR UPDATE`, escrita e auditoria
  // do `nickname` na mesma transacao, com o valor que esta chamada gravou.
  const criou = await db.transaction().execute(async (trx) => {
    const exists = await trx
      .selectFrom('gm_profiles')
      .select(['id', 'nickname'])
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();

    if (exists) {
      await trx
        .updateTable('gm_profiles')
        .set({
          ...sanitizedData,
          updated_at: new Date(),
        })
        .where('user_id', '=', userId)
        .execute();

      // So quando o patch trouxe `nickname` (o PATCH reenvia o campo a cada salvamento).
      if (data.nickname !== undefined) {
        await auditIdentityChange(
          { actorId: userId, field: 'nickname', from: exists.nickname ?? null, to: data.nickname ?? null, door, entityId: exists.id },
          trx,
        );
      }
      return false;
    }

    // Insert (precisa de slug)
    const { slug, nickname } = await prepareNewGmProfileIdentity(userId, sanitizedData, trx);

    // `nickname` DEPOIS do spread (achado de review, PR #301). Na primeira
    // correcao a chave derivada vinha antes de `...sanitizedData`, e o patch
    // sobrescrevia o valor calculado — o PATCH manda `nickname` explicitamente
    // (`profile.ts:183`), entao um `null`, uma string de 1 caractere ou uma de
    // 60 voltava a gravar registro fora do contrato de 2-40, que e exatamente o
    // que E1 existe para impedir. `prepareNewGmProfileIdentity` ja recebeu o
    // patch e decidiu: usa o valor do mestre quando ele serve, cai no fallback
    // quando nao serve. Vindo por ultimo, e a decisao dela que prevalece.
    const criado = await trx
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        ...sanitizedData,
        nickname,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Perfil novo: `from` nulo, o nome nasceu aqui.
    await auditIdentityChange(
      { actorId: userId, field: 'nickname', from: null, to: nickname, door, entityId: criado.id },
      trx,
    );
    return true;
  });

  if (criou) await promoteUserToGm(userId);

  const result = await db
    .selectFrom('gm_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!result) {
    throw new Error('Erro ao atualizar perfil de mestre');
  }

  return {
    ...result,
    bio_long: sanitizeNullableUserMarkdown(result.bio_long),
    closed_group_description: sanitizeNullableUserMarkdown(result.closed_group_description),
  };
}

// =============================================================================
// USER SYSTEMS (adicionar/remover)
// =============================================================================

export async function addUserSystem(
  userId: string,
  systemId: string,
  type: 'favorite' | 'gm'
): Promise<UserSystem> {
  // Achado Codex (PR #145): picker de perfil carrega sistemas de
  // /api/v1/systems (catalogo central, spec 062), mas esta checagem batia na
  // tabela local `systems` — nó criado só no catálogo central sempre falhava
  // aqui ("Sistema não encontrado"), impedindo salvar favorito/sistema-que-mestra.
  //
  // Achado Codex (PR #292): NÃO usar `systemExistsInCatalog` aqui. Ele converte
  // exceção em `false` (systemCatalogProvider.ts:114) e `loadCatalogTree`
  // devolve `[]` quando o catálogo central cai sem cache quente
  // (catalogClient.ts:153) — as duas coisas fazem indisponibilidade transitória
  // ficar indistinguível de "sistema não existe". Como o handler passou a
  // traduzir essa negativa em 404, um sistema válido viraria "não encontrado"
  // durante uma queda do catálogo. Chamar o provider direto deixa a exceção
  // subir e virar 500, que é o status honesto para falha de dependência.
  const catalog = await getSystemCatalogProvider().loadFlat();

  // Catálogo vazio é sintoma de falha, não de catálogo sem sistemas: o central
  // devolve `[]` no fallback de erro sem cache. Tratar como negativa daria 404.
  if (catalog.length === 0) {
    throw new Error('Catálogo de sistemas indisponível');
  }

  if (!catalog.some((node) => node.id === systemId)) {
    throw new Error('Sistema não encontrado');
  }

  await db
    .insertInto('user_systems')
    .values({
      user_id: userId,
      system_id: systemId,
      type,
    })
    .onConflict((oc) => oc.columns(['user_id', 'system_id', 'type']).doNothing())
    .execute();

  const result = await db
    .selectFrom('user_systems')
    .selectAll()
    .where('user_id', '=', userId)
    .where('system_id', '=', systemId)
    .where('type', '=', type)
    .executeTakeFirst();

  if (!result) {
    throw new Error('Erro ao adicionar sistema');
  }

  return result;
}

export async function removeUserSystem(id: string, userId: string): Promise<void> {
  await db
    .deleteFrom('user_systems')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .execute();
}

export async function removeUserSystemByParams(
  userId: string,
  systemId: string,
  type: 'favorite' | 'gm'
): Promise<void> {
  await db
    .deleteFrom('user_systems')
    .where('user_id', '=', userId)
    .where('system_id', '=', systemId)
    .where('type', '=', type)
    .execute();
}

// =============================================================================
// ADMIN: TOGGLE COVIL VERIFIED
// =============================================================================

export async function toggleCovilVerified(
  userId: string,
  verified: boolean,
  adminId: string
): Promise<void> {
  await db
    .updateTable('gm_profiles')
    .set({
      covil_verified: verified,
      covil_verified_at: verified ? new Date() : null,
      covil_verified_by: verified ? adminId : null,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();
}
