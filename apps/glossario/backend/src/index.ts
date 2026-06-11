import express, { Request, Response } from 'express';
import cors from 'cors';
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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota de Healthcheck básica para o Docker/Github Actions
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Backend v2 operacional!' });
});

// Rotas da API
app.use('/api/auth', authRoutes);
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
