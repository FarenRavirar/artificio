const MIN_SEGMENT_CHARS = 10;

// Bug real reportado pelo mantenedor (2026-07-16, anúncio "A CENSURA", tela
// /gestao/importacao → Importar texto): template da comunidade usa "▬▬▬" como
// separador visual DENTRO de um único anúncio (entre "Sinopse" e "Inscrições"),
// não como divisor entre dois anúncios. Tratar qualquer "▬▬▬" como fronteira de
// segmento cortava o anúncio em 2 drafts — um sem o campo de contato (ficou na
// metade descartada), outro cujo único conteúdo era a linha de inscrição (virava
// título via fallback body.split('\n')[0]). "-=*" nunca teve esse relato porque
// não é usado como decoração inline pelos templates reais vistos até agora —
// mantido sem a guarda abaixo para não alterar comportamento já coberto por teste.
// Guarda: só é fronteira real de anúncio quando o texto GRUDADO logo após o
// separador começa com um rótulo típico de início de anúncio novo.
const NEW_ANNOUNCEMENT_START_RE = /^\s*(?:t[ií]tulo|mesa|sistema)\s*[:：]/i;

// Captura o tipo de separador em cada split point (grupo 1 = "-=*", grupo 2 =
// "▬") pra decidir o merge por tipo — achado de review (Codex, PR #172): um
// regex único sem essa distinção tratava "---"/"==="/"***" com a mesma guarda
// de "▬", mesclando indevidamente anúncios reais separados por eles quando o
// próximo começava com nome de campanha/"Jogo:"/heading em vez de "Título:".
const SEPARATOR_SPLIT_RE = /\r?\n\s*(?:([-=*]{3,})|([▬]{3,}))\s*\r?\n/;

function splitBySeparators(rawText: string): string[] {
  const parts: string[] = [];
  const separatorTypes: Array<'dash' | 'block'> = [];
  let rest = rawText;
  let match: RegExpMatchArray | null;
  while ((match = rest.match(SEPARATOR_SPLIT_RE))) {
    parts.push(rest.slice(0, match.index));
    separatorTypes.push(match[1] ? 'dash' : 'block');
    rest = rest.slice((match.index ?? 0) + match[0].length);
  }
  parts.push(rest);

  if (parts.length <= 1) return parts.map((s) => s.trim()).filter((s) => s.length >= MIN_SEGMENT_CHARS);

  // "-=*" sempre foi fronteira real de anúncio (comportamento já coberto por
  // teste). "▬" só é fronteira quando o texto seguinte começa com rótulo
  // típico de início de anúncio novo — senão é decoração inline (bug real,
  // ver comentário acima da regex).
  const merged: string[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const isDashSeparator = separatorTypes[i - 1] === 'dash';
    if (isDashSeparator || NEW_ANNOUNCEMENT_START_RE.test(parts[i])) {
      merged.push(parts[i]);
    } else {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n${parts[i]}`;
    }
  }
  return merged.map((s) => s.trim()).filter((s) => s.length >= MIN_SEGMENT_CHARS);
}

function splitByHeaders(rawText: string): string[] {
  // Somente marcadores que indicam com seguranca o inicio de outro anuncio.
  // Campos internos como "Sistema:" e "Jogo:" nao podem causar split.
  const headerPattern = /(?:\r?\n)(?=(?:T[ií]tulo|Mesa|#[^\n]+)\s*[:：])/i;
  const segments = rawText.split(headerPattern).map((s) => s.trim()).filter((s) => s.length >= MIN_SEGMENT_CHARS);
  return segments;
}

// Achado real (spec 079, 2026-07-16): mantenedor colou histórico inteiro de
// canal Discord (múltiplos anúncios de autores diferentes numa cola só, não
// um anúncio isolado). Cada mensagem no export copiado do cliente Discord tem
// uma linha de cabeçalho de autor no formato "Nome [tag], Ícone de cargo,
// Narradores — HH:MM" (tag/tudo antes de "Ícone de cargo" varia; o marcador
// fixo é a string "Ícone de cargo, Narradores —"). Sem tratar isso como
// fronteira, `splitBySeparators`/`splitByHeaders` juntavam 22 anúncios reais
// em só 2 segmentos (linhas de header viravam texto solto que quebrava o
// parser de label). A linha de header inteira é removida do resultado — é
// metadado do chat export, não conteúdo do anúncio.
const AUTHOR_HEADER_RE = /^.*Ícone de cargo, Narradores\s*—\s*\d{1,2}:\d{2}\s*$/gm;

function splitByAuthorHeader(rawText: string): string[] {
  const headerMatches = rawText.match(AUTHOR_HEADER_RE);
  if (!headerMatches || headerMatches.length < 2) return [];

  const parts = rawText.split(AUTHOR_HEADER_RE);
  // primeiro elemento é o que vem ANTES do primeiro header (lixo/vazio na
  // prática, já que o export sempre começa com um header) — descarta.
  return parts
    .slice(1)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SEGMENT_CHARS);
}

export function segmentAnnouncements(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const byAuthorHeader = splitByAuthorHeader(trimmed);
  if (byAuthorHeader.length > 1) return byAuthorHeader;

  const bySeparators = splitBySeparators(trimmed);
  if (bySeparators.length > 1) return bySeparators;

  const byHeaders = splitByHeaders(trimmed);
  if (byHeaders.length > 1) return byHeaders;

  return [trimmed].filter((s) => s.length >= MIN_SEGMENT_CHARS);
}
