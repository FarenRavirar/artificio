const MIN_SEGMENT_CHARS = 10;

function splitBySeparators(rawText: string): string[] {
  const separatorPattern = /(?:\r?\n\s*[-=*]{3,}\s*\r?\n)|(?:\r?\n\s*[▬]{3,}\s*\r?\n)/;
  const segments = rawText.split(separatorPattern).map((s) => s.trim()).filter((s) => s.length >= MIN_SEGMENT_CHARS);
  return segments;
}

function splitByHeaders(rawText: string): string[] {
  // Somente marcadores que indicam com seguranca o inicio de outro anuncio.
  // Campos internos como "Sistema:" e "Jogo:" nao podem causar split.
  const headerPattern = /(?:\r?\n)(?=(?:T[ií]tulo|Mesa|#[^\n]+)\s*[:：])/i;
  const segments = rawText.split(headerPattern).map((s) => s.trim()).filter((s) => s.length >= MIN_SEGMENT_CHARS);
  return segments;
}

export function segmentAnnouncements(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const bySeparators = splitBySeparators(trimmed);
  if (bySeparators.length > 1) return bySeparators;

  const byHeaders = splitByHeaders(trimmed);
  if (byHeaders.length > 1) return byHeaders;

  return [trimmed].filter((s) => s.length >= MIN_SEGMENT_CHARS);
}
