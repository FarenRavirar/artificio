import request from 'supertest';
import express from 'express';
import adminHydrationRoutes from './adminHydration';

const app = express();
app.use('/api/v1/admin', adminHydrationRoutes);

describe('Admin Hydration Routes', () => {
  it('should return 403 when not authenticated', async () => {
    const res = await request(app).post('/api/v1/admin/sync/hydrate');
    expect(res.status).toBe(401);
  });
});
