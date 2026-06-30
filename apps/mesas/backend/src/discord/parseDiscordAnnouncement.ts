import type { CoverQuality, ImportRawMessage, DiscordSlotsAmbiguity, ImportTableDraft, DiscordTableDraftTable, TableDraftType, TableDraftModality, TableDraftPriceType } from './types';

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
    .normalize('NFD')
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

function findSystemMatch(text: string, systems: SystemEntry[], allowShortAliases = false): SystemEntry | null {
  const normText = normalize(text);
  if (!normText) return null;

  type CandidateMatch = {
    system: SystemEntry;
    candidate: string;
    priority: number;
    exact: boolean;
  };

  const matches: CandidateMatch[] = [];

  for (const system of systems) {
    const candidates = [
      { value: system.name, priority: 3 },
      ...(system.name_pt ? [{ value: system.name_pt, priority: 3 }] : []),
      ...system.aliases.map((alias) => ({ value: alias, priority: 1 })),
    ];
    for (const candidate of candidates) {
      if (!candidate.value) continue;
      const normCandidate = normalize(candidate.value);
      // Aliases curtos e genericos como "D&D" aparecem em sistemas derivados
      // no banco; usar isso como match automatico gera falsos positivos.
      if (!allowShortAliases && normCandidate.length < 4 && candidate.priority < 3) continue;
      if (normCandidate.length < 2) continue;
      const pattern = new RegExp(`(?:^|[\\s,;:])${normCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s,;:]|$)`);
      const versionedPattern = new RegExp(`^${normCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d`);
      if (normText === normCandidate || pattern.test(` ${normText} `) || versionedPattern.test(normText)) {
        matches.push({
          system,
          candidate: normCandidate,
          priority: candidate.priority,
          exact: normText === normCandidate,
        });
      }
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.candidate.length - a.candidate.length;
  });
  return matches[0].system;
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
    const beforeColon = cleanTrademark(threadName.slice(0, colonIdx).trim());
    const afterColon = cleanTrademark(threadName.slice(colonIdx + 1).trim());
    if (beforeColon.length > 0 && afterColon.length > 0) {
      return { systemHint: beforeColon, title: afterColon };
    }
  }
  return { systemHint: null, title: cleanTrademark(threadName) };
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
function extractPrice(text: string): { priceType: TableDraftPriceType; priceValue: number | null } {
  const priceMatch = /R\$\s{0,3}(\d+(?:[,.]\d{1,2})?)(?!\d)/i.exec(text)
    ?? /(\d+(?:[,.]\d{1,2})?)(?!\d)\s{0,3}reais/i.exec(text);
  if (priceMatch) {
    const value = parseFloat(priceMatch[1].replace(',', '.'));
    if (!Number.isNaN(value) && value > 0) {
      return { priceType: 'paga', priceValue: value };
    }
  }
  const lower = text.toLowerCase();
  if (/\bgratuita?\b|\bfree\b|\bsem\s+custo\b/.test(lower)) {
    return { priceType: 'gratuita', priceValue: null };
  }
  return { priceType: 'gratuita', priceValue: null };
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
  const value = extractLabelValue(text, [
    'vagas', 'vagas disponiveis', 'vagas disponíveis', 'vagas totais',
    'vagas abertas', 'nº de vagas', 'n de vagas', 'numero de vagas',
    'número de vagas', 'lugares', 'jogadores',
  ]);
  if (!value) return null;
  const slash = /(\d+)\s{0,3}\/\s{0,3}(\d+)/.exec(value);
  if (slash) {
    const filled = Number.parseInt(slash[1], 10);
    const total = Number.parseInt(slash[2], 10);
    if (!Number.isFinite(total)) return null;
    return { total, open: Math.max(0, total - filled), ambiguity: null };
  }
  const single = /(\d{1,3})/.exec(value);
  if (!single) return null;
  const total = Number.parseInt(single[1], 10);
  if (!Number.isFinite(total) || total <= 0) return null;
  return { total, open: total, ambiguity: null };
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
    if (!parsed || !wanted.has(parsed.key)) continue;

    const values = collectLabelContinuation(lines, i + 1, parsed.value ?? '');

    // keepParenthetical: o parêntese carrega o sinal de autoria ("(Sistema próprio
    // usando D&D...)") que o gate DEB-048-27 precisa. Matching/título usa o corte.
    const joined = values.join('\n');
    // Corta o parêntese de autoria sem regex (evita backtracking S5852).
    const parenIdx = joined.indexOf('(');
    const value = (opts?.keepParenthetical || parenIdx < 0 ? joined : joined.slice(0, parenIdx)).trim();
    return value || null;
  }

  return null;
}

function normalizeTitle(value: string | null): string | null {
  if (!value) return null;
  return cleanTrademark(value.replace(/\*/g, '').replace(/^["“”']|["“”']$/g, '').trim()) || null;
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
  const body = rawBody.trim() || extractBodyFromEmbeds(message.embeds ?? []);
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
): ImportTableDraft | null {
  const threadName = message.discord_thread_name ?? '';
  const rawBody = message.content_raw ?? '';
  // Fóruns Discord frequentemente colocam o conteúdo em embeds em vez do campo content
  const body = rawBody.trim() || extractBodyFromEmbeds(message.embeds ?? []);
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
  const description = extractLabelValue(body, ['descricao', 'descrição', 'sinopse', 'proposta']) ?? (body.trim() || null);

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
    type,
    modality,
    price_type: priceType,
    price_value: priceValue,
    slots_total: slotsTotal,
    slots_filled: slotsTotal != null && slotsOpen != null ? slotsTotal - slotsOpen : null,
    slots_open: slotsOpen,
    day_of_week: dayOfWeek,
    start_time: startTime,
    frequency: deriveFrequency(type, dayOfWeek),
    description,
    contact_discord: contactDiscord,
    contact_url: contactUrl,
    host_discord_id: hostDiscordId,
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
