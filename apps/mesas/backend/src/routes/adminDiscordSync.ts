import { Router } from 'express';

import previewRouter from './discord/preview.js';
import importRouter from './discord/import.js';
import syncRouter from './discord/sync.js';
import settingsRouter from './discord/settings.js';
import draftsRouter from './discord/drafts.js';
import messageParseRouter from './discord/messageParse.js';
import messagesRouter from './discord/messages.js';
import parseBatchRouter from './discord/parse-batch.js';
import discoveryRouter from './discord/discovery.js';
import fetchRouter from './discord/fetch.js';
import sourcesRouter from './discord/sources.js';

import correctionRouter from './discord/corrections.js';
import metricsRouter from './discord/metrics.js';
import automationRouter from './discord/automation.js';
import chatExporterAutomationRouter from './discord/chatExporterAutomation.js';
import duplicatesRouter, { duplicatesRouter as duplicateCandidatesRouter } from './discord/duplicates.js';

const router = Router();

router.use('/discovery', discoveryRouter);
router.use('/', fetchRouter);
router.use('/sources', sourcesRouter);
router.use('/settings', settingsRouter);
router.use('/drafts', draftsRouter);
router.use('/drafts', correctionRouter);
router.use('/drafts', duplicatesRouter);
router.use('/duplicate-candidates', duplicateCandidatesRouter);
router.use('/messages', messageParseRouter);
router.use('/messages', parseBatchRouter);
router.use('/messages', messagesRouter);
router.use('/', syncRouter);
router.use('/import-json', previewRouter);
router.use('/import-json', importRouter);
router.use('/metrics', metricsRouter);
router.use('/automation', automationRouter);
router.use('/chat-exporter', chatExporterAutomationRouter);

export default router;
