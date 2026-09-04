import type { CropRect } from '@artificio/media/image-kinds';
import { toJsonbParam } from '../db/jsonb.js';
import { db } from '../db/index.js';
import type {
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
 * Nickname de um `gm_profiles` recem-criado.
 *
 * Relato do mantenedor (2026-09-01, mestre `dadoviciadopodcast`): o perfil
 * nascia com `nickname` NULL por estes dois inserts, que derivavam so o `slug`.
 * O `POST /api/v1/gm/profile` (`gmPanel.ts:250`) EXIGE nickname de 2-40
 * caracteres — dois caminhos de criacao da mesma tabela com contratos
 * diferentes. Medido em producao no dia do relato: 7 de 49 perfis sem
 * nickname, e o mestre travado sem publicar mesa nem salvar o proprio nome.
 *
 * A ordem espelha `deriveGmNickname` do front
 * (`useProfileQuery.ts:349`), que ja resolvia o mesmo problema no upsert do
 * cliente: patch → username → local do e-mail → slug (que nunca e vazio). O
 * corte em 40 e o piso de 2 vem do contrato do backend; manter as duas regras
 * iguais e o que impede o perfil criado por um caminho de ser invalido pelo
 * outro.
 */
export function deriveGmNickname(
  user: { username: string | null; email: string } | undefined,
  slug: string,
  patch?: Record<string, unknown>,
): string {
  const doPatch = typeof patch?.nickname === 'string' ? patch.nickname.trim() : '';
  if (doPatch.length >= 2) return doPatch.slice(0, 40);

  const bruto = (user?.username || user?.email?.split('@')[0] || '').trim();
  const candidato = bruto.length >= 2 ? bruto : slug;
  return candidato.slice(0, 40);
}

/**
 * Identidade de um `gm_profile` que ainda nao existe, para os dois caminhos que
 * o criam: o upsert do painel (`updateGmProfile`) e o vinculo do Discord.
 *
 * Extraido por achado de duplicacao do Sonar (PR #302), mas o motivo nao e a
 * metrica: os dois blocos ja repetiam a busca do usuario, a derivacao do `slug`
 * e a elevacao de role, e E1 acabou de mostrar o custo disso — o `nickname`
 * precisou ser corrigido nos dois lugares, e a segunda rodada de review achou a
 * ordem errada em um deles. Duas copias da regra de identidade divergem; foi
 * assim que 7 perfis de producao nasceram fora do contrato.
 *
 * O `slug` mantem o fallback `user-<prefixo do id>` porque e o unico valor que
 * nunca e vazio — `deriveGmNickname` depende dele como ultimo degrau.
 */
export async function prepareNewGmProfileIdentity(
  userId: string,
  patch?: Record<string, unknown>,
): Promise<{ slug: string; nickname: string }> {
  const user = await db
    .selectFrom('users')
    .select(['username', 'email'])
    .where('id', '=', userId)
    .executeTakeFirst();

  const slug = user?.username || user?.email.split('@')[0] || `user-${userId.slice(0, 8)}`;

  return { slug, nickname: deriveGmNickname(user, slug, patch) };
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

export async function updateUser(userId: string, data: UserUpdate) {
  await db
    .updateTable('users')
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where('id', '=', userId)
    .execute();

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
  }
) {
  const sanitizedBio = sanitizeOptionalUserMarkdown(data.bio);
  // `avatar_crop_data` é JSONB: sai do spread para ser serializado (ver
  // `db/jsonb.ts`). Sem isto o driver `pg` mandava `[object Object]` e o
  // recorte nunca chegava a gravar — medido em beta: 0 de 18 perfis com crop.
  const { avatar_crop_data: rawCrop, ...restData } = data;
  const cropParam = toJsonbParam(rawCrop);
  const exists = await db
    .selectFrom('profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (exists) {
    await db
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
    await db
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

export async function updateGmProfile(userId: string, data: GmProfileUpdate): Promise<GmProfile> {
  const sanitizedData: GmProfileUpdate = {
    ...data,
    bio_long: sanitizeOptionalUserMarkdown(data.bio_long),
    closed_group_description: sanitizeOptionalUserMarkdown(data.closed_group_description),
  };
  // Verificar se já existe
  const exists = await db
    .selectFrom('gm_profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (exists) {
    // Update
    await db
      .updateTable('gm_profiles')
      .set({
        ...sanitizedData,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .execute();
  } else {
    // Insert (precisa de slug)
    const { slug, nickname } = await prepareNewGmProfileIdentity(userId, sanitizedData);

    // `nickname` DEPOIS do spread (achado de review, PR #301). Na primeira
    // correcao a chave derivada vinha antes de `...sanitizedData`, e o patch
    // sobrescrevia o valor calculado — o PATCH manda `nickname` explicitamente
    // (`profile.ts:183`), entao um `null`, uma string de 1 caractere ou uma de
    // 60 voltava a gravar registro fora do contrato de 2-40, que e exatamente o
    // que E1 existe para impedir. `prepareNewGmProfileIdentity` ja recebeu o
    // patch e decidiu: usa o valor do mestre quando ele serve, cai no fallback
    // quando nao serve. Vindo por ultimo, e a decisao dela que prevalece.
    await db
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        ...sanitizedData,
        nickname,
      })
      .execute();

    await promoteUserToGm(userId);
  }

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
// DISCORD
// =============================================================================

export interface DiscordStatus {
  connected: boolean;
  username: string | null;
  verified: boolean;
}

export async function getDiscordStatus(userId: string): Promise<DiscordStatus> {
  const gm = await db
    .selectFrom('gm_profiles')
    .select(['discord_connected', 'discord_username', 'covil_verified'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return {
    connected: gm?.discord_connected || false,
    username: gm?.discord_username || null,
    verified: gm?.covil_verified || false,
  };
}

export async function connectDiscord(
  userId: string,
  discordData: { username: string; id: string }
): Promise<DiscordStatus> {
  // Criar ou atualizar gm_profile
  const exists = await db
    .selectFrom('gm_profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (exists) {
    await db
      .updateTable('gm_profiles')
      .set({
        discord_connected: true,
        discord_username: discordData.username,
        discord_id: discordData.id,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .execute();
  } else {
    // Criar gm_profile se não existir. Sem patch: este caminho nao recebe campos
    // do painel, entao a identidade sai inteira do usuario.
    const { slug, nickname } = await prepareNewGmProfileIdentity(userId);

    await db
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        nickname,
        discord_connected: true,
        discord_username: discordData.username,
        discord_id: discordData.id,
      })
      .execute();

    await promoteUserToGm(userId);
  }

  // Registrar em auth_providers
  await db
    .insertInto('auth_providers')
    .values({
      user_id: userId,
      provider: 'discord',
      provider_user_id: discordData.id,
      provider_data: { username: discordData.username },
    })
    .onConflict((oc) => oc.columns(['provider', 'provider_user_id']).doNothing())
    .execute();

  return getDiscordStatus(userId);
}

export async function disconnectDiscord(userId: string): Promise<void> {
  await db
    .updateTable('gm_profiles')
    .set({
      discord_connected: false,
      discord_username: null,
      discord_id: null,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();

  // Remover de auth_providers
  await db
    .deleteFrom('auth_providers')
    .where('user_id', '=', userId)
    .where('provider', '=', 'discord')
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
