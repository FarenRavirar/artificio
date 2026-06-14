import type { SubmitFeedbackPayload } from '@artificio/ui/feedback';
import api from '../../services/api';

/**
 * POST público de feedback (Spec 021). baseURL do axios já termina em `/api`,
 * então o caminho efetivo é `/api/feedback`. Anônimo permitido; cookie SSO
 * (se houver) vai junto via `withCredentials`.
 */
export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<{ id: string }> {
  const res = await api.post<{ data: { id: string } }>('/feedback', payload);
  return res.data.data;
}
