import fs from 'node:fs';
import path from 'node:path';
import { DOWNLOAD_SCRAPER_ITEM_OUTCOMES } from './types';

describe('download_scraper_item_log.outcome', () => {
  it('comporta o maior outcome aceito pelo contrato TypeScript', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../database/migration_033_download_scraper_item_log_outcome_width.sql'),
      'utf8',
    );
    const declaredWidth = /ALTER COLUMN outcome TYPE VARCHAR\((\d+)\)/.exec(migration)?.[1];
    expect(declaredWidth).toBeDefined();

    const longestOutcome = Math.max(...DOWNLOAD_SCRAPER_ITEM_OUTCOMES.map((outcome) => outcome.length));
    expect(Number(declaredWidth)).toBeGreaterThanOrEqual(longestOutcome);
  });
});
