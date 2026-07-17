import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import tablesRoutes from './routes/tables.js';
import gmRoutes from './routes/gm.js';
import gmPanelRoutes from './routes/gmPanel.js';
import systemsRoutes from './routes/systems.js';
import scenariosRoutes from './routes/scenarios.js';
import systemSuggestionsRoutes from './routes/systemSuggestions.js';
import scenarioSuggestionsRoutes from './routes/scenarioSuggestions.js';
import systemSuggestionsAdminRoutes from './routes/systemSuggestionsAdmin.js';
import scenarioSuggestionsAdminRoutes from './routes/scenarioSuggestionsAdmin.js';
import devFeedbackRoutes from './routes/devFeedback.js';
import devFeedbackAdminRoutes from './routes/devFeedbackAdmin.js';
import notificationsRoutes from './routes/notifications.js';
import meRoutes from './routes/me.js';
import profileRoutes from './routes/profile.js';
import adminProfileRoutes from './routes/adminProfile.js';
import linksRoutes from './routes/links.js';
import discordRoutes from './routes/discord.js';
import settingsRoutes from './routes/settings.js';
import adminSettingSuggestionsRoutes from './routes/adminSettingSuggestions.js';
import vttPlatformsRoutes from './routes/vttPlatforms.js';
import communicationPlatformsRoutes from './routes/communicationPlatforms.js';
import changelogRoutes from './routes/changelog.js';
import adminTablesRoutes from './routes/adminTables.js';
import adminEnrichmentRoutes from './routes/adminEnrichment.js';
import adminSystemProjectionRoutes from './routes/adminSystemProjection.js';
import adminDiscordSyncRoutes from './routes/adminDiscordSync.js';
import adminInboxRoutes from './routes/adminImportInbox.js';
import activityLogRoutes from './routes/activityLog.js';
import uploadRoutes from './routes/upload.js';
import ogRoutes from './routes/og.js';
import sitemapRoutes from './routes/sitemap.js';
import { db } from './db/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import { parseCookies } from './middleware/parseCookies.js';
import { globalRateLimiter } from './middleware/rateLimit.js';

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

const allowedFrontendOrigins = Array.from(new Set(frontendUrls));

const app = express();
app.disable("x-powered-by");
const port = process.env.PORT || 3000;

// Atras do nginx na artificio_net: confia somente no proxy interno definido por
// TRUSTED_PROXY_CIDR. O nginx ja validou CF-Connecting-IP e repassa $remote_addr.
app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedFrontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`[cors] Origin não permitida: ${origin}`));
  },
  credentials: true,
}));

app.use(parseCookies);
app.use(globalRateLimiter);
app.use(csrfProtection(allowedFrontendOrigins));
app.use(express.json({ limit: '12mb' }));

// Middleware de logging de todas as requisições
app.use(requestLogger);

app.get('/api/v1/health', async (req, res) => {
  try {
    const result = await db.selectFrom('users').select('id').limit(1).execute();
    res.json({
      status: 'ok',
      environment: process.env.APP_ENV || 'production',
      db: 'connected',
      usersSampled: result.length > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      details: message,
    });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/auth', discordRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/profile', linksRoutes);
app.use('/api/v1/admin', adminProfileRoutes);
app.use('/api/v1/tables', tablesRoutes);
app.use('/api/v1/systems', systemsRoutes);
app.use('/api/v1/scenarios', scenariosRoutes);
app.use('/api/v1/system-suggestions', systemSuggestionsRoutes);
app.use('/api/v1/scenario-suggestions', scenarioSuggestionsRoutes);
app.use('/api/v1/dev-feedback', devFeedbackRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/admin', adminTablesRoutes);
app.use('/api/v1/admin', adminEnrichmentRoutes);
app.use('/api/v1/admin', adminSystemProjectionRoutes);
app.use('/api/v1/admin/discord', adminDiscordSyncRoutes);
app.use('/api/v1/admin/import', adminInboxRoutes);
app.use('/api/v1/admin', systemSuggestionsAdminRoutes);
app.use('/api/v1/admin', scenarioSuggestionsAdminRoutes);
app.use('/api/v1/admin', devFeedbackAdminRoutes);
app.use('/api/v1/admin', activityLogRoutes);
app.use('/api/v1/gm', gmPanelRoutes);
app.use('/api/v1/gm', gmRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/admin/setting-suggestions', adminSettingSuggestionsRoutes);
app.use('/api/v1/vtt-platforms', vttPlatformsRoutes);
app.use('/api/v1/communication-platforms', communicationPlatformsRoutes);
app.use('/api/v1/changelog', changelogRoutes);
app.use('/api/v1', uploadRoutes);
app.use('/og', ogRoutes);
app.use('/', sitemapRoutes);

interface HttpError {
  type?: string;
  status?: number;
  statusCode?: number;
  message?: string;
}

app.use((err: HttpError, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);

  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }

  const status = typeof err?.status === 'number'
    ? err.status
    : typeof err?.statusCode === 'number'
      ? err.statusCode
      : 500;

  if (status >= 500) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }

  return res.status(status).json({ error: err?.message || 'Requisição inválida.' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
