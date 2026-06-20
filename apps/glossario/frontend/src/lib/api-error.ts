// Extrai a mensagem de erro de uma resposta axios (`response.data.message` ou
// `.error`) sem usar `any`. Narrowing seguro sobre `unknown`.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: unknown }).response;
    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      if (data && typeof data === 'object') {
        const d = data as { message?: unknown; error?: unknown };
        if (typeof d.message === 'string' && d.message) return d.message;
        if (typeof d.error === 'string' && d.error) return d.error;
      }
    }
  }
  return fallback;
}
