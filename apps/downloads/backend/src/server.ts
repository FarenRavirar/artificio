import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import materialsRoutes from './routes/materials';
import materialMetadataRoutes from './routes/materialMetadata';
import moderationRoutes from './routes/moderation';
import reportsRoutes from './routes/reports';
import commentsRoutes from './routes/comments';
import { parseCookies } from './middleware/parseCookies';
import { db } from './db';

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
app.disable('x-powered-by');
const port = process.env.PORT || 3000;

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

app.use('/api/v1/materials', materialsRoutes);
app.use('/api/v1/material-metadata', materialMetadataRoutes);
app.use('/api/v1/moderation', moderationRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/comments', commentsRoutes);

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
