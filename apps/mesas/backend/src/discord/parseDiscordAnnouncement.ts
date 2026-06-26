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

function extractCoverFromAttachments(attachments: unknown[]): { url: string; quality: CoverQuality } | null {
  for (const attachment of attachments) {
    if (typeof attachment !== 'object' || attachment === null) continue;
    const record = attachment as Record<string, unknown>;
    const contentType = readStringField(record, 'content_type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') continue;

    const url = readStringField(record, 'url');
    if (!url) continue;

    const width = readNumberField(record, 'width') ?? 0;
    const size = readNumberField(record, 'size') ?? 0;
    const quality: CoverQuality = width >= 800 && size >= 50000 ? 'standard' : 'low';
    return { url, quality };
  }

  return null;
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
  const match = value.trim().match(/^(.*?)\s+((?:\d+(?:\.\d+)?e?)|(?:\d+e))$/i);
  if (!match) return { stripped: value, version: null };
  const stripped = match[1].trim();
  const version = match[2].trim();
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
  const priceMatch = text.match(/R\$\s*(\d+(?:[,.]\d{1,2})?)/i)
    ?? text.match(/(\d+(?:[,.]\d{1,2})?)\s*reais/i);
  if (priceMatch) {
    const value = parseFloat(priceMatch[1].replace(',', '.'));
    if (!isNaN(value) && value > 0) {
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
function extractSlots(text: string): { total: number | null; open: number | null; ambiguity: DiscordSlotsAmbiguity | null } {
  const cleaned = text.replace(/\*/g, '');

  // "Mesa em andamento" → sem vagas abertas (não fabricar número)
  if (/\bmesa\s+em\s+andamento\b/i.test(cleaned)) {
    return { total: null, open: null, ambiguity: null };
  }

  // "N vaga via forms" → total=N, open=N
  const viaFormsMatch = cleaned.match(/(\d+)\s+vaga\s+via\s+forms/i);
  if (viaFormsMatch) {
    const n = parseInt(viaFormsMatch[1], 10);
    if (n >= 0 && n <= 20) {
      return { total: n, open: n, ambiguity: null };
    }
  }

  // Padrão "X de Y" (ex: "3 de 5 vagas", "2 de 4") — mal escrito, informal
  // Guard: X ≤ Y, 1 ≤ Y ≤ 20 (evita match com datas e níveis)
  const deMatch = cleaned.match(/(\d+)\s+de\s+(\d+)/i);
  if (deMatch) {
    const first = parseInt(deMatch[1], 10);
    const second = parseInt(deMatch[2], 10);
    if (first <= second && second >= 1 && second <= 20) {
      return { total: second, open: Math.max(0, second - first), ambiguity: null };
    }
  }

  const totalMatch = cleaned.match(/vagas?\s+(?:totais|total)\s*[:=]\s*(\d+)/i);
  const openMatch = cleaned.match(/vagas?\s+(?:dispon[ií]veis|dispon[ií]vel|abertas|aberta)\s*[:=]\s*(\d+)/i);
  if (totalMatch || openMatch) {
    const total = totalMatch ? parseInt(totalMatch[1], 10) : null;
    const open = openMatch ? parseInt(openMatch[1], 10) : total;
    return { total, open, ambiguity: null };
  }

  const ambiguousSlashMatch = cleaned.match(/(?:^|\n)\s*[\s▬•\-–—]*(?:vagas|jogadores)\s*[:=]\s*(\d+)\s*\/\s*(\d+)(?!\s*vagas?)/i);
  if (ambiguousSlashMatch) {
    const first = parseInt(ambiguousSlashMatch[1], 10);
    const second = parseInt(ambiguousSlashMatch[2], 10);
    return {
      total: Math.max(first, second),
      open: null,
      ambiguity: { first, second, source: 'x_slash_y' },
    };
  }

  const labeledMatch = cleaned.match(/(?:^|\n)\s*[\s▬•\-–—]*(?:vagas|vagas dispon[ií]veis|jogadores)\s*[:=]\s*(\d+)(?!\s*\/)/i);
  if (labeledMatch) {
    const n = parseInt(labeledMatch[1], 10);
    return { total: n, open: n, ambiguity: null };
  }

  const slashMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*vagas?/i);
  if (slashMatch) {
    const filled = parseInt(slashMatch[1], 10);
    const total = parseInt(slashMatch[2], 10);
    return { total, open: Math.max(0, total - filled), ambiguity: null };
  }
  const match = text.match(/(\d+)\s*vagas?/i)
    ?? text.match(/vagas?\s*(?:disponíveis?)?\s*[:=]\s*(\d+)/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return { total: n, open: n, ambiguity: null };
  }
  return { total: null, open: null, ambiguity: null };
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
  const match = text.match(/\b(\d{1,2})[hH:](\d{0,2})\b/)
    ?? text.match(/\bàs\s+(\d{1,2})[hH](\d{0,2})/i);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = (match[2] || '00').padStart(2, '0');
    return `${h}:${m}`;
  }
  return null;
}

// Extrai dia da semana e horário de timestamps Discord <t:UNIX:FORMATO>
function extractDiscordTimestamp(text: string): { dayOfWeek: string; startTime: string } | null {
  const pattern = /<t:(\d+):([a-zA-Z]+)>/g;
  let match: RegExpExecArray | null;
  const daysPt = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  while ((match = pattern.exec(text)) !== null) {
    const unix = parseInt(match[1], 10);
    if (!Number.isFinite(unix) || unix <= 0) continue;
    const date = new Date(unix * 1000);
    if (isNaN(date.getTime())) continue;
    const dayOfWeek = daysPt[date.getUTCDay()];
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return { dayOfWeek, startTime: `${hh}:${mm}` };
  }
  return null;
}

function deriveFrequency(type: TableDraftType | null, dayOfWeek: string | null): 'semanal' | null {
  if (type === 'campanha' && dayOfWeek) return 'semanal';
  return null;
}

// Detecta frases que indicam que o contato é o autor da mensagem
function detectImplicitContact(text: string): boolean {
  const implicitPhrases = [
    /me\s+(mande|envie)\s+(uma\s+)?mensagem/i,
    /me\s+cham[ae]/i,
    /fale\s+comigo/i,
    /cham[ae]\s+(no|na)\s+(pv|dm|privado)/i,
    /este\s+perfil/i,
    /(mande|envie)\s+(uma\s+)?mensagem\s+(no\s+meu|para\s+o\s+meu)/i,
  ];
  return implicitPhrases.some((r) => r.test(text));
}

// Extrai URL de contato (discord invite, forms, etc.)
function extractContactUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
  return urlMatch ? urlMatch[0] : null;
}

