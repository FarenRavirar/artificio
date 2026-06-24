// D20-P1 — Re-export do wrapper unificado em apiClient.ts.
// O código real (refresh-on-401 + retry exp backoff + dedup) está em services/apiClient.ts.
// Este arquivo existe para não quebrar consumers existentes que importam de utils/authenticatedFetch.

export {
  authenticatedFetch,
  authGet,
  authPost,
  authPut,
  authPatch,
  authDelete,
} from '../services/apiClient';
