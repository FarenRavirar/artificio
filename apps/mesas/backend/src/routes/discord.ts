import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db/index';

const router = Router();

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
}

/**
 * Inicia fluxo OAuth Discord
 * Requer usuário logado via Google E perfil GM criado
 */
router.get('/discord/connect', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  // CORREÇÃO P02, P06, P20: Validar se usuário tem perfil GM antes de iniciar OAuth
  const gmProfile = await db
    .selectFrom('gm_profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();
  
  if (!gmProfile) {
    // CORREÇÃO P18: Bloquear no connect se não for GM
    return res.redirect('/perfil?discord=error&reason=no_gm_profile');
  }
  
  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID!);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('redirect_uri', process.env.DISCORD_REDIRECT_URI!);
  discordAuthUrl.searchParams.set('scope', 'identify guilds');
  discordAuthUrl.searchParams.set('state', userId); // Passa user_id via state
  
  res.redirect(discordAuthUrl.toString());
});

/**
 * Callback OAuth Discord
 * Troca code por access_token e salva dados
 */
router.get('/discord/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const userId = state as string;
  
  if (!code || !userId) {
    return res.redirect('/perfil?discord=error&reason=invalid_state'); // CORREÇÃO P03
  }
  
  try {
    // 1. Trocar code por access_token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });
    
    if (!tokenResponse.ok) {
      console.error('[Discord OAuth] Erro ao obter token:', await tokenResponse.text());
      throw new Error('Erro ao obter token Discord');
    }
    
    const tokenData = await tokenResponse.json() as DiscordTokenResponse;
    const accessToken = tokenData.access_token;
    
    // 2. Buscar dados do usuário Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!userResponse.ok) {
      console.error('[Discord OAuth] Erro ao buscar usuário:', await userResponse.text());
      throw new Error('Erro ao buscar dados do usuário Discord');
    }
    
    const discordUser = await userResponse.json() as DiscordUser;
    
    // 3. Buscar servidores do usuário
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!guildsResponse.ok) {
      console.error('[Discord OAuth] Erro ao buscar guilds:', await guildsResponse.text());
      throw new Error('Erro ao buscar servidores Discord');
    }
    
    const guildsRaw: unknown = await guildsResponse.json();
    const guilds: DiscordGuild[] = Array.isArray(guildsRaw) ? guildsRaw as DiscordGuild[] : [];

    // 4. Verificar se está no servidor Covil
    const isInCovil = guilds.some(
      (guild) => guild.id === process.env.DISCORD_GUILD_ID
    );
    
    console.log('[Discord OAuth] Usuário:', discordUser.username, 'Covil:', isInCovil);
    
    // 5. Atualizar dados Discord no perfil GM
    const updated = await db
      .updateTable('gm_profiles')
      .set({
        discord_connected: true,
        discord_username: discordUser.username, // CORREÇÃO P01: Discord removeu discriminators em 2023
        discord_id: discordUser.id,
        covil_verified: isInCovil,
      })
      .where('user_id', '=', userId)
      .executeTakeFirst();
    
    if (updated.numUpdatedRows === 0n) {
      console.error('[Discord OAuth] Perfil GM não encontrado para user_id:', userId);
      throw new Error('Perfil de mestre não encontrado');
    }
    
    // 6. Redirecionar de volta
    res.redirect('/perfil?discord=connected');
    
  } catch (error) {
    console.error('[Discord OAuth] Erro:', error);
    // CORREÇÃO P03: Diferenciar entre erro de rede e OAuth
    const message = error instanceof Error ? error.message : '';
    const reason = message.includes('fetch') ? 'network_error' : 'oauth_failed';
    res.redirect(`/perfil?discord=error&reason=${reason}`);
  }
});

/**
 * Desconectar Discord
 * Remove dados do Discord do perfil
 */
router.delete('/discord/disconnect', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  try {
    await db
      .updateTable('gm_profiles')
      .set({
        discord_connected: false,
        discord_username: null,
        discord_id: null,
        covil_verified: false,
      })
      .where('user_id', '=', userId)
      .execute();
    
    res.json({ success: true, message: 'Discord desconectado com sucesso' });
  } catch (error) {
    console.error('[Discord] Erro ao desconectar:', error);
    res.status(500).json({ error: 'Erro ao desconectar Discord' });
  }
});

/**
 * Re-verificar status Covil
 * Requer Discord já conectado
 */
router.post('/discord/verify-covil', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  try {
    // Buscar dados Discord do usuário
    const profile = await db
      .selectFrom('gm_profiles')
      .select(['discord_id', 'discord_connected'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    
    if (!profile || !profile.discord_connected || !profile.discord_id) {
      return res.status(400).json({ error: 'Discord não conectado' });
    }
    
    // Nota: Para re-verificar, precisaríamos de um access_token válido
    // Como não armazenamos o token, a re-verificação completa requer reconexão
    // Por enquanto, retornar mensagem informativa
    
    res.status(400).json({ 
      error: 'Para re-verificar, reconecte sua conta Discord',
      reconnect_required: true 
    });
    
  } catch (error) {
    console.error('[Discord] Erro ao verificar Covil:', error);
    res.status(500).json({ error: 'Erro ao verificar status Covil' });
  }
});

export default router;