function extractContactDiscord(text: string): string | null {
  const mentionPattern = /<#[0-9]+>|<@!?[0-9]+>/;
  const contactLine = text
    .split(/\r?\n/)
    .find((line) => /\b(contato|ticket|interesse|inscri[cç][aã]o)\b/i.test(line) && mentionPattern.test(line));
  const match = contactLine?.match(mentionPattern);
  return match ? match[0] : null;
}

function cleanLabelLine(line: string): string {
  return line
    .replace(/^[\s▬•\-–—]+/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLabelKey(value: string): string {
  return normalize(value).replace(/\s+/g, ' ').trim();
}

function splitLabelLine(line: string): { key: string; value: string } | null {
  const cleaned = cleanLabelLine(line);
  const match = cleaned.match(/^(.{1,48}?)\s*[:：]\s*(.*)$/);
  if (!match) return null;
  return { key: normalizeLabelKey(match[1]), value: match[2].trim() };
}

function extractHostDiscordId(text: string): string | null {
  const mentionPattern = /<@!?(\d+)>/;
  const hostLabels = new Set(['mestre', 'gm', 'narrador', 'dm']);
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const parsed = splitLabelLine(lines[i]);
    const cleanedKey = parsed?.key ?? normalizeLabelKey(cleanLabelLine(lines[i]).replace(/[:：].*$/, ''));
    if (!hostLabels.has(cleanedKey)) continue;

    const sameLineMatch = lines[i].match(mentionPattern);
    if (sameLineMatch) return sameLineMatch[1];

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (splitLabelLine(next)) break;
      const nextMatch = next.match(mentionPattern);
      if (nextMatch) return nextMatch[1];
      if (!next.trim()) break;
    }
  }

  return null;
}

function extractLabelValue(text: string, labels: string[]): string | null {
  const wanted = new Set(labels.map(normalizeLabelKey));
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const parsed = splitLabelLine(lines[i]);
    if (!parsed || !wanted.has(parsed.key)) continue;

    const values: string[] = [];
    if (parsed.value) values.push(parsed.value);

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) {
        if (values.length > 0) break;
        continue;
      }
      if (splitLabelLine(next)) break;
      values.push(next);
    }

    const value = values.join('\n').replace(/\s*\(.*$/, '').trim();
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
  const googleFormsUrl = body.match(/https?:\/\/forms\.gle\/[^\s<>"']+/)?.[0]
    ?? body.match(/https?:\/\/docs\.google\.com\/forms\/[^\s<>"']+/)?.[0];
  const contactUrl = googleFormsUrl ?? extractContactUrl(body);

  const contactDiscord = extractContactDiscord(body);
  let hostDiscordId = extractHostDiscordId(body);

  // T-C3: Contato implícito pelo autor (quando não há contato explícito)
  const hasImplicitContact = detectImplicitContact(body);
  if (!contactDiscord && !contactUrl && hasImplicitContact && message.discord_author_id) {
    hostDiscordId = hostDiscordId ?? message.discord_author_id;
  }
  const cover = extractCoverFromAttachments(message.attachments ?? []);
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
    _notes: matchedSystem?.notes ?? [],
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
    missing_fields: missingFields,
  };
}
