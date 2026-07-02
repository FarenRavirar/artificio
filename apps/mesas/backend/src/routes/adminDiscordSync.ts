import { Router } from 'express';

import previewRouter from './discord/preview';
import importRouter from './discord/import';
import syncRouter from './discord/sync';
import settingsRouter from './discord/settings';
import draftsRouter from './discord/drafts';
import messageParseRouter from './discord/messageParse';
import messagesRouter from './discord/messages';
import parseBatchRouter from './discord/parse-batch';
import discoveryRouter from './discord/discovery';
import fetchRouter from './discord/fetch';
import sourcesRouter from './discord/sources';

import correctionRouter from './discord/corrections';
import metricsRouter from './discord/metrics';
import automationRouter from './discord/automation';
import chatExporterAutomationRouter from './discord/chatExporterAutomation';
import duplicatesRouter, { duplicatesRouter as duplicateCandidatesRouter } from './discord/duplicates';

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
