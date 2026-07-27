import { Router, type RequestHandler } from 'express';
import type { AuthenticatedRequest } from '@artificio/auth';
import * as MaterialTypes from '../db/repo/materialTypes.js';

// Router separado do catálogo público: além de refletir a fronteira de auth no
// runtime, evita o inventário estático cruzar os mesmos subpaths entre duas
// factories e documentar POST/PUT públicos que não existem.
export function catalogMaterialTypesAdminApi(requireAuth: RequestHandler, requireAdmin: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth, requireAdmin);

  router.get('/', async (_req, res) => {
    try {
      res.json({ items: await MaterialTypes.listMaterialTypes(true) });
    } catch (error) {
      console.error('[catalog] material types admin list failed', error);
      res.status(500).json({ error: 'catalog_unavailable' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      res.status(201).json(await MaterialTypes.createMaterialType(parseWrite(req.body), actorOf(req)));
    } catch (error) {
      handleError(error, res);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const row = await MaterialTypes.updateMaterialType(String(req.params.id), parsePatch(req.body), actorOf(req));
      if (!row) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json(row);
    } catch (error) {
      handleError(error, res);
    }
  });

  return router;
}

function parseWrite(body: unknown): MaterialTypes.MaterialTypeWrite {
  const value = asRecord(body);
  // Achado real (review PR #205, Codex): coerção silenciosa transformava tipo
  // inválido em omissão/array filtrado. Campo enviado com shape errado é 400;
  // campo ausente continua ausente para preservar PATCH parcial.
  const parsed: MaterialTypes.MaterialTypeWrite = { name: readString(value, 'name') ?? '' };
  if ('slug' in value) parsed.slug = readString(value, 'slug');
  if ('aliases' in value) parsed.aliases = readStringArray(value, 'aliases');
  if ('status' in value) parsed.status = readString(value, 'status') as MaterialTypes.MaterialTypeStatus;
  return parsed;
}

function parsePatch(body: unknown): Partial<MaterialTypes.MaterialTypeWrite> {
  const value = asRecord(body);
  const patch: Partial<MaterialTypes.MaterialTypeWrite> = {};
  if ('name' in value) patch.name = readString(value, 'name');
  if ('slug' in value) patch.slug = readString(value, 'slug');
  if ('aliases' in value) patch.aliases = readStringArray(value, 'aliases');
  // Achado real (review PR #218, Codex, P2): `aliases` SUBSTITUI a lista, o que
  // obriga quem só quer acrescentar a fazer read-modify-write — e duas
  // aprovações simultâneas de sugestão para o mesmo tipo perdiam um dos
  // aliases. `add_aliases` acrescenta atomicamente, no próprio UPDATE.
  if ('add_aliases' in value) patch.add_aliases = readStringArray(value, 'add_aliases');
  if ('status' in value) patch.status = readString(value, 'status') as MaterialTypes.MaterialTypeStatus;
  return patch;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad_payload');
  return value as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  if (!(key in value)) return undefined;
  if (typeof value[key] !== 'string') throw new Error('bad_payload');
  return value[key].trim();
}

function readStringArray(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  if (!Array.isArray(field) || !field.every((item) => typeof item === 'string')) {
    throw new Error('bad_payload');
  }
  return field;
}

function actorOf(req: unknown): string | null {
  return (req as AuthenticatedRequest).session?.user?.id ?? null;
}

function handleError(error: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  const message = error instanceof Error ? error.message : 'catalog_write_failed';
  if (['bad_payload', 'name_required', 'slug_required', 'bad_status'].includes(message)) {
    res.status(400).json({ error: message });
    return;
  }
  if (message.includes('duplicate key')) {
    res.status(409).json({ error: 'duplicate_catalog_material_type' });
    return;
  }
  console.error('[catalog] material type write failed', error);
  res.status(500).json({ error: 'catalog_write_failed' });
}
