import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`migration_postgres_test: ${message}`);
}

function requireSafeTestUrl(): string {
  const raw = process.env.MIGRATION_POSTGRES_TEST_URL;
  assert(raw, 'MIGRATION_POSTGRES_TEST_URL ausente');
  const parsed = new URL(raw);
  assert(
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname),
    'host deve ser local/CI descartável',
  );
  assert(parsed.pathname === '/artificio_test', 'database deve ser artificio_test');
  return raw;
}

async function applyMigration(client: Client, migrationsDir: string, filename: string): Promise<void> {
  const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
  await client.query(sql);
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: requireSafeTestUrl() });
  const schema = `downloads_migration_test_${process.pid}`;
  const migrationsDir = path.resolve(process.cwd(), '../database');
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);

    // Achado real (review PR #228, Sonar): evitar `\d+.*` com backtracking
    // desnecessário; nomes de migration já têm prefixo/sufixo fixos.
    const baseline = (await readdir(migrationsDir))
      .filter((filename) => filename.startsWith('migration_') && filename.endsWith('.sql'))
      .filter((filename) => Number(filename.slice(10, 13)) <= 33)
      .sort();
    assert(baseline.length === 33, `baseline esperada 33 migrations; recebeu ${baseline.length}`);
    for (const filename of baseline) await applyMigration(client, migrationsDir, filename);

    const materialId = '11111111-1111-4111-8111-111111111111';
    await client.query(
      `INSERT INTO download_material
        (id, slug, title, description, material_type, material_type_id, creator_id)
       VALUES ($1, 'migration-test', 'Migration Test', 'Texto plano preservado', 'Aventura',
         'b071ab5e-2d16-4c58-8f0e-086000000001', '22222222-2222-4222-8222-222222222222')`,
      [materialId],
    );
    await client.query(
      `INSERT INTO download_material_metadata (material_id, language, description_html)
       VALUES ($1, 'pt', '<p>HTML legado preservado</p>')`,
      [materialId],
    );
    const seededCount = await client.query('SELECT COUNT(*)::int AS count FROM download_material_metadata');
    assert(seededCount.rows[0].count === 1, 'fixture deveria conter exatamente um metadata');

    await applyMigration(client, migrationsDir, 'migration_034_download_material_metadata_markdown.sql');
    let row = (await client.query(
      'SELECT description_markdown, description_html FROM download_material_metadata WHERE material_id = $1',
      [materialId],
    )).rows[0];
    assert(row.description_markdown === 'Texto plano preservado', '034 não fez backfill da projeção plana');
    assert(row.description_html === '<p>HTML legado preservado</p>', '034 alterou HTML de rollback');

    await client.query(
      'UPDATE download_material_metadata SET description_markdown = $2 WHERE material_id = $1',
      [materialId, '**Markdown editado**'],
    );
    await applyMigration(client, migrationsDir, 'migration_034_download_material_metadata_markdown.sql');
    row = (await client.query(
      'SELECT description_markdown FROM download_material_metadata WHERE material_id = $1',
      [materialId],
    )).rows[0];
    assert(row.description_markdown === '**Markdown editado**', 'rerun 034 sobrescreveu Markdown existente');

    await client.query('ALTER TABLE download_material_metadata DROP COLUMN description_markdown');
    const rollback = (await client.query(
      `SELECT material.description, metadata.description_html,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = $2 AND table_name = 'download_material_metadata'
            AND column_name = 'description_markdown'
        ) AS markdown_exists
       FROM download_material material
       JOIN download_material_metadata metadata ON metadata.material_id = material.id
       WHERE material.id = $1`,
      [materialId, schema],
    )).rows[0];
    assert(rollback.description === 'Texto plano preservado', 'rollback alterou projeção plana');
    assert(rollback.description_html === '<p>HTML legado preservado</p>', 'rollback perdeu HTML legado');
    assert(rollback.markdown_exists === false, 'rollback não removeu coluna canônica');
    const rollbackCount = await client.query('SELECT COUNT(*)::int AS count FROM download_material_metadata');
    assert(rollbackCount.rows[0].count === 1, 'rollback alterou contagem de metadata');

    await applyMigration(client, migrationsDir, 'migration_034_download_material_metadata_markdown.sql');
    await applyMigration(client, migrationsDir, 'migration_034_download_material_metadata_markdown.sql');
    await applyMigration(client, migrationsDir, 'migration_035_download_cover_asset_identity.sql');
    await applyMigration(client, migrationsDir, 'migration_035_download_cover_asset_identity.sql');

    const coverColumns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'download_material_metadata'
         AND column_name = ANY($2::text[])`,
      [schema, [
        'cover_storage_provider', 'cover_public_id', 'cover_width', 'cover_height',
        'cover_mime_type', 'cover_pending_delete_public_id',
      ]],
    );
    assert(coverColumns.rowCount === 6, `035 criou ${coverColumns.rowCount ?? 0}/6 colunas`);

    const constraint = await client.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'download_material_metadata'::regclass
         AND conname = 'chk_download_cover_dimensions_positive'`,
    );
    assert(constraint.rowCount === 1, 'constraint de dimensão ausente ou duplicada');

    await client.query(
      `UPDATE download_material_metadata
       SET cover_width = 1200, cover_height = 630 WHERE material_id = $1`,
      [materialId],
    );
    let invalidRejected = false;
    try {
      await client.query(
        `UPDATE download_material_metadata
         SET cover_width = -1, cover_height = 630 WHERE material_id = $1`,
        [materialId],
      );
    } catch (error) {
      invalidRejected = (error as { code?: string }).code === '23514';
    }
    assert(invalidRejected, 'constraint aceitou dimensão negativa');

    let partialDimensionsRejected = false;
    try {
      await client.query(
        `UPDATE download_material_metadata
         SET cover_width = 1200, cover_height = NULL WHERE material_id = $1`,
        [materialId],
      );
    } catch (error) {
      partialDimensionsRejected = (error as { code?: string }).code === '23514';
    }
    assert(partialDimensionsRejected, 'constraint aceitou dimensões parciais');

    console.log('migration_postgres_test: 034/035, rerun, rollback e constraint verdes');
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
