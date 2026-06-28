import { createCorrectionHandler } from '../discord/utils';

// REV-016 onda 3: handler compartilhado com discord/corrections.ts
export default createCorrectionHandler('/api/v1/admin/import/drafts/:id/correction');
