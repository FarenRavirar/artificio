import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Atrás do nginx (1 hop): habilita req.ip correto para rate-limit do /api/migration.
app.set('trust proxy', 1);

// CORS restrito: o front é servido same-origin (nginx faz proxy de /api/),
// então só liberamos origens do próprio domínio Artifício + localhost (dev).
// Extra via ALLOWED_ORIGINS (CSV). Sem cookies (auth via Bearer), credentials off.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

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
app.use(express.json());
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

app.listen(port, () => {
  console.log(`[server]: Servidor rodando na porta ${port}`);
});
