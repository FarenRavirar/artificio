import express from 'express';
import { startNotificationOutboxSweep } from './services/notificationOutboxDelivery.js';
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
import communityCommentsRoutes from './routes/communityComments.js';
import communityModerationRoutes from './routes/communityModeration.js';
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
// T7.4b (spec 096): `/api/v1/notifications` SAIU. As 3 rotas de leitura
// (GET /, PATCH /read-all, PATCH /:id/read) ficaram órfãs quando o
// `NotificationBell` de `packages/ui` passou a ler do `accounts.` por
// `source_app` — medido: zero consumidores no frontend do mesas. O comentário
// da T7.5 abaixo dizia que "o frontend depende dela", e isso deixou de valer.
//
// T7.5 (spec 090, requisito 26d) — namespace PRÓPRIO para a conversa. Mesmo
// caminho que `downloads` e `site` já expõem (`downloads/server.ts:132`), para
// o pacote cliente falar com os três sem condicional por app.
app.use('/api/v1/community/conversation', communityCommentsRoutes);
// T7.7 — moderação sobre a superfície nova. Registrada DEPOIS da conversa, como
// no `downloads` (`server.ts:132-133`): a rota mais específica casa primeiro.
app.use('/api/v1/community', communityModerationRoutes);
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
  // T7.4b (spec 096): varredura periódica do outbox de notificação. O disparo
  // pós-commit (nos pontos de emissão) cobre o caso normal; este sweep é a rede
  // de segurança para o que ficou pendente por queda de processo, accounts fora
  // do ar ou credencial ainda não emitida. `unref` no timer — não segura o
  // encerramento do container.
  startNotificationOutboxSweep();
});
