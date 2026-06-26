import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import type { NewDiscordSetting } from '../../db/types';
import { requireAdmin } from '../../middleware/auth';
import { encryptDiscordSetting, decryptDiscordSetting, DiscordSettingsSecretUnavailableError, DiscordSettingsDecryptError } from '../../discord/settingsCrypto';

const router = Router();

const botTokenSchema = z.object({
  token: z.string().trim().min(50, 'Token deve ter pelo menos 50 caracteres.').regex(/^\S+$/, 'Token não pode conter espaços.'),
});

function maskToken(token: string): string {
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function sendSettingsError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: 'Erro ao acessar configurações do Discord.' });
}

// GET /
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const setting = await db
      .selectFrom('discord_settings')
      .select(['value', 'updated_at'])
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .executeTakeFirst();

    if (!setting) {
      return res.json({ data: { bot_token: { is_set: false, preview: null, updated_at: null } } });
    }

    try {
      const token = decryptDiscordSetting(setting.value);
      return res.json({
        data: {
          bot_token: {
            is_set: true,
            preview: maskToken(token),
            updated_at: setting.updated_at,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof DiscordSettingsDecryptError) {
        return res.json({
          data: {
            bot_token: {
              is_set: true,
              preview: null,
              updated_at: setting.updated_at,
              decrypt_error: true,
            },
          },
        });
      }
      throw error;
    }
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[GET /admin/discord-sync/settings]');
  }
});

// PUT /bot-token
router.put('/bot-token', requireAdmin, async (req: Request, res: Response) => {
  const parsed = botTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Token inválido.', details: z.flattenError(parsed.error) });
  }

  try {
    const encryptedValue = encryptDiscordSetting(parsed.data.token);
    const existing = await db
      .selectFrom('discord_settings')
      .select('id')
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .executeTakeFirst();

    const now = new Date();
    const setting = existing
      ? await db
          .updateTable('discord_settings')
          .set({ value: encryptedValue, updated_at: now })
          .where('id', '=', existing.id)
          .returning(['updated_at'])
          .executeTakeFirstOrThrow()
      : await db
          .insertInto('discord_settings')
          .values({
            guild_id: null,
            key: 'bot_token',
            value: encryptedValue,
            updated_at: now,
          } satisfies NewDiscordSetting)
          .returning(['updated_at'])
          .executeTakeFirstOrThrow();

    return res.json({
      data: {
        is_set: true,
        preview: maskToken(parsed.data.token),
        updated_at: setting.updated_at,
      },
    });
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[PUT /admin/discord-sync/settings/bot-token]');
  }
});

// DELETE /bot-token
router.delete('/bot-token', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db
      .deleteFrom('discord_settings')
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .execute();
    return res.status(204).send();
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[DELETE /admin/discord-sync/settings/bot-token]');
  }
});

export default router;
