import { Router, type Request, type Response } from 'express';
import { db } from '../db';

const router = Router();

// DEB-073-02 (spec 073) — resolve id opaco de destino (download_destination,
// migration_014) para o external_url do material publicado correspondente.
// Fail-closed: material nao publicado ou sem external_url nao resolve,
// mesmo que o destino exista (mesma regra da ficha, T4.1).
router.get('/:id', async (req: Request, res: Response) => {
  const destination = await db
    .selectFrom('download_destination')
    .innerJoin('download_material', 'download_material.id', 'download_destination.material_id')
    .select(['download_material.external_url as external_url', 'download_material.editorial_state as editorial_state'])
    .where('download_destination.id', '=', req.params.id)
    .executeTakeFirst();

  if (destination?.editorial_state !== 'published' || !destination.external_url) {
    return res.status(404).json({ error: 'Destino não encontrado.' });
  }

  return res.json({ external_url: destination.external_url });
});

export default router;
