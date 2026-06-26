import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/auth';
import { discoverDiscordGuilds, discoverDiscordChannels } from '../../discord';
import { snowflakeParamSchema, sendDiscordDiscoveryError } from './utils';

const router = Router();

// GET /discovery/guilds
router.get('/guilds', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const guilds = await discoverDiscordGuilds();
    return res.json({ data: guilds });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord-sync/discovery/guilds]');
  }
});

// GET /discovery/guilds/:guildId/channels
router.get('/guilds/:guildId/channels', requireAdmin, async (req: Request, res: Response) => {
  const parsed = snowflakeParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Servidor Discord inválido.', details: z.flattenError(parsed.error) });
  }

  try {
    const channels = await discoverDiscordChannels(parsed.data.guildId);
    return res.json({ data: channels });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord-sync/discovery/guilds/:guildId/channels]');
  }
});

export default router;
