import type { CoverQuality, ImportRawMessage, DiscordSlotsAmbiguity, ImportTableDraft, DiscordTableDraftTable, TableDraftType, TableDraftModality, TableDraftPriceType, TableDraftFrequency, TableDraftAgeRating } from './types';

export interface SystemEntry {
  id: string;
  name: string;
  name_pt: string | null;
  aliases: string[];
}

interface SystemMatchResult {
  system: SystemEntry;
  notes: string[];
}

/**
 * Fase A (spec 058): entrada genérica de matching contra banco de referência
 * (nome + aliases), sem os conceitos específicos de sistema (name_pt, versão/edição).
 * `SystemEntry` continua sendo o tipo usado pra sistema (mais rico); `MatchEntry` é o
 * shape mínimo reusado por VTT/plataforma de comunicação, que só têm nome/slug no banco.
 */
export interface MatchEntry {
  id: string;
  name: string;
  aliases: string[];
}

// Extrai texto dos embeds Discord quando content_raw está vazio
function extractBodyFromEmbeds(embeds: unknown[]): string {
  if (!embeds || embeds.length === 0) return '';
  const parts: string[] = [];
  for (const embed of embeds) {
    if (typeof embed !== 'object' || embed === null) continue;
    const e = embed as Record<string, unknown>;
    if (typeof e.description === 'string' && e.description.trim()) {
      parts.push(e.description.trim());
    }
    if (Array.isArray(e.fields)) {
      for (const field of e.fields) {
        if (typeof field === 'object' && field !== null) {
          const f = field as Record<string, unknown>;
          if (typeof f.name === 'string' && typeof f.value === 'string') {
            parts.push(`${f.name}: ${f.value}`);
          }
        }
      }
    }
  }
  return parts.join('\n');
}

function readStringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field.trim() : null;
}

function readNumberField(value: Record<string, unknown>, key: string): number | null {
  const field = value[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
}

interface CoverCandidate {
  url: string;
  width: number;
  height: number;
  size: number;
}

/** Extrai um candidato a capa de um attachment, ou null se não for imagem válida. */
function readCoverCandidate(attachment: unknown): CoverCandidate | null {
  if (typeof attachment !== 'object' || attachment === null) return null;
  const record = attachment as Record<string, unknown>;

  // Tentar content_type primeiro (formato bot-fetch) — compat retroativa
  const contentType = readStringField(record, 'content_type')?.toLowerCase() ?? '';
  // Fallback: extensão do filename (ChatExporter usa `filename`; bot-fetch, `fileName`)
  const fileName = (readStringField(record, 'filename') ?? readStringField(record, 'fileName'))?.toLowerCase() ?? '';

  // É imagem? Checar content_type OU extensão
  const isImageByContentType = contentType.startsWith('image/') && contentType !== 'image/svg+xml';
  const isImageByExt = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileName);

  if (!isImageByContentType && !isImageByExt) return null;
  if (contentType === 'image/svg+xml' || fileName.endsWith('.svg')) return null;

  const url = readStringField(record, 'url');
  if (!url) return null;

  return {
    url,
    width: readNumberField(record, 'width') ?? 0,
    height: readNumberField(record, 'height') ?? 0,
    size: readNumberField(record, 'size') ?? readNumberField(record, 'fileSizeBytes') ?? 0,
  };
}

function extractCoverFromAttachments(attachments: unknown[]): { url: string; quality: CoverQuality } | null {
  const candidates: CoverCandidate[] = [];
  for (const attachment of attachments) {
    const candidate = readCoverCandidate(attachment);
    if (candidate) candidates.push(candidate);
  }
  if (candidates.length === 0) return null;

  // Banner: priorizar o mais "deitado" (maior razão largura/altura). Anúncios com
  // 2+ imagens (capa retrato + banner paisagem) devem usar o banner. Empate/sem
  // dimensão → mantém a ordem original (primeira imagem do post). Razão 1 (quadrado)
  // ou <1 (retrato) perde para qualquer paisagem (>1).
  const aspect = (c: CoverCandidate) => (c.width > 0 && c.height > 0 ? c.width / c.height : 0);
  // initial value explícito (candidates.length > 0 garantido acima) — REV-040.
  const cover = candidates.reduce((best, c) => (aspect(c) > aspect(best) ? c : best), candidates[0]);

  // ChatExporter/bot-fetch: width >= 800 && size >= 50000 → 'standard'; senão 'low'.
  const quality: CoverQuality = cover.width >= 800 && cover.size >= 50000 ? 'standard' : 'low';
  return { url: cover.url, quality };
}

