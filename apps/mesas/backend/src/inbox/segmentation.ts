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
// <nome do cargo> — <timestamp>". Sem tratar isso como fronteira,
// `splitBySeparators`/`splitByHeaders` juntavam 22 anúncios reais em só 2
// segmentos (linhas de header viravam texto solto que quebrava o parser de
// label). A linha de header inteira é removida do resultado — é metadado do
// chat export, não conteúdo do anúncio.
//
// Achado real (fixture completa de 1030 linhas/32 anúncios, teste no disco
// D:\texto_colado.txt) + correção de princípio (o produto lida com texto de
// comunidades/templates infinitamente variados — qualquer lista fechada de
// valores "conhecidos" aqui é um bug latente pro próximo template real que
// aparecer, não só um detalhe deste dataset):
// 1. Nome do cargo (era hardcoded "Narradores") é config livre por servidor
//    Discord — a mesma fixture já tem "Narradores" E "Aventureiros". O
//    marcador fixo real é só "Ícone de cargo," + " — " + timestamp; o nome
//    do cargo entre eles é sempre capturado como `.+`, nunca uma lista fixa.
// 2. Timestamp também não é só "HH:MM" nu — o cliente Discord mostra
//    "Ontem às HH:MM"/"Hoje às HH:MM" pra mensagens de dias anteriores, e
//    "DD/MM/AAAA às HH:MM" pra mais antigas. Modelado como "qualquer texto
//    até o HH:MM final" em vez de enumerar os prefixos conhecidos — mesma
//    lógica: o formato de prefixo de data é decisão do cliente Discord/locale
//    do usuário, não uma lista fechada que este parser deva memorizar.
const AUTHOR_HEADER_RE = /^.*Ícone de cargo,\s*.+\s*—\s*.*?\d{1,2}:\d{2}\s*$/gm;

function splitByAuthorHeader(rawText: string): string[] {
  const headerMatches = rawText.match(AUTHOR_HEADER_RE);
  if (!headerMatches || headerMatches.length < 2) return [];

  const parts = rawText.split(AUTHOR_HEADER_RE);
  // Achado de review (CodeRabbit, PR #172): `.slice(1)` incondicional
  // assumia que o export sempre começa com um header — descartava texto real
  // quando o mantenedor colava um trecho parcial (export cortado no meio, ou
  // com texto de contexto antes do primeiro autor). O filtro por
  // MIN_SEGMENT_CHARS já existe abaixo pra descartar lixo/vazio; não precisa
  // de slice cego em cima disso.
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SEGMENT_CHARS);
}

// Achado de review (Codex, PR #172): colar UMA mensagem só (1 header) cai no
// fallback abaixo sem remover a linha de header — como parseTextForPreview só
// usa segments[0], o metadado de autor vazava pro início do anúncio e
// contaminava o parser. Remove a linha de header único antes de continuar,
// mesmo sem split (não é fronteira de múltiplos anúncios, é lixo de export).
function stripSingleAuthorHeader(rawText: string): string {
  return rawText.replace(AUTHOR_HEADER_RE, '').trim();
}

// Achado real (fixture completa, 33 anúncios): o cliente Discord injeta uma
// linha "Imagem" sozinha (sem decoração) no export de texto quando a
// mensagem original tinha um anexo de imagem — é placeholder de attachment
// do export, aparece em ~30 dos 33 anúncios reais da fixture, sempre logo
// antes do header do próximo autor ou no fim do texto. Diferente de um LABEL
// real de template como "▬ Imagem ▬" (que É conteúdo do anúncio, algum
// template usa isso como campo — visto na própria fixture, linha 143) — a
// distinção é decoração: só a linha *sem* qualquer marcador (bullet/▬/emoji)
// e cujo conteúdo é EXATAMENTE a palavra "Imagem" é ruído de export a
// remover. Qualquer variação com decoração ao redor é tratada como
// label/conteúdo real do template (mesmo princípio de não hardcodar demais:
// aqui a distinção é estrutural — literal do client Discord — não uma lista
// de templates conhecidos).
const IMAGE_ATTACHMENT_PLACEHOLDER_RE = /^Imagem$/gm;

function stripImageAttachmentPlaceholders(rawText: string): string {
  return rawText.replace(IMAGE_ATTACHMENT_PLACEHOLDER_RE, '').trim();
}

export function segmentAnnouncements(rawText: string): string[] {
  const trimmedRaw = rawText.trim();
  if (!trimmedRaw) return [];

  // Removido antes de QUALQUER estratégia de split rodar — é ruído de export
  // do client Discord (placeholder de attachment), não conteúdo de anúncio
  // nem fronteira de segmento; nenhuma das 4 estratégias abaixo deveria vê-lo.
  const trimmed = stripImageAttachmentPlaceholders(trimmedRaw);
  if (!trimmed) return [];

  const byAuthorHeader = splitByAuthorHeader(trimmed);
  if (byAuthorHeader.length > 1) return byAuthorHeader;

  const withoutSingleHeader = stripSingleAuthorHeader(trimmed);
  const bySeparators = splitBySeparators(withoutSingleHeader);
  if (bySeparators.length > 1) return bySeparators;

  const byHeaders = splitByHeaders(withoutSingleHeader);
  if (byHeaders.length > 1) return byHeaders;

  return [withoutSingleHeader].filter((s) => s.length >= MIN_SEGMENT_CHARS);
}
