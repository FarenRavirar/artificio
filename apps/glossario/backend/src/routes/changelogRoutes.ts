import { Router } from 'express';
import { getChangelogs } from '../controllers/changelogController';

const router = Router();

router.get('/', getChangelogs);

export default router;
