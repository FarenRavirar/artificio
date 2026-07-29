import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import materialsRoutes from './routes/materials';
import materialMetadataRoutes from './routes/materialMetadata';
import materialCoverRoutes from './routes/materialCover';
import moderationRoutes from './routes/moderation';
import reportsRoutes from './routes/reports';
import commentsRoutes from './routes/comments';
import creatorsRoutes from './routes/creators';
import destinationsRoutes from './routes/destinations';
import downloadsRoutes from './routes/downloads';
import ratingsRoutes from './routes/ratings';
import favoritesRoutes from './routes/favorites';
import collectionsRoutes from './routes/collections';
import organizationsRoutes from './routes/organizations';
import notificationsRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import changelogRoutes from './routes/changelog';
import rejectionCategoriesRoutes from './routes/rejectionCategories';
import emailLogRoutes from './routes/emailLog';
import scraperRoutes from './routes/scraper';
import systemSuggestionsRoutes from './routes/systemSuggestions';
import systemSuggestionsAdminRoutes from './routes/systemSuggestionsAdmin';
import materialTypeSuggestionsAdminRoutes from './routes/materialTypeSuggestionsAdmin';
import { parseCookies } from './middleware/parseCookies';
import { db } from './db';
import { startLinkCheckerScheduler } from './services/linkCheckerScheduler';
import { startScraperScheduler } from './services/scraperScheduler';
import { startMetricsScheduler } from './services/metricsScheduler';

dotenv.config();

const requiredEnv = ['FRONTEND_URL', 'JWT_SECRET', 'DATABASE_URL'] as const;

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    throw new Error(`[startup] Variável obrigatória ausente: ${envName}`);
  }
}

const frontendUrls = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS?.split(',') ?? []),
]
  .map((url) => url?.trim())
  .filter((url): url is string => Boolean(url))
  .map((url) => new URL(url).origin);

const allowedFrontendOrigins = new Set(frontendUrls);

const app = express();
app.disable('x-powered-by');

// Achado de review PR #214 (Codex, P1): sem isto `req.ip` e o IP do nginx que
// faz proxy de /api (frontend/nginx.conf), nao o do visitante — a dedup de
// visualizacao por (origem, material, dia) de services/materialMetrics.ts
// colapsaria quase tudo num hash so e corromperia o ranking `trending`.
// CIDR restrito (nao `true`), mesma env var e mesmo default de rede docker que
// mesas/site/links/glossario/accounts ja usam: confiar em proxy arbitrario
// deixaria qualquer cliente forjar X-Forwarded-For e escapar da dedup.
app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16');

const port = process.env.PORT || 3000;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedFrontendOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`[cors] Origin não permitida: ${origin}`));
  },
  credentials: true,
}));

app.use(parseCookies);
app.use(express.json({ limit: '4mb' }));

app.get('/api/v1/health', async (_req, res) => {
  try {
    const result = await db.selectFrom('download_material').select('id').limit(1).execute();
    res.json({ status: 'ok', db: 'connected', sampled: result.length > 0 });
  } catch (error: unknown) {
    console.error('[health] Falha na conexão com o banco:', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Achado de review PR #228 (Codex P1): materialCoverRoutes precisa vir ANTES
// de materialsRoutes — este tem `GET /:slug`, que captura
// `/api/v1/materials/cover-capabilities` e devolve 404, desligando upload de
// capa e migração em lote no frontend.
app.use('/api/v1/materials', materialCoverRoutes);
app.use('/api/v1/materials', materialsRoutes);
app.use('/api/v1/material-metadata', materialMetadataRoutes);
app.use('/api/v1/moderation', moderationRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/comments', commentsRoutes);
app.use('/api/v1/creators', creatorsRoutes);
app.use('/api/v1/destinations', destinationsRoutes);
app.use('/api/v1/downloads', downloadsRoutes);
app.use('/api/v1/ratings', ratingsRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/collections', collectionsRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/rejection-categories', rejectionCategoriesRoutes);
app.use('/api/v1/admin/email-log', emailLogRoutes);
app.use('/api/v1/admin/scraper', scraperRoutes);
app.use('/api/v1/system-suggestions', systemSuggestionsRoutes);
app.use('/api/v1/admin/system-suggestions', systemSuggestionsAdminRoutes);
app.use('/api/v1/admin/material-type-suggestions', materialTypeSuggestionsAdminRoutes);
app.use('/api/v1/changelog', changelogRoutes);

interface HttpError {
  type?: string;
  status?: number;
  statusCode?: number;
  message?: string;
}

app.use((err: HttpError, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);

  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }

  let status = 500;
  if (typeof err?.status === 'number') {
    status = err.status;
  } else if (typeof err?.statusCode === 'number') {
    status = err.statusCode;
  }

  if (status >= 500) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }

  return res.status(status).json({ error: err?.message || 'Requisição inválida.' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  startLinkCheckerScheduler();
  startScraperScheduler();
  startMetricsScheduler();
});
