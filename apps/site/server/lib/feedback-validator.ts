// Validador/normalizador de payload de feedback (Spec 021).
// Re-export de @artificio/feedback (fonte única — spec 042).
// Mantido neste path para compatibilidade com imports existentes.

export {
  FEEDBACK_LIMITS,
  parseFeedbackInput,
} from '@artificio/feedback';

export type {
  FeedbackKind,
  ConsoleErrorEntry,
  NetworkErrorEntry,
  NormalizedFeedback,
  ParseResult,
} from '@artificio/feedback';

/** Decodifica um data URI de imagem em buffer + extensão (.jpg/.png/.webp) para storeUpload. */
export function decodeScreenshotDataUri(dataUri: string): { buffer: Buffer; ext: string } | null {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUri);
  if (!m) return null;
  const kind = m[1] === "jpg" ? "jpeg" : m[1];
  const ext = kind === "jpeg" ? ".jpg" : `.${kind}`;
  try {
    return { buffer: Buffer.from(m[2]!, "base64"), ext };
  } catch {
    return null;
  }
}
