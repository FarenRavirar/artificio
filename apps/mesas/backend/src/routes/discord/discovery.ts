import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/auth';
import { discoverDiscordGuilds, discoverDiscordChannels } from '../../discord';
import { snowflakeParamSchema, sendDiscordDiscoveryError } from './utils';

const router = Router();

// Token bot de um perfil ainda não salvo (form.token) — via header, nunca query string
// (evita vazar em access log). Sem isso, perfil bot com token próprio não listava nada
// antes de salvar (a descoberta caía sempre no bot token global).
function overrideTokenFromHeader(req: Request): string | undefined {
  const header = req.header('x-discord-bot-token');
  return header?.trim() || undefined;
}

// GET /discovery/guilds
router.get('/guilds', requireAdmin, async (req: Request, res: Response) => {
  try {
    const guilds = await discoverDiscordGuilds(overrideTokenFromHeader(req));
    return res.json({ data: guilds });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord/discovery/guilds]');
  }
});

// GET /discovery/guilds/:guildId/channels
router.get('/guilds/:guildId/channels', requireAdmin, async (req: Request, res: Response) => {
  const parsed = snowflakeParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Servidor Discord inválido.', details: z.flattenError(parsed.error) });
  }

  try {
    const channels = await discoverDiscordChannels(parsed.data.guildId, overrideTokenFromHeader(req));
    return res.json({ data: channels });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord/discovery/guilds/:guildId/channels]');
  }
});

export default router;
