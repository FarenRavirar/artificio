import { Router } from 'express';
import { getChangelogs } from '../controllers/changelogController.js';

const router = Router();

router.get('/', getChangelogs);

export default router;