/** Formata bytes em string legível (MB/KB/B), ou desconhecido se ausente. */
function formatAttachmentSize(bytes: number | null): string {
  if (!bytes) return 'tamanho desconhecido';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const COVER_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/** Gera notas para anexos não-imagem (vídeo, arquivo grande, .txt, etc.). */
function buildAttachmentNotes(attachments: unknown[]): string[] {
  const notes: string[] = [];
  for (const att of attachments) {
    if (typeof att !== 'object' || att === null) continue;
    const a = att as Record<string, unknown>;
    const fileName = readStringField(a, 'fileName') ?? readStringField(a, 'filename');
    const url = readStringField(a, 'url');
    if (!fileName || !url) continue;

    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    // Já tratado como cover? Pular
    if (COVER_IMAGE_EXTENSIONS.has(ext)) continue;

    const sizeStr = formatAttachmentSize(readNumberField(a, 'fileSizeBytes'));
    notes.push(`Anexo: ${fileName} (${sizeStr}) — ${url}`);
  }
  return notes;
}

function buildRawEvidence(
  text: string,
  attachments: unknown[],
  embeds: unknown[],
): NonNullable<DiscordTableDraftTable['_raw_evidence']> | null {
  const roleMentions = Array.from(new Set(Array.from(text.matchAll(/<@&(\d+)>/g), (m) => `<@&${m[1]}>`)));
  const userMentions = Array.from(new Set(Array.from(text.matchAll(/<@!?(\d+)>/g), (m) => `<@${m[1]}>`)));
  const attachmentEvidence = attachments.flatMap((att) => {
    if (typeof att !== 'object' || att === null) return [];
    const a = att as Record<string, unknown>;
    const url = readStringField(a, 'url');
    if (!url) return [];
    return [{
      file_name: readStringField(a, 'fileName') ?? readStringField(a, 'filename'),
      url,
    }];
  });
  const embedEvidence = embeds.flatMap((embed) => {
    if (typeof embed !== 'object' || embed === null) return [];
    const e = embed as Record<string, unknown>;
    const title = readStringField(e, 'title');
    const url = readStringField(e, 'url');
    if (!title && !url) return [];
    return [{ title, url }];
  });

  const evidence: NonNullable<DiscordTableDraftTable['_raw_evidence']> = {};
  if (roleMentions.length > 0) evidence.role_mentions = roleMentions;
  if (userMentions.length > 0) evidence.user_mentions = userMentions;
  if (attachmentEvidence.length > 0) evidence.attachments = attachmentEvidence;
  if (embedEvidence.length > 0) evidence.embeds = embedEvidence;
  return Object.keys(evidence).length > 0 ? evidence : null;
}

// Remove sufixo ™ / ® de strings
function cleanTrademark(s: string): string {
  return s.replace(/[™®]/g, '').trim();
}

// Normaliza string para comparação: remove acentos, lowercase, colapsa espaços
function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta o sistema a partir do texto usando a lista de sistemas do banco.
 * Testa: name, name_pt e todos os aliases de cada entrada.
 * Retorna o primeiro match encontrado.
 */
function stripVersionSuffix(value: string): { stripped: string; version: string | null } {
  // Ancora a versão no fim por um único espaço — evita `(.*?)\s+` (backtracking,
  // `.` sobrepõe `\s`). A alternação antiga `(\d+...e?)|(\d+e)` era redundante.
  const trimmed = value.trim();
  const match = /\s(\d+(?:\.\d+)?e?)$/i.exec(trimmed);
  if (!match) return { stripped: value, version: null };
  const stripped = trimmed.slice(0, match.index).trim();
  const version = match[1].trim();
  if (!stripped) return { stripped: value, version: null };
  return { stripped, version };
}

/**
 * Fase A (spec 058): motor genérico de matching contra banco de referência (nome +
 * aliases), reusado por sistema/VTT/comunicação. `getNames(entry)` extrai os candidatos
 * de nome com prioridade (sistema tem name+name_pt+aliases; VTT/comunicação só nome).
 */
type CandidateName = { value: string | null; priority: number };

function candidateMatchesText(normCandidate: string, normText: string): boolean {
  const escaped = normCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|[\\s,;:])${escaped}(?:[\\s,;:]|$)`);
  const versionedPattern = new RegExp(`^${escaped}\\s*\\d`);
  return normText === normCandidate || pattern.test(` ${normText} `) || versionedPattern.test(normText);
}

type CandidateMatch<T> = { entry: T; candidate: string; priority: number; exact: boolean };
type CandidateFound = Omit<CandidateMatch<unknown>, 'entry'>;

function collectEntryMatches(
  candidates: CandidateName[],
  normText: string,
  allowShortAliases: boolean,
): CandidateFound[] {
  const found: CandidateFound[] = [];
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const normCandidate = normalize(candidate.value);
    // Aliases curtos e genericos como "D&D" aparecem em sistemas derivados
    // no banco; usar isso como match automatico gera falsos positivos.
    if (!allowShortAliases && normCandidate.length < 4 && candidate.priority < 3) continue;
    if (normCandidate.length < 2) continue;
    if (!candidateMatchesText(normCandidate, normText)) continue;
    found.push({ candidate: normCandidate, priority: candidate.priority, exact: normText === normCandidate });
  }
  return found;
}

/** Fase A (spec 058): motor genérico de matching contra banco de referência (nome +
 * aliases), reusado por sistema/VTT/comunicação. `getNames(entry)` extrai os candidatos
 * de nome com prioridade (sistema tem name+name_pt+aliases; VTT/comunicação só nome). */
function findEntryMatch<T>(
  text: string,
  entries: T[],
  getNames: (entry: T) => CandidateName[],
  allowShortAliases = false,
): T | null {
  const normText = normalize(text);
  if (!normText) return null;

  const matches: CandidateMatch<T>[] = [];
  for (const entry of entries) {
    for (const found of collectEntryMatches(getNames(entry), normText, allowShortAliases)) {
      matches.push({ entry, ...found });
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.candidate.length - a.candidate.length;
  });
  return matches[0].entry;
}

function findSystemMatch(text: string, systems: SystemEntry[], allowShortAliases = false): SystemEntry | null {
  return findEntryMatch(
    text,
    systems,
    (system) => [
      { value: system.name, priority: 3 },
      ...(system.name_pt ? [{ value: system.name_pt, priority: 3 }] : []),
      ...system.aliases.map((alias) => ({ value: alias, priority: 1 })),
    ],
    allowShortAliases,
  );
}

/** Fase A (spec 058): matching de VTT/plataforma de comunicação — só nome+aliases, sem edição/versão. */
function findPlatformMatch(text: string, entries: MatchEntry[]): MatchEntry | null {
  return findEntryMatch(
    text,
    entries,
    (entry) => [
      { value: entry.name, priority: 3 },
      ...entry.aliases.map((alias) => ({ value: alias, priority: 1 })),
    ],
    true,
  );
}

function matchSystem(text: string, systems: SystemEntry[]): SystemMatchResult | null {
  const { stripped, version } = stripVersionSuffix(text);
  if (version && stripped !== text) {
    const strippedMatch = findSystemMatch(stripped, systems, true);
    if (strippedMatch) {
      return { system: strippedMatch, notes: [`version_mismatch:${version}`] };
    }
  }

  const direct = findSystemMatch(text, systems);
  if (direct) return { system: direct, notes: [] };
  return null;
}

// Tenta extrair "sistema: titulo" do nome do thread
function splitThreadName(threadName: string): { systemHint: string | null; title: string } {
  const colonIdx = threadName.indexOf(':');
  if (colonIdx > 0 && colonIdx < threadName.length - 2) {
    const beforeColon = cleanTrademark(stripDecorativeMarkup(threadName.slice(0, colonIdx).trim()));
    const afterColon = cleanTrademark(stripDecorativeMarkup(threadName.slice(colonIdx + 1).trim()));
    if (beforeColon.length > 0 && afterColon.length > 0) {
      return { systemHint: beforeColon, title: afterColon };
    }
  }
  return { systemHint: null, title: cleanTrademark(stripDecorativeMarkup(threadName)) };
}

// Extrai modalidade do texto
function extractModality(text: string): TableDraftModality | null {
  const lower = text.toLowerCase();
  if (/\bpresencial\b/.test(lower)) return 'presencial';
  if (/\bh[íi]brida?\b|\bonline\s*e\s*presencial\b/.test(lower)) return 'hibrida';
  if (/\bonline\b/.test(lower)) return 'online';
  return null;
}

// Extrai tipo de campanha do texto
function extractType(text: string): TableDraftType | null {
  const lower = text.toLowerCase();
  if (/\bone[\s-]?shot\b/.test(lower)) return 'one-shot';
  if (/\bcampanha\b/.test(lower)) return 'campanha';
  if (/\baberta\b|\bdrop[\s-]?in\b/.test(lower)) return 'aberta';
  return null;
}

// Extrai informações de preço do texto
function extractPrice(text: string): { priceType: TableDraftPriceType | null; priceValue: number | null } {
  const priceMatch = /R\$\s{0,3}(\d+(?:[,.]\d{1,2})?)(?!\d)/i.exec(text)
    ?? /(\d+(?:[,.]\d{1,2})?)(?!\d)\s{0,3}(?:R\$|reais)/i.exec(text);
  if (priceMatch) {
    const value = parseFloat(priceMatch[1].replace(',', '.'));
    if (!Number.isNaN(value) && value > 0) {
      return { priceType: 'paga', priceValue: value };
    }
  }
  const lower = text.toLowerCase();
  // Gratuita antes de paga: "valor: gratuito", "não é paga" e "mesa gratuita"
  // baterem primeiro no regex de paga (pag[ao]/valor) e nunca chegarem no ramo
  // gratuito. Também detecta negação explícita ("não é pago", "sem valor").
  if (/\bgratuit[oa]s?\b|\bfree\b|\bsem\s+(?:custo|valor|pagamento|mensalidade)\b|\bn[aã]o\s+[ée]\s+pag[ao]\b/.test(lower)) {
    return { priceType: 'gratuita', priceValue: null };
  }
  if (/\b(?:mesa\s+)?pag[ao]\b|\bvalor\s*:|\bpagamento\b|\bmensalidade\b|\bpor\s+sess[aã]o\b/.test(lower)) {
    return { priceType: 'paga', priceValue: null };
  }
  return { priceType: null, priceValue: null };
}

// Extrai número de vagas do texto
type SlotsResult = { total: number | null; open: number | null; ambiguity: DiscordSlotsAmbiguity | null };

// Regex compiladas uma vez (sem /g → exec é stateless). Os padrões com lista de
// bullets usam `[\s▬•\-–—]*` (sem `\s*` antes) para evitar backtracking super-linear.
// Quantificadores de espaço LIMITADOS (\s{0,3}/\s{1,3}) — eliminam backtracking
// super-linear (S5852). A alternação de RE_SLOT_LABELED usa "vagas(?: dispon…)?"
// para não ter prefixo "vagas" sobreposto a "vagas disponíveis".
// Fragmentos reutilizáveis das regex de vaga (DRY — mudança de espaço/limite num
// lugar só). `D` = captura de dígito ATÔMICA via `(?!\d)`: impede backtracking do
// `\d+` (elimina super-linear S5852) sem perder a captura do número inteiro.
const D = String.raw`(\d+)(?!\d)`;          // dígitos atômicos
const SP0 = String.raw`\s{0,3}`;            // 0–3 espaços
const SP1 = String.raw`\s{1,3}`;            // 1–3 espaços
const SEP = String.raw`[:=]`;               // separador rótulo:valor
const BULLETS = String.raw`[\s▬•\-–—]{0,8}`; // bullets no começo da linha
const LINE = String.raw`(?:^|\n)`;          // início de linha

const RE_SLOT_VIA_FORMS = new RegExp(`${D}${SP1}vaga${SP1}via${SP1}forms`, 'i');
const RE_SLOT_X_DE_Y = new RegExp(`${D}${SP1}de${SP1}${D}`, 'i');
const RE_SLOT_TOTAL = new RegExp(`vagas?${SP1}(?:totais|total)${SP0}${SEP}${SP0}${D}`, 'i');
const RE_SLOT_OPEN = new RegExp(`vagas?${SP1}(?:dispon[ií]veis|dispon[ií]vel|abertas|aberta)${SP0}${SEP}${SP0}${D}`, 'i');
const RE_SLOT_AMBIG_SLASH = new RegExp(`${LINE}${BULLETS}(?:vagas|jogadores)${SP0}${SEP}${SP0}${D}${SP0}/${SP0}${D}(?!${SP0}vagas?)`, 'i');
const RE_SLOT_LABELED = new RegExp(`${LINE}${BULLETS}(?:vagas(?:${SP1}dispon[ií]veis)?|jogadores)${SP0}${SEP}${SP0}${D}(?!${SP0}/)`, 'i');
const RE_SLOT_SLASH_VAGAS = new RegExp(`${D}${SP0}/${SP0}${D}${SP0}vagas?`, 'i');
const RE_SLOT_N_VAGAS = new RegExp(`${D}${SP0}vagas?`, 'i');
const RE_SLOT_VAGAS_LABEL = new RegExp(`vagas?(?:${SP0}disponíveis?)?${SP0}${SEP}${SP0}${D}`, 'i');

function slotsViaForms(cleaned: string): SlotsResult | null {
  const m = RE_SLOT_VIA_FORMS.exec(cleaned);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return (n >= 0 && n <= 20) ? { total: n, open: n, ambiguity: null } : null;
}

function slotsXdeY(cleaned: string): SlotsResult | null {
  // "X de Y" (ex: "3 de 5 vagas"). Guard: X ≤ Y, 1 ≤ Y ≤ 20 (evita data/nível).
  const m = RE_SLOT_X_DE_Y.exec(cleaned);
  if (!m) return null;
  const first = Number.parseInt(m[1], 10);
  const second = Number.parseInt(m[2], 10);
  return (first <= second && second >= 1 && second <= 20)
    ? { total: second, open: Math.max(0, second - first), ambiguity: null }
    : null;
}

function slotsTotalOpen(cleaned: string): SlotsResult | null {
  const t = RE_SLOT_TOTAL.exec(cleaned);
  const o = RE_SLOT_OPEN.exec(cleaned);
  if (!t && !o) return null;
  const total = t ? Number.parseInt(t[1], 10) : null;
  const open = o ? Number.parseInt(o[1], 10) : total;
  return { total, open, ambiguity: null };
}

function slotsAmbiguousSlash(cleaned: string): SlotsResult | null {
  const m = RE_SLOT_AMBIG_SLASH.exec(cleaned);
  if (!m) return null;
  const first = Number.parseInt(m[1], 10);
  const second = Number.parseInt(m[2], 10);
  return { total: Math.max(first, second), open: null, ambiguity: { first, second, source: 'x_slash_y' } };
}

function slotsLabeled(cleaned: string): SlotsResult | null {
  const m = RE_SLOT_LABELED.exec(cleaned);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return { total: n, open: n, ambiguity: null };
}

function slotsSlashVagas(text: string): SlotsResult | null {
  const m = RE_SLOT_SLASH_VAGAS.exec(text);
  if (!m) return null;
  const filled = Number.parseInt(m[1], 10);
  const total = Number.parseInt(m[2], 10);
  return { total, open: Math.max(0, total - filled), ambiguity: null };
}

function slotsNVagas(text: string): SlotsResult | null {
  const m = RE_SLOT_N_VAGAS.exec(text) ?? RE_SLOT_VAGAS_LABEL.exec(text);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return { total: n, open: n, ambiguity: null };
}

function extractSlots(text: string): SlotsResult {
  const cleaned = text.replace(/\*/g, '');
  // Ordem: padrões explícitos primeiro; "mesa em andamento" (sem padrão explícito)
  // cai no fallback null/null (idêntico ao default) — DEB-048-16.
  return slotsViaForms(cleaned)
    ?? slotsXdeY(cleaned)
    ?? slotsTotalOpen(cleaned)
    ?? slotsAmbiguousSlash(cleaned)
    ?? slotsLabeled(cleaned)
    ?? slotsSlashVagas(text)
    ?? slotsNVagas(text)
    ?? slotsViaLabel(text)
    ?? { total: null, open: null, ambiguity: null };
}

// TC.8/DEB-052-01: fallback por rótulo — pega o valor de labels do template da
// comunidade (decorados são limpos por cleanLabelLine) e extrai o número. Cobre
// variações que as regexes ancoradas em linha perdiam ("» Vagas disponíveis: 5").
function slotsViaLabel(text: string): SlotsResult | null {
  // Rótulos "disponíveis/abertas": o 1º número de X/Y é VAGAS ABERTAS (não
  // preenchidas). Rótulos genéricos/"totais": X/Y = preenchidas/total.
  const openLabelValue = extractLabelValue(text, ['vagas disponiveis', 'vagas disponíveis', 'vagas abertas']);
  const value = openLabelValue ?? extractLabelValue(text, [
    'vagas', 'vagas totais', 'nº de vagas', 'n de vagas',
    'numero de vagas', 'número de vagas', 'lugares', 'jogadores',
  ]);
  if (!value) return null;
  const slash = /(\d+)\s{0,3}\/\s{0,3}(\d+)/.exec(value);
  if (slash) {
    const first = Number.parseInt(slash[1], 10);
    const total = Number.parseInt(slash[2], 10);
    if (!Number.isFinite(total)) return null;
    return { total, open: openLabelValue ? first : Math.max(0, total - first), ambiguity: null };
  }
  const single = /(\d{1,3})/.exec(value);
  if (!single) return null;
  const n = Number.parseInt(single[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // número único sob rótulo "disponíveis" = vagas abertas (total desconhecido)
  return openLabelValue ? { total: null, open: n, ambiguity: null } : { total: n, open: n, ambiguity: null };
}

// Extrai dia da semana do texto
function extractDayOfWeek(text: string): string | null {
  const days: Record<string, string> = {
    segunda: 'segunda', 'segunda-feira': 'segunda',
    terça: 'terça', 'terça-feira': 'terça', terca: 'terça',
    quarta: 'quarta', 'quarta-feira': 'quarta',
    quinta: 'quinta', 'quinta-feira': 'quinta',
    sexta: 'sexta', 'sexta-feira': 'sexta',
    sábado: 'sábado', sabado: 'sábado',
    domingo: 'domingo',
  };
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(days)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

// Extrai horário do texto: "19h", "19:00", "às 20h30"
function extractStartTime(text: string): string | null {
  const match = /\b(\d{1,2})[hH:](\d{0,2})\b/.exec(text)
    ?? /\bàs\s{1,3}(\d{1,2})h(\d{0,2})/i.exec(text);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = (match[2] || '00').padStart(2, '0');
    return `${h}:${m}`;
  }
  return null;
}

// Extrai dia da semana e horário de timestamps Discord <t:UNIX:FORMATO>
// Usa fuso horário América/São Paulo (Brasil), não UTC.
function extractDiscordTimestamp(text: string): { dayOfWeek: string; startTime: string } | null {
  const pattern = /<t:(\d+):([a-zA-Z]+)>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const unix = Number.parseInt(match[1], 10);
    if (!Number.isFinite(unix) || unix <= 0) continue;
    const date = new Date(unix * 1000);
    if (Number.isNaN(date.getTime())) continue;

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? null;
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    if (!weekday) return null;
    // Intl 'long' devolve "segunda-feira"; o canônico do projeto (extractDayOfWeek)
    // é a forma curta "segunda". Normalizar removendo o sufixo "-feira".
    const dayOfWeek = weekday.toLowerCase().replace(/-feira$/, '');
    return { dayOfWeek, startTime: `${hour}:${minute}` };
  }
  return null;
}

function deriveFrequency(type: TableDraftType | null, dayOfWeek: string | null): 'semanal' | null {
  if (type === 'campanha' && dayOfWeek) return 'semanal';
  return null;
}

/** Fase C (spec 058): cadência explícita citada no texto — prioridade sobre o fallback `deriveFrequency`. */
function extractExplicitFrequency(text: string): TableDraftFrequency | null {
  const lower = text.toLowerCase();
  if (/\bquinzenal(?:mente)?\b|\ba\s+cada\s+(?:duas|2)\s+semanas\b|\ba\s+cada\s+15\s+dias\b/.test(lower)) return 'quinzenal';
  if (/\bmensal(?:mente)?\b/.test(lower)) return 'mensal';
  if (/\bavulsa?\b|\bsess[aã]o\s+[uú]nica\b/.test(lower)) return 'avulsa';
  if (/\bsemanal(?:mente)?\b|\btod[ao]\s+semana\b/.test(lower)) return 'semanal';
  return null;
}

/** Fase C (spec 058): classificação indicativa — enum fixo, regex livre no corpo. */
function extractAgeRating(text: string): TableDraftAgeRating | null {
  const lower = text.toLowerCase();
  if (/\+\s?18\b|\b18\s?\+|\bmaiores\s{1,3}de\s{1,3}18\b/.test(lower)) return '18+';
  if (/\+\s?16\b|\b16\s?\+|\bmaiores\s{1,3}de\s{1,3}16\b/.test(lower)) return '16+';
  if (/\+\s?14\b|\b14\s?\+|\bmaiores\s{1,3}de\s{1,3}14\b/.test(lower)) return '14+';
  if (/\+\s?12\b|\b12\s?\+|\bmaiores\s{1,3}de\s{1,3}12\b/.test(lower)) return '12+';
  if (/\+\s?10\b|\b10\s?\+|\bmaiores\s{1,3}de\s{1,3}10\b/.test(lower)) return '10+';
  if (/\bclassifica[cç][aã]o\s{1,3}livre\b|\blivre\s{1,3}para\s{1,3}todos\b/.test(lower)) return 'livre';
  return null;
}

/** Fase C (spec 058): normaliza lista de texto livre separada por `/`, `,` ou "e"/"ou". */
function splitFreeTextList(value: string): string[] | null {
  const parts = value
    .split(/\s*(?:\/|,| e | ou )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}


// Extrai URL de contato (discord invite, forms, etc.)
function extractContactUrl(text: string): string | null {
  const urlMatch = /https?:\/\/[^\s<>"']+/.exec(text);
  return urlMatch ? urlMatch[0] : null;
}

function extractContactDiscord(text: string): string | null {
  const mentionPattern = /<#[0-9]+>|<@!?[0-9]+>/;
  const contactLine = text
    .split(/\r?\n/)
    .find((line) => /\b(contato|ticket|interesse|inscri[cç][aã]o)\b/i.test(line) && mentionPattern.test(line));
  const match = contactLine ? mentionPattern.exec(contactLine) : null;
  return match ? match[0] : null;
}

function cleanLabelLine(line: string): string {
  // DEB-052-01: remover markdown ANTES da decoração (a ordem inversa deixava
  // `▬` órfão em `**▬ label`); classe de bullets ampliada (`»«►▶●…`) + emoji de
  // liderança comuns no template da comunidade, que antes travavam o match de
  // labels já conhecidos (sistema/vagas/data).
  return line
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^[\s▬•\-–—»«►▶◄●○◆◇■□▪▫☆★✦✧➤➥➔→·|]+/u, '')
    .replace(/^[\p{Extended_Pictographic}️\s]+/u, '')
    .replace(/^[\s▬•\-–—»«►▶◄●○◆◇■□▪▫☆★✦✧➤➥➔→·|]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLabelKey(value: string): string {
  return normalize(value).replace(/\s+/g, ' ').trim();
}

function splitLabelLine(line: string): { key: string; value: string } | null {
  const cleaned = cleanLabelLine(line);
  // [^:：] no prefixo evita sobreposição com o separador (sem backtracking).
  const match = /^([^:：]{1,48})\s{0,3}[:：]\s{0,3}(.*)$/.exec(cleaned);
  if (!match) return null;
  const key = normalizeLabelKey(match[1]);
  // DEB-052-01: URLs ("https://…") casam o split como falso label `https`/`http`.
  if (key === 'http' || key === 'https') return null;
  return { key, value: match[2].trim() };
}

function extractHostDiscordId(text: string): string | null {
  const mentionPattern = /<@!?(\d+)>/;
  const hostLabels = new Set(['mestre', 'gm', 'narrador', 'dm']);
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const parsed = splitLabelLine(lines[i]);
    const cleanedKey = parsed?.key ?? normalizeLabelKey(cleanLabelLine(lines[i]).replace(/[:：].*$/, ''));
    if (!hostLabels.has(cleanedKey)) continue;

    const sameLineMatch = mentionPattern.exec(lines[i]);
    if (sameLineMatch) return sameLineMatch[1];

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (splitLabelLine(next)) break;
      const nextMatch = mentionPattern.exec(next);
      if (nextMatch) return nextMatch[1];
      if (!next.trim()) break;
    }
  }

  return null;
}

// Coleta linhas de continuação de um rótulo até linha vazia (com valor) ou novo rótulo.
function collectLabelContinuation(lines: string[], startIdx: number, firstValue: string): string[] {
  const values: string[] = [];
  if (firstValue) values.push(firstValue);

  for (let j = startIdx; j < lines.length; j++) {
    const next = lines[j].trim();
    if (!next) {
      if (values.length > 0) break;
      continue;
    }
    if (splitLabelLine(next)) break;
    // DEB-052-01: linha de URL não é continuação de um valor de rótulo
    // (antes "https:" era falso-rótulo e quebrava aqui; com o guard, evita
    // que a URL seja engolida no valor anterior — ex.: Sistema).
    if (/^https?:\/\//i.test(next)) break;
    values.push(next);
  }
  return values;
}

function extractLabelValue(text: string, labels: string[], opts?: { keepParenthetical?: boolean }): string | null {
  const wanted = new Set(labels.map(normalizeLabelKey));
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const parsed = splitLabelLine(lines[i]);
    let firstValue: string | null | undefined = parsed?.value;
    let continuationStart = i + 1;

    if (!parsed || !wanted.has(parsed.key)) {
      // DEB-058-04: formato "label sozinho na linha, valor na linha seguinte" (sem
      // ':'), comum em anúncios copiados de WordPress/site. Só ativa quando a linha
      // INTEIRA normaliza pra um dos labels conhecidos — não quebra texto livre.
      const wholeLineKey = normalizeLabelKey(cleanLabelLine(lines[i]));
      if (!wanted.has(wholeLineKey)) continue;
      firstValue = null;
      continuationStart = i + 1;
    }

    const values = collectLabelContinuation(lines, continuationStart, firstValue ?? '');

    // keepParenthetical: o parêntese carrega o sinal de autoria ("(Sistema próprio
    // usando D&D...)") que o gate DEB-048-27 precisa. Matching/título usa o corte.
    const joined = values.join('\n');
    // Corta o parêntese de autoria sem regex (evita backtracking S5852).
    const parenIdx = joined.indexOf('(');
    const value = (opts?.keepParenthetical || parenIdx < 0 ? joined : joined.slice(0, parenIdx)).trim();
    if (!value) continue;
    return value;
  }

  return null;
}

// DEB-058-XX: mensagens reais do Discord usam linhas inteiras de caracteres
// decorativos repetidos como separador visual de seção (ex.: uma linha só
// com "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬", ou "━━━━", "═══"). Não são
// pontuação solta dentro de frase — são a LINHA inteira. Remove a linha
// inteira (preserva as demais linhas intactas, com pontuação/emoji de
// frase normal) ANTES do parser extrair qualquer campo e antes de virar
// normalized_text/hash/features em discord_parse_cases (parseLearning.ts).
const SEPARATOR_LINE_CHARS = '▬▭►▶»«━─┃┅┄╍✦═⎯⸻·•~=_\\-*#';
const SEPARATOR_LINE_RE = new RegExp(`^[${SEPARATOR_LINE_CHARS}\\s]{3,}$`);
// Marcador decorativo solto NO INÍCIO de uma linha-de-campo (ex.: "▬ Sistema:
// X", "» Título: Y", "-# nota") — não é linha 100% decorativa (tem dado
// depois), mas o símbolo em si não carrega informação. Remove só o prefixo.
const LEADING_MARKER_RE = new RegExp(`^[${SEPARATOR_LINE_CHARS}]+\\s*`);
// Bloco de 4+ repetições consecutivas do MESMO símbolo decorativo, em
// QUALQUER posição da linha (ex.: "» Título: X ▬▬▬▬▬▬▬▬▬▬▬" — separador colado
// depois do dado, não numa linha própria). Texto natural nunca repete o mesmo
// símbolo decorativo 4x seguidas, então é seguro remover sem regex catastrófico
// (backreference simples, sem alternação aninhada).
const INLINE_SEPARATOR_RUN_RE = new RegExp(`([${SEPARATOR_LINE_CHARS}])\\1{3,}`, 'g');
// Símbolos PURAMENTE gráficos (glifos de caixa/seta/marcador do Discord) —
// diferente de `#`/`*`/`-`/`_`/`=`/`~` (que têm uso legítimo isolado em texto
// normal: hashtag, hífen composto, asterisco de nota, fórmula), estes nunca
// aparecem soltos em português natural. Seguro remover em QUALQUER
// quantidade/posição (ex.: "Imagem ▬" no fim de linha, "▬" solto no meio).
const PURE_GRAPHIC_MARKS_RE = /[▬▭►▶»«━─┃┅┄╍✦═⎯⸻]+/g;
// Roda ANTES de qualquer extração de campo (título/sistema/mentions/host) —
// só toca linha 100% decorativa, o marcador solto no início, blocos de
// repetição inline e glifos puramente gráficos. NÃO mexe em mentions <@id>
// nem em markdown de ênfase (**/~~/`), pois extractHostFromMentions,
// extractRoleAndUserMentions etc. ainda precisam ler esses tokens crus do body.
export function stripSeparatorLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !SEPARATOR_LINE_RE.test(line.trim()) || line.trim().length === 0)
    .map((line) => {
      const trimmed = line.trimStart();
      const withoutMarker = trimmed
        .replace(LEADING_MARKER_RE, '')
        .replace(INLINE_SEPARATOR_RUN_RE, '')
        .replace(PURE_GRAPHIC_MARKS_RE, '');
      const leadingSpace = line.slice(0, line.length - trimmed.length);
      return `${leadingSpace}${withoutMarker}`.replace(/[^\S\n]+$/, '');
    })
    .join('\n');
}

