import { db } from '../db/index.js';
import type {
  PlayerProfile,
  PlayerProfileUpdate,
  GmProfile,
  GmProfileUpdate,
  UserSystem,
  UserUpdate,
} from '../db/types.js';
import { systemExistsInCatalog } from './systemCatalogProvider.js';

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
    languages: string[];
  } | null;
  player: PlayerProfile | null;
  gm: GmProfile | null;
  systems: {
    favorite: UserSystem[];
    gm: UserSystem[];
  };
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
    .select(['display_name', 'bio', 'avatar_url', 'languages'])
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
    profile: profile || null,
    player: player || null,
    gm: gm || null,
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
  data: { display_name?: string; bio?: string; avatar_url?: string; languages?: string[] }
) {
  const exists = await db
    .selectFrom('profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (exists) {
    await db
      .updateTable('profiles')
      .set({
        ...data,
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
        bio: data.bio || null,
        avatar_url: data.avatar_url || null,
        languages: data.languages || [],
      })
      .execute();
  }

  return db
    .selectFrom('profiles')
    .select(['display_name', 'bio', 'avatar_url', 'languages'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
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
        ...data,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .execute();
  } else {
    // Insert (precisa de slug)
    const user = await db
      .selectFrom('users')
      .select(['username', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    const slug = user?.username || user?.email.split('@')[0] || `user-${userId.slice(0, 8)}`;

    await db
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        ...data,
      })
      .execute();

    // Elevar role para 'gm'
    await db.updateTable('users').set({ role: 'gm' }).where('id', '=', userId).execute();
  }

  const result = await db
    .selectFrom('gm_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!result) {
    throw new Error('Erro ao atualizar perfil de mestre');
  }

  return result;
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
  const systemExists = await systemExistsInCatalog(systemId);

  if (!systemExists) {
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
    // Criar gm_profile se não existir
    const user = await db
      .selectFrom('users')
      .select(['username', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    const slug = user?.username || user?.email.split('@')[0] || `user-${userId.slice(0, 8)}`;

    await db
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        discord_connected: true,
        discord_username: discordData.username,
        discord_id: discordData.id,
      })
      .execute();

    // Elevar role para 'gm'
    await db.updateTable('users').set({ role: 'gm' }).where('id', '=', userId).execute();
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
