import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimit';
import * as profileService from '../services/profileService';

const router = Router();

/**
 * Rotas de perfil de usuário
 * Todas as rotas requerem autenticação
 */

// =============================================================================
// GET /api/v1/profile/me — Perfil completo do usuário logado
// =============================================================================

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const profile = await profileService.getFullProfile(userId);
    return res.json({ data: profile });
  } catch (error: any) {
    console.error('[GET /profile/me]', error);
    return res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// =============================================================================
// PATCH /api/v1/profile/me — Atualizar dados gerais (username, location)
// =============================================================================

router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { username, location } = req.body;

  try {
    // Validar username se fornecido
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Username deve ter no mínimo 3 caracteres' });
      }

      // Validar formato (apenas letras, números e underscore)
      if (!/^[a-z0-9_]+$/i.test(username)) {
        return res
          .status(400)
          .json({ error: 'Username deve conter apenas letras, números e underscore' });
      }

      // Verificar unicidade
      const existing = await profileService.checkUsernameExists(username, userId);
      if (existing) {
        return res.status(400).json({ error: 'Username já está em uso' });
      }
    }

    const user = await profileService.updateUser(userId, { username, location });
    return res.json({ data: user });
  } catch (error: any) {
    console.error('[PATCH /profile/me]', error);
    return res.status(500).json({ error: 'Erro ao atualizar dados' });
  }
});

// =============================================================================
// PATCH /api/v1/profile/me/profile — Atualizar perfil básico
// =============================================================================

router.patch('/me/profile', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { display_name, bio, avatar_url, languages } = req.body;

  try {
    const profile = await profileService.updateProfile(userId, {
      display_name,
      bio,
      avatar_url,
      languages,
    });
    return res.json({ data: profile });
  } catch (error: any) {
    console.error('[PATCH /profile/me/profile]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// =============================================================================
// PATCH /api/v1/profile/me/player — Atualizar perfil de jogador
// =============================================================================

router.patch('/me/player', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { experience_level, playstyle, preferred_days, preferred_time, pricing_preference } =
    req.body;

  try {
    const player = await profileService.updatePlayerProfile(userId, {
      experience_level,
      playstyle,
      preferred_days,
      preferred_time,
      pricing_preference,
    });
    return res.json({ data: player });
  } catch (error: any) {
    console.error('[PATCH /profile/me/player]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil de jogador' });
  }
});

// Alias para compatibilidade com frontend
router.patch('/player', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { experience_level, playstyle, preferred_days, preferred_time, pricing_preference } =
    req.body;

  try {
    const player = await profileService.updatePlayerProfile(userId, {
      experience_level,
      playstyle,
      preferred_days,
      preferred_time,
      pricing_preference,
    });
    return res.json({ data: player });
  } catch (error: any) {
    console.error('[PATCH /profile/player]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil de jogador' });
  }
});

// =============================================================================
// PATCH /api/v1/profile/me/gm — Atualizar perfil de mestre
// =============================================================================

router.patch('/me/gm', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const {
    nickname,
    bio_long,
    avatar_url,
    banner_url,
    languages,
    specialties,
    experience_years,
    average_price,
    gm_style,
    tools,
    game_format,
  } = req.body;

  try {
    const gm = await profileService.updateGmProfile(userId, {
      nickname,
      bio_long,
      avatar_url,
      banner_url,
      languages,
      specialties,
      experience_years,
      average_price,
      gm_style,
      tools,
      game_format,
    });
    return res.json({ data: gm });
  } catch (error: any) {
    console.error('[PATCH /profile/me/gm]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil de mestre' });
  }
});

// Alias para compatibilidade com frontend
router.patch('/gm', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const {
    nickname,
    bio_long,
    avatar_url,
    banner_url,
    languages,
    specialties,
    experience_years,
    average_price,
    gm_style,
    tools,
    game_format,
  } = req.body;

  try {
    const gm = await profileService.updateGmProfile(userId, {
      nickname,
      bio_long,
      avatar_url,
      banner_url,
      languages,
      specialties,
      experience_years,
      average_price,
      gm_style,
      tools,
      game_format,
    });
    return res.json({ data: gm });
  } catch (error: any) {
    console.error('[PATCH /profile/gm]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil de mestre' });
  }
});

// =============================================================================
// POST /api/v1/profile/me/systems — Adicionar sistema favorito/gm
// =============================================================================

router.post('/me/systems', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { system_id, type } = req.body;

  if (!system_id || !type) {
    return res.status(400).json({ error: 'system_id e type são obrigatórios' });
  }

  if (type !== 'favorite' && type !== 'gm') {
    return res.status(400).json({ error: 'type deve ser "favorite" ou "gm"' });
  }

  try {
    const userSystem = await profileService.addUserSystem(userId, system_id, type);
    return res.json({ data: userSystem });
  } catch (error: any) {
    console.error('[POST /profile/me/systems]', error);
    return res.status(500).json({ error: error.message || 'Erro ao adicionar sistema' });
  }
});

