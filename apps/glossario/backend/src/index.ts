import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import termRoutes from './routes/termRoutes';
import userRoutes from './routes/userRoutes';
import categoryRoutes from './routes/categoryRoutes';
import systemRoutes from './routes/systemRoutes';
import scenarioRoutes from './routes/scenarioRoutes';
import changelogRoutes from './routes/changelogRoutes';
import socialRoutes from './routes/socialRoutes';
import exportRoutes from './routes/exportRoutes';
import importRoutes from './routes/importRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminActivityRoutes from './routes/adminActivityRoutes';
import migrationRoutes from './routes/migrationRoutes';
import feedbackRoutes from './routes/feedbackRoutes';
import feedbackAdminRoutes from './routes/feedbackAdminRoutes';

dotenv.config();

const app = express();
app.disable("x-powered-by");
const port = process.env.PORT || 3000;

// Atras do nginx na artificio_net: confia somente no proxy interno definido por
// TRUSTED_PROXY_CIDR. O nginx ja validou CF-Connecting-IP e repassa $remote_addr.
app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16');

// CORS restrito: o front é servido same-origin (nginx faz proxy de /api/),
// então só liberamos origens do próprio domínio Artifício + localhost (dev).
// Extra via ALLOWED_ORIGINS (CSV). Sem cookies (auth via Bearer), credentials off.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// CORS primeiro: headers CORS precisam estar presentes em TODA resposta,
// inclusive 429 (rate-limit) e erros. Se rateLimit rodar antes, 429 sai
// sem Access-Control-Allow-Origin e o navegador reporta erro de CORS.
app.use(
  cors({
    origin: (origin, callback) => {
      // Requisições same-origin/SSR/curl não mandam Origin → liberar.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https:\/\/([a-z0-9-]+\.)*artificiorpg\.com$/.test(origin)) return callback(null, true);
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      return callback(new Error('Origem não permitida pelo CORS'));
    },
  })
);

// Rate limit após CORS: garante que 429 inclui headers CORS.
// skip: OPTIONS não consome cota (preflight não é ataque).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
  }),
);
// 10mb: o widget de feedback (Spec 021) envia screenshot base64 (até ~7MB, limite do
// validador). Default do express.json (~100KB) rejeitaria com 413 no caminho padrão
// (captura marcada). Espelha o mesas (express.json({ limit: '10mb' })).
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rota de Healthcheck básica para o Docker/Github Actions
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Backend v2 operacional!' });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/terms/import', importRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/activity', adminActivityRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin/feedback', feedbackAdminRoutes);

app.listen(port, () => {
  console.log(`[server]: Servidor rodando na porta ${port}`);
});
