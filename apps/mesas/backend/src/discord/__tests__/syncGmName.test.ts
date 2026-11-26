import type { Mock } from 'vitest';

vi.mock('../../db', () => ({ db: { selectFrom: vi.fn(), updateTable: vi.fn() } }));
vi.mock('../uploadDiscordImage', () => ({ uploadDiscordImageToCloudinary: vi.fn() }));

import { db } from '../../db/index.js';
import { uploadDiscordImageToCloudinary } from '../uploadDiscordImage.js';
import { DiscordDraftSyncValidationError, syncDiscordDraftToTable } from '../syncDiscordDraftToTable.js';

function row(value: unknown) {
  const chain = { selectAll: () => chain, where: () => chain, executeTakeFirst: async () => value };
  return chain;
}

// Incidente: autor "𝑻" passava no guard (length 2) e o CHECK do banco devolvia 500.
describe('sync com nome de mestre de um caractere', () => {
  it('recusa com erro de validação, antes de subir a capa', async () => {
    const payload = {
      table: {
        title: 'Mesa', description: 'Texto', system_id: 'sys', type: 'campanha', modality: 'online',
        price_type: 'gratuita', slots_total: 4, host_discord_id: '1', day_of_week: 'to_define',
        start_time: null, cover_url_source: 'https://cdn.discordapp.com/a.png',
      },
      source: { author_name: '𝑻' },
      missing_fields: [],
    };
    (db.selectFrom as Mock)
      .mockReturnValueOnce(row({ id: 'd', status: 'ready', discord_message_id: 'm', normalized_payload: payload }))
      .mockReturnValueOnce(row({ id: 'm' }));

    const error = await syncDiscordDraftToTable('d').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DiscordDraftSyncValidationError);
    expect((error as DiscordDraftSyncValidationError).missingFields).toEqual(['gm_name']);
    expect(uploadDiscordImageToCloudinary).not.toHaveBeenCalled();
  });
});
