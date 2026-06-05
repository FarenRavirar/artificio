import { Router, Request, Response } from 'express';

const router = Router();

const getAccountsOrigin = () => process.env.ACCOUNTS_URL || 'https://accounts.artificiorpg.com';
const getMesasOrigin = () => process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'https://mesas.artificiorpg.com';

const readReturnUrl = (req: Request): string => {
  const raw = typeof req.query.frontend_redirect === 'string'
    ? req.query.frontend_redirect
    : getMesasOrigin();

  try {
    const url = new URL(raw);
    return new URL(`${url.pathname}${url.search}${url.hash}`, getMesasOrigin()).toString();
  } catch {
    return getMesasOrigin();
  }
};

router.get('/google', (req: Request, res: Response) => {
  const loginUrl = new URL('/login', getAccountsOrigin());
  loginUrl.searchParams.set('return', readReturnUrl(req));
  res.redirect(loginUrl.toString());
});

router.get('/google/callback', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'OAuth local aposentado. Use accounts.artificiorpg.com.' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Logout local aposentado. Use accounts.artificiorpg.com/api/auth/logout.' });
});

export default router;
