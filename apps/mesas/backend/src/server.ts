import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import tablesRoutes from './routes/tables';
import gmRoutes from './routes/gm';
import gmPanelRoutes from './routes/gmPanel';
import systemsRoutes from './routes/systems';
import scenariosRoutes from './routes/scenarios';
import systemSuggestionsRoutes from './routes/systemSuggestions';
import scenarioSuggestionsRoutes from './routes/scenarioSuggestions';
import systemSuggestionsAdminRoutes from './routes/systemSuggestionsAdmin';
import scenarioSuggestionsAdminRoutes from './routes/scenarioSuggestionsAdmin';
import devFeedbackRoutes from './routes/devFeedback';
import devFeedbackAdminRoutes from './routes/devFeedbackAdmin';
import notificationsRoutes from './routes/notifications';
import meRoutes from './routes/me';
import profileRoutes from './routes/profile';
import adminProfileRoutes from './routes/adminProfile';
import linksRoutes from './routes/links';
import discordRoutes from './routes/discord';
import settingsRoutes from './routes/settings';
import adminSettingSuggestionsRoutes from './routes/adminSettingSuggestions';
import vttPlatformsRoutes from './routes/vttPlatforms';
import communicationPlatformsRoutes from './routes/communicationPlatforms';
import changelogRoutes from './routes/changelog';
import adminTablesRoutes from './routes/adminTables';
import adminEnrichmentRoutes from './routes/adminEnrichment';
import adminSystemProjectionRoutes from './routes/adminSystemProjection';
import adminDiscordSyncRoutes from './routes/adminDiscordSync';
import adminInboxRoutes from './routes/adminImportInbox';
import activityLogRoutes from './routes/activityLog';
import uploadRoutes from './routes/upload';
import ogRoutes from './routes/og';
import { db } from './db';
import { requestLogger } from './middleware/requestLogger';
import { csrfProtection } from './middleware/csrfProtection';
import { parseCookies } from './middleware/parseCookies';
import { globalRateLimiter } from './middleware/rateLimit';

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