// Alias para compatibilidade com frontend
router.post('/systems', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { system_id, type } = req.body;

  if (!system_id || !type) {
    return res.status(400).json({ error: 'system_id e type são obrigatórios' });
  }

  if (type !== 'favorite' && type !== 'gm') {
    return res.status(400).json({ error: 'type deve ser "favorite" ou "gm"' });
  }

  try {
    const userSystem = await profileService.addUserSystem(userId, system_id, type);
    return res.json({ data: userSystem });
  } catch (error: any) {
    console.error('[POST /profile/systems]', error);
    return res.status(500).json({ error: error.message || 'Erro ao adicionar sistema' });
  }
});

// =============================================================================
// DELETE /api/v1/profile/me/systems/:id — Remover sistema
// =============================================================================

router.delete('/me/systems/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { id } = req.params;

  try {
    await profileService.removeUserSystem(id, userId);
    return res.status(204).send();
  } catch (error: any) {
    console.error('[DELETE /profile/me/systems/:id]', error);
    return res.status(500).json({ error: 'Erro ao remover sistema' });
  }
});

// Alias para compatibilidade com frontend
router.delete('/systems/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { id } = req.params;

  try {
    await profileService.removeUserSystem(id, userId);
    return res.status(204).send();
  } catch (error: any) {
    console.error('[DELETE /profile/systems/:id]', error);
    return res.status(500).json({ error: 'Erro ao remover sistema' });
  }
});

// =============================================================================
// GET /api/v1/profile/me/discord — Status da conexão Discord
// =============================================================================

router.get('/me/discord', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const status = await profileService.getDiscordStatus(userId);
    return res.json({ data: status });
  } catch (error: any) {
    console.error('[GET /profile/me/discord]', error);
    return res.status(500).json({ error: 'Erro ao buscar status Discord' });
  }
});

// =============================================================================
// POST /api/v1/profile/me/connect/discord — Conectar Discord
// =============================================================================

router.post('/me/connect/discord', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { username, id } = req.body;

  if (!username || !id) {
    return res.status(400).json({ error: 'username e id são obrigatórios' });
  }

  try {
    const status = await profileService.connectDiscord(userId, { username, id });
    return res.json({ data: status });
  } catch (error: any) {
    console.error('[POST /profile/me/connect/discord]', error);
    return res.status(500).json({ error: 'Erro ao conectar Discord' });
  }
});

// =============================================================================
// DELETE /api/v1/profile/me/connect/discord — Desconectar Discord
// =============================================================================

router.delete('/me/connect/discord', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    await profileService.disconnectDiscord(userId);
    return res.status(204).send();
  } catch (error: any) {
    console.error('[DELETE /profile/me/connect/discord]', error);
    return res.status(500).json({ error: 'Erro ao desconectar Discord' });
  }
});

// =============================================================================
// POST /api/v1/profile/me/google-picture — Buscar e usar foto do Google
// =============================================================================

router.post('/me/google-picture', strictRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    // Buscar refresh_token do usuário
    const user = await profileService.getUserById(userId);
    
    if (!user?.refresh_token) {
      return res.status(400).json({ 
        error: 'Não foi possível buscar a foto do Google. Faça login novamente.' 
      });
    }

    // Validar variáveis de ambiente do Google OAuth
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('[POST /profile/me/google-picture] Variáveis de ambiente do Google OAuth não configuradas');
      return res.status(500).json({ 
        error: 'Configuração do Google OAuth não disponível. Contate o suporte.' 
      });
    }

    // Buscar foto atual do Google usando o refresh_token
    const { OAuth2Client } = await import('google-auth-library');
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      return res.status(400).json({ 
        error: 'Não foi possível obter acesso ao Google. Faça login novamente.' 
      });
    }

    // Buscar informações do usuário no Google
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });

    if (!userinfoRes.ok) {
      return res.status(502).json({ 
        error: 'Erro ao buscar informações do Google.' 
      });
    }

    const userInfo = await userinfoRes.json() as { picture?: string };

    if (!userInfo.picture) {
      return res.status(404).json({ 
        error: 'Foto do Google não encontrada.' 
      });
    }

    // Atualizar avatar_url no perfil
    const profile = await profileService.updateProfile(userId, {
      avatar_url: userInfo.picture,
    });

    return res.json({ 
      data: { 
        avatar_url: userInfo.picture,
        profile 
      } 
    });
  } catch (error: any) {
    console.error('[POST /profile/me/google-picture]', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar foto do Google. Tente fazer login novamente.' 
    });
  }
});

export default router;
