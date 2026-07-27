import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { optionalAuth } from '../middleware/auth';
import { readRateLimiter } from '../middleware/rateLimit';
import { registerMaterialDownload } from '../services/downloadRegistry';

const router = Router();

// DEB-073-02 (spec 073) — resolve id opaco de destino (download_destination,
// migration_014) para o external_url do material publicado correspondente.
// Fail-closed: material nao publicado ou sem external_url nao resolve,
// mesmo que o destino exista (mesma regra da ficha, T4.1).
// Spec 088 — `optionalAuth` porque esta rota agora tambem REGISTRA o acesso
// quando ha sessao. O CTA da ficha virou ancora nativa, e `onClick` nao
// dispara em botao do meio, `Ctrl+clique` ou "Abrir em nova aba" — o navegador
// segue o `href` direto. Registrar so no clique primario perderia metrica
// nesses fluxos e deixaria o usuario inelegivel pra avaliar (o guard exige
// download registrado). Esta rota e o unico ponto que TODA abertura atravessa.
// `readRateLimiter` (achado CodeQL, PR #217): a rota faz autorizacao e agora
// ESCREVE no banco (registro de download), entao rajada nao-limitada aqui
// custa insercao/UPDATE de metrica, nao so leitura. Limiter antes do
// `optionalAuth` — mesmo padrao de `creators.ts`/`favorites.ts` — pra que a
// rajada seja barrada antes de verificar token e tocar o banco.
router.get('/:id', readRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  const destination = await db
    .selectFrom('download_destination')
    .innerJoin('download_material', 'download_material.id', 'download_destination.material_id')
    .select([
      'download_material.id as material_id',
      'download_material.external_url as external_url',
      'download_material.editorial_state as editorial_state',
    ])
    .where('download_destination.id', '=', req.params.id)
    .executeTakeFirst();

  if (destination?.editorial_state !== 'published' || !destination.external_url) {
    return res.status(404).json({ error: 'Destino não encontrado.' });
  }

  // Fail-soft e DEPOIS do guard fail-closed: o registro nunca impede o acesso
  // ao material. Destino que nao resolve ja retornou 404 acima, entao so
  // abertura legitima chega aqui. Visitante sem sessao nao registra nada — a
  // metrica de download e por conta (dedup em `(user_id, material_id)`).
  if (req.user) {
    try {
      await registerMaterialDownload(req.user.userId, destination.material_id);
    } catch (error) {
      console.error('[destinations] falha ao registrar download', error);
    }
  }

  return res.json({ external_url: destination.external_url });
});

export default router;
