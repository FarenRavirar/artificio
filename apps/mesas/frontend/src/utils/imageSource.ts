/**
 * Validação de src de imagem antes de renderizar em <img>.
 *
 * Dados legados podem guardar um `data:image/...;base64,...` malformado
 * (truncado, com quebra de linha, sem vírgula) no lugar de uma URL Cloudinary.
 * Esses valores disparam `net::ERR_INVALID_URL` no navegador e poluem o
 * console em todo render. Imagens no Artifício devem ser URLs http(s) do
 * Cloudinary; data-urls inline só passam se forem base64 bem formados.
 */

// data:image/<mime>;base64,<base64 sem whitespace>
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isUsableImageSrc(src?: string | null): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  // Whitespace interno (quebra de linha, espaço) => valor corrompido.
  if (/\s/.test(trimmed)) return false;
  if (trimmed.startsWith('data:')) {
    return DATA_URL_RE.test(trimmed);
  }
  return true;
}

/** Retorna o src se utilizável, senão o fallback informado. */
export function safeImageSrc(
  src: string | null | undefined,
  fallback: string
): string {
  return isUsableImageSrc(src) ? src.trim() : fallback;
}