// Markdown de ênfase Discord só quando aparece como PAR real ao redor de texto.
// Não remover `_`/`*`/crase globalmente: isso corrompe slugs/URLs/tokens válidos
// como `inscricao_mesa`, `d_and_d` e links com underscore.
const PAIRED_EMPHASIS_MARKDOWN_RE = /(\*\*|__|~~|`)(\S(?:[\s\S]*?\S)?)\1/g;
const EDGE_EMPHASIS_MARKDOWN_RE = /(^|[\s([{])([*_`~]{1,2})(?=\S)|(?<=\S)([*_`~]{1,2})(?=([\s)\]}.,;:!?]|$))/g;
// Mentions Discord cruas (<@id>, <@&roleId>, <@!id>) viram ID numérico sem
// nome legível quando persistidas em description — não são úteis pra quem lê
// o anúncio da mesa. Preservados à parte em _raw_evidence (role/user_mentions)
// pra quem precisar auditar; aqui só limpa o texto final visível (description),
// DEPOIS que host/mentions/contato já foram extraídos do body cru.
const RAW_MENTION_RE = /<@[!&]?\d+>/g;

export function cleanDescriptionText(text: string): string {
  return text
    .replace(RAW_MENTION_RE, '')
    .replace(PAIRED_EMPHASIS_MARKDOWN_RE, '$2')
    .replace(EDGE_EMPHASIS_MARKDOWN_RE, '$1')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n[^\S\n]+/g, '\n')
    .trim();
}

// DEB-058-XX: campos extraídos (título/sistema) carregam decoração do Discord
// (heading `#`/`-#`, negrito `**`, separadores `▬»━─`, emoji, zero-width/controle)
// que sobrevivia ao parse e ia direto pro draft/learning. Mantém letras (com
// acento)/números/espaço + pontuação presa a palavras de título real
// (apóstrofo, hífen, `&`, `:`); remove decoração solta. Roda ANTES do parser
// consumir o valor e antes de qualquer registro em discord_parse_cases.
function stripDecorativeMarkup(value: string): string {
  const ZERO_WIDTH_AND_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u202A-\u202E\uFEFF\uFFFD]/g;
  const DECORATIVE_MARKS = /[#*_~`\u25AC\u25AD\u25BA\u25B6\u00BB\u00AB\u2501\u2500\u2503\u2505\u2504\u254D\u2726]+/g;
  const WHITELIST = /[^\p{L}\p{N}\s'&:-]/gu;

  return value
    .normalize('NFC')
    // zero-width/BOM/replacement/control chars
    .replace(ZERO_WIDTH_AND_CONTROL, '')
    // emoji e símbolos pictográficos (fora do alfabeto latino+acentos)
    .replace(/\p{Extended_Pictographic}/gu, '')
    // markdown/decoração Discord: headings, ênfase, separadores, marcadores
    .replace(DECORATIVE_MARKS, ' ')
    // whitelist final: letras/acentos/números/espaço + apóstrofo/hífen/&/: presos a palavra
    .replace(WHITELIST, ' ')
    // colapsa espaço/tab repetido mas preserva quebra de linha (getAnnouncementSystemHint
    // e outros callers dependem de `\n` pra pegar só a 1ª linha do valor extraído).
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function normalizeTitle(value: string | null): string | null {
  if (!value) return null;
  const cleaned = stripDecorativeMarkup(value.replace(/^["“”']|["“”']$/g, '').trim());
  return cleanTrademark(cleaned) || null;
}

// Calcula confiança com base nos campos preenchidos
function calcConfidence(table: DiscordTableDraftTable): number {
  const fields: Array<keyof DiscordTableDraftTable> = [
    'title', 'system_name', 'type', 'modality', 'price_type',
    'slots_total', 'day_of_week', 'start_time', 'description',
  ];
  const filled = fields.filter((f) => table[f] != null).length;
  return Math.round((filled / fields.length) * 100) / 100;
}

// T-G1: tiers de confiança para gates comportamentais (thresholds sincronizados com confidenceColor no frontend)
export type ConfidenceTier = 'muito_alta' | 'alta' | 'media' | 'baixa';

export function classifyConfidence(score: number): ConfidenceTier {
  if (score >= 0.85) return 'muito_alta';
  if (score >= 0.65) return 'alta';
  if (score >= 0.4) return 'media';
  return 'baixa';
}

// T-G2: sinais de ambiguidade adicionais
export function isSuspiciousUrl(url: string): boolean {
  // URLs seguras conhecidas: Discord invite, Google Forms, docs.google, typeform, etc.
  const safePatterns = [
    /discord(?:app)?\.com\/invite\//i,
    /discord\.gg\//i,
    /forms\.gle\//i,
    /docs\.google\.com\/forms\//i,
    /typeform\.com\//i,
    /wa\.me\//i,
    /chat\.whatsapp\.com\//i,
    /t\.me\//i,
  ];
  return !safePatterns.some((p) => p.test(url));
}

// DEB-048-27/29: sistema autoral. A plataforma só lista sistemas conhecidos.
// Dois níveis de sinal (DEB-048-29):
//  - STRONG (nítido) → DESCARTAR: "sistema próprio", "autoral", "homebrew", "caseiro".
//  - WEAK (ambíguo)  → REVISÃO com flag "autoral?": "baseado/inspirado/adaptado em".
const RE_HOMEBREW_STRONG = /\b(sistema\s+)?(pr[óo]prio|autoral|homebrew|caseiro)\b/i;
const RE_HOMEBREW_WEAK = /\b(inspirad[oa]|basead[oa]|adaptad[oa])\s+(em|n[oa]|de|d[oa])\b/i;

/** DEB-048-29: classificação de autoria a partir do hint de sistema. */
export type HomebrewClass = 'discard' | 'review' | 'none';

/** Extrai o hint de sistema (campo "Sistema:" ou parte antes do ":" do thread).
 * Só a 1ª linha do valor — `extractLabelValue` agrega linhas de continuação
 * (descrição), e o nome do sistema é a primeira; evita falso-descarte por
 * menção solta de "próprio/autoral" no corpo. */
function getAnnouncementSystemHint(message: ImportRawMessage): string | null {
  const threadName = message.discord_thread_name ?? '';
  const rawBody = message.content_raw ?? '';
  const body = stripSeparatorLines(rawBody.trim() || extractBodyFromEmbeds(message.embeds ?? []));
  if (!body.trim()) return null;
  const explicitSystem = normalizeTitle(extractLabelValue(body, ['sistema', 'jogo', 'rpg'], { keepParenthetical: true }));
  const threadParts = splitThreadName(threadName || body.split('\n')[0] || 'Mesa sem título');
  const hint = explicitSystem ?? threadParts.systemHint;
  return hint ? hint.split(/[\r\n]/)[0].trim() || null : null;
}

/** DEB-048-27: true se o sistema do anúncio é autoral/próprio (→ descartar). */
export function classifyHomebrew(message: ImportRawMessage): HomebrewClass {
  const hint = getAnnouncementSystemHint(message);
  if (hint == null) return 'none';
  if (RE_HOMEBREW_STRONG.test(hint)) return 'discard';
  if (RE_HOMEBREW_WEAK.test(hint)) return 'review';
  return 'none';
}

/** DEB-048-27: true só p/ descarte nítido (STRONG). Mantido p/ retrocompat
 * (processDiscordMessageToDraft conta 'discarded'). Ambíguo NÃO descarta. */
export function isHomebrewSystem(message: ImportRawMessage): boolean {
  return classifyHomebrew(message) === 'discard';
}

/**
 * Parseia uma mensagem Discord importada e retorna um ImportTableDraft.
 *
 * @param message    Mensagem bruta do banco discord_import_messages
 * @param systems    Lista de sistemas+aliases carregada do banco (systems + system_aliases).
 *                   Deve incluir o array `aliases` por sistema (nome + name_pt + alias strings).
 *                   Se omitida, a detecção de sistema não será feita.
 */
export function parseDiscordAnnouncement(
  message: ImportRawMessage,
  systems: SystemEntry[] = [],
  replyContext?: string,
  /** Fase A/B/C (spec 058): bancos de referência opcionais pra VTT/comunicação. */
  platforms?: { vtt?: MatchEntry[]; communication?: MatchEntry[] },
): ImportTableDraft | null {
  const threadName = message.discord_thread_name ?? '';
  const rawBody = message.content_raw ?? '';
  // Fóruns Discord frequentemente colocam o conteúdo em embeds em vez do campo content
  // DEB-058-XX: linhas separadoras de seção (▬▬▬, ━━━, ═══) removidas ANTES de
  // qualquer extração de campo — nunca contaminam título/sistema/descrição/vagas.
  const body = stripSeparatorLines(rawBody.trim() || extractBodyFromEmbeds(message.embeds ?? []));
  // T-F1-05: sem corpo nem texto em embeds não há matéria-prima. Mesmo starters
  // de fórum agora retornam null em vez de fabricar draft a partir só do thread
  // name. Drafts vazios eram a maior fonte de needs_review imutável (spec 016
  // §4 CR-1, anti-regressão de E166).
  if (!body.trim()) {
    return null;
  }
  // DEB-048-27/29: autoria. STRONG (nítido) → descarta. WEAK (ambíguo) → segue
  // como draft, mas marcado _homebrew_suspect → needs_review + badge "autoral?".
  const homebrew = classifyHomebrew(message);
  if (homebrew === 'discard') {
    return null;
  }
  const fullText = `${threadName}\n${body}`.trim();

  // Título e dica de sistema (a partir do nome do thread)
  const threadParts = splitThreadName(threadName || body.split('\n')[0] || 'Mesa sem título');
  const explicitTitle = normalizeTitle(extractLabelValue(body, ['mesa', 'titulo', 'título', 'nome da mesa', 'aventura']));
  const explicitSystem = normalizeTitle(extractLabelValue(body, ['sistema', 'jogo', 'rpg']));
  const systemHint = explicitSystem ?? threadParts.systemHint;
  const title = explicitTitle ?? threadParts.title;

  // Detecção de sistema via banco de dados
  let matchedSystem: SystemMatchResult | null = null;
  if (systems.length > 0) {
    // Tenta primeiro na parte antes do ":" (systemHint) — mais preciso
    if (systemHint) matchedSystem = matchSystem(systemHint, systems);
    // Fallback só quando não há hint forte no nome da thread. Se existe
    // "Sistema: Titulo", buscar no titulo completo gera falso positivo
    // como "Mad Mage" -> sistema "Mage".
    if (!matchedSystem && !systemHint) matchedSystem = matchSystem(fullText, systems);
  }

  const systemName = matchedSystem?.system.name ?? systemHint ?? null;
  const systemId = matchedSystem?.system.id ?? null;
  // Preserva o hint bruto quando não há correspondência: usado para criar
  // system_suggestion automática e para o revisor ver o que veio do Discord.
  const rawSystemHint = (!matchedSystem && systemHint) ? systemHint : null;

  // Campos extraídos do corpo
  const modality = extractModality(body) ?? 'online';
  const type = extractType(fullText) ?? (threadName ? 'campanha' : null);
  const { priceType, priceValue } = extractPrice(body);
  const { total: slotsTotal, open: slotsOpen, ambiguity: slotsAmbiguity } = extractSlots(body);
  // T-C1: Discord timestamp (preferível a texto incidental)
  const discordTs = extractDiscordTimestamp(body);
  const dayOfWeek = discordTs?.dayOfWeek ?? extractDayOfWeek(body);
  const startTime = discordTs?.startTime ?? extractStartTime(body);

  // T-C2: Google Forms URL (prioridade sobre URLs genéricas)
  const googleFormsUrl = /https?:\/\/forms\.gle\/[^\s<>"']+/.exec(body)?.[0]
    ?? /https?:\/\/docs\.google\.com\/forms\/[^\s<>"']+/.exec(body)?.[0];
  const contactUrl = googleFormsUrl ?? extractContactUrl(body);

  const explicitContactDiscord = extractContactDiscord(body);
  let hostDiscordId = extractHostDiscordId(body);

  // DEB-048-26: contato = AUTOR do Discord quando não há contato explícito.
  // Quem publicou o anúncio é o contato padrão. Precedência: forms/url/menção
  // explícita > autor (fallback). Substitui a heurística T-C3 por frase-gatilho.
  const authorContact = message.discord_author_name ?? message.discord_author_id ?? null;
  const contactDiscord = explicitContactDiscord
    ?? (contactUrl ? null : authorContact);
  if (!explicitContactDiscord && !contactUrl && message.discord_author_id) {
    hostDiscordId = hostDiscordId ?? message.discord_author_id;
  }
  const cover = extractCoverFromAttachments(message.attachments ?? []);
  const attachmentNotes = buildAttachmentNotes(message.attachments ?? []);
  const rawEvidence = buildRawEvidence(body, message.attachments ?? [], message.embeds ?? []);
  // DEB-058-XX: description é o texto mais visível na UI de revisão — mentions
  // crus (<@id>) e markdown de ênfase (**/~~/`) sobrevivendo aqui não ajudam
  // quem lê o anúncio. rawEvidence (linha acima) já capturou os mentions do
  // body original antes desta limpeza — nada se perde, só o texto exibido melhora.
  const rawDescription = extractLabelValue(body, ['descricao', 'descrição', 'sinopse', 'proposta']) ?? (body.trim() || null);
  const description = rawDescription ? cleanDescriptionText(rawDescription) || null : null;

  // Fase C (spec 058): cadência explícita no texto ("semanal"/"quinzenal"/"mensal"/
  // "avulsa") tem prioridade sobre o fallback de deriveFrequency. Achado da simulação
  // real: quando cadência é citada mas `type` está null, também confirma type=campanha
  // (regra: só campanha tem cadência recorrente).
  const explicitFrequency = extractExplicitFrequency(fullText);
  const resolvedType = type ?? (explicitFrequency ? 'campanha' : null);

  // Fase C: VTT/plataforma de comunicação — mesmo motor de matching do sistema.
  const platformsLabelValue = extractLabelValue(body, ['plataforma', 'plataformas', 'local do jogo']);
  const vttMatch = platforms?.vtt?.length
    ? findPlatformMatch(platformsLabelValue ?? fullText, platforms.vtt)
    : null;
  const communicationMatch = platforms?.communication?.length
    ? findPlatformMatch(platformsLabelValue ?? fullText, platforms.communication)
    : null;

  // Fase C: classificação indicativa (enum fixo, regex livre no corpo inteiro).
  const ageRating = extractAgeRating(fullText);

  // Fase C: cenário/ambientação e estilos — sempre extraídos juntos (mesmo componente
  // de UI, SettingStylesField). Sem banco de referência — texto livre normalizado.
  const settingStylesLabelValue = extractLabelValue(body, ['estilo', 'indicado']);
  const settingStyles = settingStylesLabelValue ? splitFreeTextList(settingStylesLabelValue) : null;
  const settingName = extractLabelValue(body, ['ambientacao', 'ambientação', 'cenario', 'cenário']);

  // Fase C: requisitos técnicos — menção explícita no corpo (meta-exemplo do
  // mantenedor: "se descrição cita que tem que ter microfone, já temos campo pra isso").
  const requiresPc = /\bs[oó]\s+(?:via|por|de)\s+pc\b|\bobrigat[oó]rio\s+pc\b/i.test(fullText) ? true : null;
  const requiresCamera = /\bc[aâ]mera\s+obrigat[oó]ria\b|\bc[aâ]mera\s+ligada\s+obrigat[oó]ria\b/i.test(fullText) ? true : null;
  const requiresMicrophone = /\b(?:bom\s+)?mic(?:rofone)?\s+obrigat[oó]rio\b|\bobrigat[oó]rio\s+ter\s+microfone\b/i.test(fullText) ? true : null;

  // Fase C: sessão zero gratuita — menção explícita.
  const sessionZeroFree = /\bsess[aã]o\s+zero\s+gratuita\b|\bsess[aã]o\s+zero\s+gr[aá]tis\b/i.test(fullText) ? true : null;

  const missingFields: string[] = [];
  if (!systemId) {
    // Distingue "hint encontrado mas não reconhecido" de "sem pista alguma"
    missingFields.push(rawSystemHint ? 'system_name:unmatched_hint' : 'system_name');
  }
  if (!dayOfWeek) missingFields.push('day_of_week');
  if (!startTime) missingFields.push('start_time');
  if (slotsTotal == null && slotsOpen == null) missingFields.push('slots_total');
  if (!contactUrl && !contactDiscord) missingFields.push('contact_url');
  if (!description) missingFields.push('description');

  // T-G2: ambiguidades adicionais
  if (contactUrl && isSuspiciousUrl(contactUrl)) {
    missingFields.push('contact_url:suspicious');
  }

  const table: DiscordTableDraftTable = {
    title: title || threadName || null,
    system_name: systemName,
    system_id: systemId,
    raw_system_hint: rawSystemHint,
    type: resolvedType,
    modality,
    price_type: priceType,
    price_value: priceValue,
    slots_total: slotsTotal,
    slots_filled: slotsTotal != null && slotsOpen != null ? slotsTotal - slotsOpen : null,
    slots_open: slotsOpen,
    day_of_week: dayOfWeek,
    start_time: startTime,
    frequency: explicitFrequency ?? deriveFrequency(resolvedType, dayOfWeek),
    description,
    contact_discord: contactDiscord,
    contact_url: contactUrl,
    host_discord_id: hostDiscordId,
    scenario_id: null,
    raw_scenario_hint: null,
    vtt_platform_id: vttMatch?.id ?? null,
    communication_platform_id: communicationMatch?.id ?? null,
    age_rating: ageRating,
    setting_name: settingName,
    setting_styles: settingStyles,
    experience_level: null,
    table_level: null,
    requires_pc: requiresPc,
    requires_camera: requiresCamera,
    requires_microphone: requiresMicrophone,
    session_zero_free: sessionZeroFree,
    cover_url: null,
    cover_url_source: cover?.url ?? null,
    cover_quality: cover?.quality ?? null,
    _slots_ambiguity: slotsAmbiguity,
    _homebrew_suspect: homebrew === 'review' ? true : null,
    _raw_evidence: rawEvidence,
    _notes: [
      ...(matchedSystem?.notes ?? []),
      ...(rawEvidence?.role_mentions?.map((mention) => `Role mencionada: ${mention}`) ?? []),
      ...attachmentNotes,
      ...(rawEvidence?.embeds?.map((embed) => `Embed: ${embed.title ?? embed.url ?? 'sem titulo'}`) ?? []),
      // Defesa: normaliza/trunca o snippet aqui, mesmo que o caller já corte.
      ...(() => {
        const snippet = replyContext?.replace(/\s+/g, ' ').trim().slice(0, 80);
        return snippet ? [`Em resposta a: ${snippet}`] : [];
      })(),
    ],
  };

  return {
    source: {
      guild_id: message.discord_guild_id,
      channel_id: message.discord_channel_id,
      message_id: message.discord_message_id,
      message_url: message.discord_message_url ?? '',
      author_id: message.discord_author_id ?? undefined,
      author_name: message.discord_author_name ?? undefined,
    },
    table,
    confidence: calcConfidence(table),
    confidence_tier: classifyConfidence(calcConfidence(table)),
    missing_fields: missingFields,
  };
}
