import type { CoverQuality, ImportRawMessage, DiscordSlotsAmbiguity, ImportTableDraft, DiscordTableDraftTable, TableDraftType, TableDraftModality, TableDraftPriceType, TableDraftFrequency, TableDraftAgeRating, TableDraftExperienceLevel, TableDraftTableLevel } from './types';
import { normalizeSystemName, scoreSystemCandidates } from '../services/systemSuggestionCandidates';

export interface SystemEntry {
  id: string;
  name: string;
  name_pt: string | null;
  aliases: string[];
  slug?: string | null;
  path_slug?: string | null;
  node_type?: string;
  parent_id?: string | null;
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
  // `['’]?\d{0,2}` no fim cobre edição estilo "5e'24"/"5e'24" (apóstrofo + ano
  // curto de 2 dígitos) — achado real: "D&D 5e'24" (D:\teste [part 2].json)
  // não batia porque a string terminava em `'24`, não em dígito puro.
  const trimmed = value.trim();
  const match = /\s(\d+(?:\.\d+)?e?)['’]?\d{0,2}$/i.exec(trimmed);
  if (!match) return { stripped: value, version: null };
  const stripped = trimmed.slice(0, match.index).trim();
  const version = trimmed.slice(match.index).trim();
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

function sharesSystemBase(left: ReturnType<typeof normalizeSystemName>, right: ReturnType<typeof normalizeSystemName>): boolean {
  if (left.base && left.base === right.base) return true;
  return left.matchKeys.some((key) => right.matchKeys.includes(key));
}

function normalizeSystemHint(text: string): ReturnType<typeof normalizeSystemName> {
  const restoredDecimal = text.replace(/\b(\d{1,2})\s+(\d{1,2})(e|ed)?\b/gi, (_match, major, minor, suffix = '') => (
    `${major}.${minor}${suffix}`
  ));
  return normalizeSystemName(restoredDecimal);
}

function normalizeSystemRepresentation(text: string): ReturnType<typeof normalizeSystemName> {
  // Slugs do catálogo codificam 3.5e como "3-5e". Sem restaurar o ponto,
  // o tokenizador lê base "3" + edição "5e" e empata com a edição 5e real.
  return normalizeSystemName(text.replace(/\b(\d{1,2})-(\d{1,2}e?)\b/gi, '$1.$2'));
}

function hasCompactVersionSuffix(
  canonical: ReturnType<typeof normalizeSystemName>,
  hint: ReturnType<typeof normalizeSystemName>,
): boolean {
  const base = canonical.normalized.replaceAll(' ', '');
  const complete = hint.normalized.replaceAll(' ', '');
  return Boolean(base) && new RegExp(String.raw`^${base}\d+(?:e|ed)?$`).test(complete);
}

function tokenSequenceIndex(needle: string[], haystack: string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return start;
  }
  return -1;
}

function sequenceMatchScore(baseScore: number, needle: string[], haystack: string[]): number {
  const index = tokenSequenceIndex(needle, haystack);
  if (index < 0) return 0;
  const lengthBonus = Math.min(8, needle.length * 2);
  const positionBonus = Math.max(0, 10 - index);
  return baseScore + lengthBonus + positionBonus;
}

function isAcronymLike(value: ReturnType<typeof normalizeSystemName>): boolean {
  const semanticTokens = value.baseTokens.filter((token) => token !== 'and');
  return semanticTokens.length > 1 && semanticTokens.every((token) => token.length === 1);
}

function isSystemRoot(system: SystemEntry): boolean {
  return (system.parent_id === null || system.parent_id === undefined)
    && !['edition', 'variant'].includes(system.node_type ?? 'system');
}

function scoreRootName(
  hint: ReturnType<typeof normalizeSystemName>,
  name: string,
): number {
  const canonical = normalizeSystemName(name);
  if (canonical.normalized === hint.normalized) return 120;
  if (sharesSystemBase(canonical, hint)) return 100;
  if (hasCompactVersionSuffix(canonical, hint)) return 90;
  return sequenceMatchScore(90, canonical.baseTokens, hint.baseTokens);
}

function scoreSystemRoot(hint: ReturnType<typeof normalizeSystemName>, system: SystemEntry): number {
  let score = 0;
  for (const name of [system.name, system.name_pt].filter((value): value is string => Boolean(value))) {
    score = Math.max(score, scoreRootName(hint, name));
  }
  const canonicalName = normalizeSystemName(system.name);
  for (const alias of system.aliases) {
    const normalizedAlias = normalizeSystemName(alias);
    if (isAcronymLike(normalizedAlias) && !sharesSystemBase(normalizedAlias, canonicalName)) continue;
    if (['rpg', 'ttrpg', 'system', 'sistema', 'jogo'].includes(normalizedAlias.base)) continue;
    if (normalizedAlias.normalized === hint.normalized) score = Math.max(score, 80);
    else if (sharesSystemBase(normalizedAlias, hint)) score = Math.max(score, 70);
    else score = Math.max(score, sequenceMatchScore(60, normalizedAlias.baseTokens, hint.baseTokens));
  }
  return score;
}

function findRootSystem(text: string, systems: SystemEntry[]): SystemEntry | null {
  const hint = normalizeSystemHint(text);
  const ranked = systems
    .filter(isSystemRoot)
    .map((system) => ({ system, score: scoreSystemRoot(hint, system) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.system.name.localeCompare(right.system.name));
  if (!ranked[0] || ranked[1]?.score === ranked[0].score) return null;
  return ranked[0].system;
}

function scoreSystemDescendant(text: string, system: SystemEntry): number {
  const hint = normalizeSystemHint(text);
  const representations = [
    system.name,
    system.name_pt,
    ...system.aliases,
  ].filter((value): value is string => Boolean(value));
  let score = 0;
  for (const representation of representations) {
    const candidate = normalizeSystemRepresentation(representation);
    const hintEditions = new Set(hint.editionTokens);
    const shortYearMatches = candidate.editionTokens.filter((token) => (
      /^(?:19|20)\d{2}$/.test(token) && hint.baseTokens.includes(token.slice(-2))
    ));
    const hasEditionSignal = hint.editionTokens.length > 0 || shortYearMatches.length > 0;
    const hasIncompatibleEdition = candidate.editionTokens.length > 0
      && (!hasEditionSignal
        || !candidate.editionTokens.every((token) => (
          hintEditions.has(token) || shortYearMatches.includes(token)
        )));
    // Um alias como "D&D 5.5" não pode pontuar pela base "D&D" contra
    // "D&D 5e". A edição faz parte do mesmo sinal.
    if (hasIncompatibleEdition) continue;
    if (candidate.normalized && candidate.normalized === hint.normalized) {
      score = Math.max(score, 140);
      continue;
    }
    if (candidate.baseTokens.length > 0) {
      score = Math.max(score, sequenceMatchScore(90, candidate.baseTokens, hint.baseTokens));
    }
    if (candidate.editionTokens.length === 0 || !hasEditionSignal) continue;
    const availableEditionSignals = hint.editionTokens.length + shortYearMatches.length;
    const exactSet = candidate.editionTokens.length === availableEditionSignals;
    const firstTokenIndex = Math.min(...candidate.editionTokens.map((token) => {
      const exactIndex = hint.editionTokens.indexOf(token);
      return exactIndex >= 0 ? exactIndex : hint.editionTokens.length + hint.baseTokens.indexOf(token.slice(-2));
    }));
    const orderBonus = Math.max(0, 5 - firstTokenIndex);
    const nodeBonus = system.node_type === 'edition' ? 5 : 0;
    score = Math.max(score, (exactSet ? 120 : 110) + nodeBonus + orderBonus);
  }
  return score;
}

function collectSystemDescendants(parentId: string, systems: SystemEntry[]): SystemEntry[] {
  const result: SystemEntry[] = [];
  const queue = systems.filter((system) => system.parent_id === parentId);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    result.push(node);
    queue.push(...systems.filter((system) => system.parent_id === node.id));
  }
  return result;
}

function localSystemNames(system: SystemEntry): Set<string> {
  return new Set([system.name, system.name_pt, ...system.aliases]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeSystemRepresentation(value).normalized)
    .filter(Boolean));
}

function findUniqueExactEditionAlias(text: string, systems: SystemEntry[]): SystemEntry | null {
  const normalizedHint = normalizeSystemHint(text).normalized;
  if (!normalizedHint) return null;
  const byId = new Map(systems.map((system) => [system.id, system]));
  const matches = systems.filter((system) => {
    if (system.node_type !== 'edition' || !system.parent_id) return false;
    const parent = byId.get(system.parent_id);
    if (!parent || !isSystemRoot(parent)) return false;
    return system.aliases.some((alias) => normalizeSystemRepresentation(alias).normalized === normalizedHint);
  });
  if (matches.length !== 1) return null;
  return systems.some((system) => system.id !== matches[0].id && localSystemNames(system).has(normalizedHint))
    ? null
    : matches[0];
}

function findSystemMatch(text: string, systems: SystemEntry[]): SystemEntry | null {
  // Um alias exato da edição (ex.: "V5") já contém semanticamente sistema +
  // edição. A exceção é restrita a edição filha direta e alias único; variante
  // continua proibida de pular o nível intermediário.
  const exactEditionAlias = findUniqueExactEditionAlias(text, systems);
  if (exactEditionAlias) return exactEditionAlias;
  const root = findRootSystem(text, systems);
  if (!root) return null;
  let current = root;
  const visited = new Set<string>();
  while (!visited.has(current.id)) {
    visited.add(current.id);
    const children = systems
      .filter((system) => system.parent_id === current.id)
      .map((system) => ({ system, score: scoreSystemDescendant(text, system) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.system.name.localeCompare(right.system.name));
    if (!children[0]) {
      break;
    }
    if (children[1]?.score === children[0].score) break;
    const winningNames = localSystemNames(children[0].system);
    const duplicatedAtDeeperLevel = collectSystemDescendants(current.id, systems)
      .filter((system) => system.parent_id !== current.id)
      .some((system) => scoreSystemDescendant(text, system) > 0
        && [...localSystemNames(system)].some((name) => winningNames.has(name)));
    if (duplicatedAtDeeperLevel) break;
    current = children[0].system;
  }
  return current;
}

function isAncestorOf(
  candidateId: string,
  selected: SystemEntry,
  byId: ReadonlyMap<string, SystemEntry>,
): boolean {
  let current = selected;
  const visited = new Set<string>();
  while (current.parent_id && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parent_id === candidateId) return true;
    const parent = byId.get(current.parent_id);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

function isExactSystemMatch(text: string, system: SystemEntry): boolean {
  const target = normalize(text);
  if ([system.name, system.name_pt, ...system.aliases]
    .some((candidate) => candidate != null && normalize(candidate) === target)) return true;

  const hint = normalizeSystemHint(text);
  const canonicalNameMatch = [system.name, system.name_pt]
    .filter((candidate): candidate is string => Boolean(candidate))
    .some((candidate) => {
      const canonical = normalizeSystemName(candidate);
      const sharedKey = canonical.base === hint.base
        || canonical.matchKeys.some((key) => hint.matchKeys.includes(key));
      if (!sharedKey) return false;
      if (canonical.editionTokens.length !== hint.editionTokens.length) return false;
      const hintEditions = new Set(hint.editionTokens);
      return canonical.editionTokens.every((token) => hintEditions.has(token));
    });
  if (canonicalNameMatch) return true;

  // Folhas podem se chamar somente "5ª Edição"/"5e". A raiz já foi
  // escolhida antes de chegar aqui; nesta etapa basta confirmar a edição da
  // folha, sem exigir que ela repita o nome da raiz.
  if (system.parent_id === null || system.parent_id === undefined || hint.editionTokens.length === 0) {
    return false;
  }
  const hintEditions = new Set(hint.editionTokens);
  return [system.name, system.name_pt, ...system.aliases]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => normalizeSystemRepresentation(candidate).editionTokens)
    .some((editions) => editions.length === hint.editionTokens.length
      && editions.every((token) => hintEditions.has(token)));
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
  // Texto completo primeiro: uma edição/variante exata deve vencer o sistema
  // pai. A ordem antiga removia "5e/2e/2024" antes e tornava o filho invisível.
  const direct = findSystemMatch(text, systems);
  if (direct && isExactSystemMatch(text, direct)) return { system: direct, notes: [] };
  // Nomes dos nós filhos são deliberadamente locais ("5ª Edição", "2024"),
  // então o texto completo raramente é igualdade literal. Se a travessia da
  // árvore chegou a um filho por sinais explícitos, stripping não pode subir
  // de volta ao pai.
  if (direct?.parent_id && scoreSystemDescendant(text, direct) > 0) {
    return { system: direct, notes: [] };
  }

  const { stripped, version } = stripVersionSuffix(text);
  if (version && stripped !== text) {
    const strippedMatch = findSystemMatch(stripped, systems);
    if (strippedMatch) {
      return { system: strippedMatch, notes: [`version_mismatch:${version}`] };
    }
  }
  if (direct) return { system: direct, notes: [] };

  return null;
}

function buildSystemCandidates(
  hint: string | null,
  systems: SystemEntry[],
  selectedId: string | null,
): NonNullable<DiscordTableDraftTable['_system_candidates']> {
  if (!hint || systems.length === 0) return [];
  const aliases = systems.flatMap((system) =>
    system.aliases.map((alias) => ({ system_id: system.id, alias })),
  );
  const scored = scoreSystemCandidates(
    hint,
    systems.map((system) => ({
      id: system.id,
      name: system.name,
      name_pt: system.name_pt,
      slug: system.slug ?? null,
      path_slug: system.path_slug ?? null,
      node_type: system.node_type ?? 'system',
      parent_id: system.parent_id ?? null,
    })),
    aliases,
    selectedId ? systems.length : 6,
  );
  const byId = new Map(systems.map((system) => [system.id, system]));
  const selected = selectedId ? byId.get(selectedId) : null;
  const hierarchyChildren = selected
    ? systems
      .filter((system) => system.parent_id === selected.id)
      .map((system) => ({
        system_id: system.id,
        name: system.name,
        score: 0.49,
        reasons: ['hierarchy_child'],
      }))
    : [];
  const seen = new Set<string>();
  return [...scored.candidates, ...hierarchyChildren]
    .filter((candidate) => candidate.system_id !== selectedId)
    .filter((candidate) => {
      if (seen.has(candidate.system_id)) return false;
      seen.add(candidate.system_id);
      return true;
    })
    .filter((candidate) => {
      if (!selected) return true;
      const system = byId.get(candidate.system_id);
      if (!system) return false;
      return isAncestorOf(system.id, selected, byId)
        || system.parent_id === selected.id;
    })
    .slice(0, 5)
    .map((candidate) => ({
      system_id: candidate.system_id,
      name: candidate.name,
      score: candidate.score,
      reasons: candidate.reasons,
    }));
}

// URL completa (http/https) em qualquer ponto da string — usada por
// splitThreadName pra não confundir o ":" de "https://" com o separador
// "sistema: título" (achado mantenedor 2026-07-13: linha com heading +
// link de anexo do Discord na mesma linha corrompia o título com a URL).
const RE_INLINE_URL = /https?:\/\/\S+/i;
const RE_INLINE_URL_GLOBAL = /https?:\/\/\S+/gi;

// Tenta extrair "sistema: titulo" do nome do thread
// Achado do mantenedor (2026-07-10): quando não há thread_name real, o título
// cai aqui via `body.split('\n')[0]` (1ª linha do anúncio) — sem passar por
// normalizeTitle/normalizeTitleCapitalization, título em CAPS LOCK sobrevivia.
function splitThreadName(threadName: string): { systemHint: string | null; title: string } {
  const urlMatch = RE_INLINE_URL.exec(threadName);
  // Separador ":" só é buscado na porção ANTES da primeira URL inline — o ":" de
  // "https://" nunca deve ser tratado como separador de "sistema: título".
  const searchScope = urlMatch ? threadName.slice(0, urlMatch.index) : threadName;
  const colonIdx = searchScope.indexOf(':');
  // Remove TODAS as URLs inline (não só a primeira) — múltiplos links de anexo
  // na mesma linha não podem sobreviver nem no beforeColon nem no afterColon
  // (achado bot review 2026-07-13: RE_INLINE_URL.exec só pegava o 1º match).
  const textWithoutUrl = threadName.replace(RE_INLINE_URL_GLOBAL, '');
  if (colonIdx > 0 && colonIdx < searchScope.length - 2) {
    const beforeColon = cleanTrademark(stripDecorativeMarkup(threadName.slice(0, colonIdx).trim()));
    const afterColon = cleanTrademark(stripDecorativeMarkup(textWithoutUrl.slice(colonIdx + 1).trim()));
    if (beforeColon.length > 0 && afterColon.length > 0) {
      return { systemHint: beforeColon, title: normalizeTitleCapitalization(afterColon) };
    }
  }
  const fallbackTitle = cleanTrademark(stripDecorativeMarkup(textWithoutUrl));
  return { systemHint: null, title: fallbackTitle ? normalizeTitleCapitalization(fallbackTitle) : fallbackTitle };
}

// Extrai modalidade do texto
function extractModality(text: string): TableDraftModality | null {
  const lower = text.toLowerCase();
  if (/\bpresencial\b/.test(lower)) return 'presencial';
  if (/\bh[íi]brida?\b|\bonline\s*e\s*presencial\b/.test(lower)) return 'hibrida';
  if (/\bonline\b/.test(lower)) return 'online';
  return null;
}

// Extrai tipo de campanha do texto. Cascata: vocabulário direto (one-shot/
// campanha/aberta) primeiro; sem esse sinal, indícios indiretos reais de
// campanha em andamento (duração multi-sessão citada, "em andamento",
// "recrutamento" pra mesa já rodando) — nunca inventa um tipo sem NENHUM
// sinal, direto ou indireto.
function extractType(text: string): TableDraftType | null {
  const lower = text.toLowerCase();
  if (/\bone[\s-]?shot\b/.test(lower)) return 'one-shot';
  if (/\bcampanha\b/.test(lower)) return 'campanha';
  if (/\baberta\b|\bdrop[\s-]?in\b/.test(lower)) return 'aberta';
  // Sinal indireto: "em andamento"/"já iniciada" (mesa rodando, não é one-shot
  // isolado) ou número de sessões citado como estimativa de duração (só
  // campanha tem "N sessões" como plano — one-shot é 1 sessão só, não teria
  // essa métrica). Caso real: "Daggerheart: As Witherlands" (D:\teste.json)
  // não cita "campanha" em nenhum lugar, só "Vagas: 1/6 - Em andamento".
  if (/\bem\s+andamento\b|\bj[aá]\s+(?:iniciada|come[çc]ou|em\s+andamento)\b/.test(lower)) return 'campanha';
  if (/\b\d+\s*[aà~–—-]\s*\d+\s+sess[õo]es\b/.test(lower)) return 'campanha';
  if (/\b\d+\+?\s+sess[õo]es\b/.test(lower)) return 'campanha';
  return null;
}

/**
 * Extrai preço do texto. Não é caça-palavra-chave: segue uma cascata de
 * evidência por FORÇA de sinal (label explícito > texto livre > ausência) e
 * detecta CONFLITO real (menção de cobrança + menção de gratuidade sem relação
 * de sessão-zero/período promocional) em vez de decidir por chute — nesse caso
 * devolve `null` e marca `ambiguous: true`, o que reduz a confiança do draft
 * (calcConfidence) e entra em `missing_fields` para revisão humana.
 *
 * "Sessão 0/zero gratuita" e "1ª semana grátis, depois R$X" são padrões de
 * PERÍODO PROMOCIONAL — a mesa é PAGA com uma isenção pontual, não GRATUITA.
 * Esse recorte é removido do texto antes de avaliar o sinal geral de
 * gratuidade/cobrança, senão a palavra "gratuita" solta mascara o preço real.
 */
const PROMO_FREE_PERIOD_RE_LIST = [
  /\bsess[aã]o\s*(?:0|zero)\s+(?:[ée]\s+)?gr[aá]tis\b/gi,
  /\bsess[aã]o\s*(?:0|zero)\s+gratuita\b/gi,
  /\b(?:primeir[ao]|1[ªa])\s+(?:sess[aã]o|semana|aula)\s+(?:[ée]\s+)?gr[aá]tis\b/gi,
  /\b(?:primeir[ao]|1[ªa])\s+(?:sess[aã]o|semana|aula)\s+gratuita\b/gi,
];
// Label explícito de gratuidade ("Valor: gratuito/sem custo/...") e negação de
// cobrança ("não é paga", "sem pagamento", "sem mensalidade" soltos no texto,
// não só colados no label "valor") — precisam sair do texto ANTES de avaliar
// hasPaidSignal, senão "pagamento"/"mensalidade" dentro da própria frase livre
// (sem "valor:" na frente) casam com PAID_SIGNAL_RE e o par vira falso
// conflito/ambíguo (achado ao corrigir review dos bots na PR #128 — P2 sobre
// "Valor: gratuito"/"sem pagamento"/"não é paga" virando ambíguo).
const FREE_PRICE_LABEL_RE = /\bvalor\s*:?\s{0,3}(?:gratuit[oa]s?|free|sem\s+(?:custo|valor|pagamento|mensalidade))\b/gi;
const NEGATED_PAID_RE = /\bn[aã]o\s+[ée]\s+pag[ao]\b|\bsem\s+(?:custo|pagamento|mensalidade)\b/gi;
const FREE_SIGNAL_RE = /\bgratuit[oa]s?\b|\bfree\b|\bsem\s+(?:custo|valor|pagamento|mensalidade)\b|\bn[aã]o\s+[ée]\s+pag[ao]\b/;
const PAID_SIGNAL_RE = /\b(?:mesa\s+)?pag[ao]\b|\bvalor\s*:|\bpagamento\b|\bmensalidade\b|\bvalor\s+a\s+combinar\b|\ba\s+combinar\b/;

function stripPromoFreePeriods(value: string): string {
  return PROMO_FREE_PERIOD_RE_LIST.reduce((acc, pattern) => acc.replace(pattern, ''), value);
}

function stripFreePricePhrases(value: string): string {
  return value.replace(FREE_PRICE_LABEL_RE, '').replace(NEGATED_PAID_RE, '');
}

function extractPrice(
  text: string,
  labelAliases: string[] = [],
): { priceType: TableDraftPriceType | null; priceValue: number | null; ambiguous: boolean } {
  // Nível 1 — valor numérico explícito: "R$ 30", "30 reais", ou label "Valor: 30,00"
  // (sem exigir R$/reais — anúncios reais citam só o número após o rótulo).
  // Sinal mais forte que existe: número > 0 citado como preço é sempre PAGA,
  // mesmo que o mesmo anúncio também mencione "sessão 0 gratuita" (isenção
  // pontual, não o preço da mesa). Markdown (`**Valor**:`) é removido antes do
  // regex de label — senão `**` entre a palavra e o `:` quebra o match.
  const cleaned = text.replaceAll('*', '');
  const learnedLabelValue = labelAliases.length > 0 ? extractLabelValue(text, labelAliases) : null;
  const priceMatch = (learnedLabelValue ? /(\d{1,9}(?:[,.]\d{1,2})?)\b/.exec(learnedLabelValue) : null)
    ?? /R\$\s{0,3}(\d{1,9}(?:[,.]\d{1,2})?)\b/i.exec(cleaned)
    ?? /(\d{1,9}(?:[,.]\d{1,2})?)\b\s{0,3}(?:R\$|reais)/i.exec(cleaned)
    ?? /\bvalor\s*:?\s{0,3}(\d{1,9}(?:[,.]\d{1,2})?)\b/i.exec(cleaned);
  if (priceMatch) {
    const value = parseFloat(priceMatch[1].replace(',', '.'));
    if (!Number.isNaN(value) && value > 0) {
      return { priceType: 'paga', priceValue: value, ambiguous: false };
    }
  }

  const lower = cleaned.toLowerCase();
  const withoutPromoFreePeriod = stripPromoFreePeriods(lower);

  const hasFreeSignal = FREE_SIGNAL_RE.test(withoutPromoFreePeriod);
  // Nível 2 — cobrança sem valor numérico: "mesa paga", "valor a combinar",
  // "pagamento via pix", "mensalidade". "Por sessão" sozinho é ambíguo demais
  // (aparece em frases sem relação a preço) — exige contexto de valor/pagamento.
  const hasPaidSignal = PAID_SIGNAL_RE.test(stripFreePricePhrases(withoutPromoFreePeriod));

  if (hasFreeSignal && hasPaidSignal) {
    // Conflito real: texto cita gratuidade E cobrança fora do padrão reconhecido
    // de período promocional. Não decide sozinho — vira needs_review.
    return { priceType: null, priceValue: null, ambiguous: true };
  }
  if (hasPaidSignal) {
    return { priceType: 'paga', priceValue: null, ambiguous: false };
  }
  if (hasFreeSignal) {
    return { priceType: 'gratuita', priceValue: null, ambiguous: false };
  }
  return { priceType: null, priceValue: null, ambiguous: false };
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
// Achado real (dado D:/teste.json, 2026-07-13): bullets reais em anúncios são
// diversos demais pra listar caractere a caractere (▬, », 〔, ┆, emoji, etc)
// — \p{S}/\p{P} (símbolo/pontuação Unicode) cobre a família toda; regra
// própria (?!(\d|https?)) evita engolir número/URL que caia logo após um
// separador tipo ":". Regex que usa BULLETS precisa da flag 'u' (\p{} exige).
const BULLETS = String.raw`[\s\p{S}\p{P}\p{Emoji_Presentation}\p{Extended_Pictographic}]{0,8}`; // bullets/decoração no começo da linha
const LINE = String.raw`(?:^|\n)`;          // início de linha

const RE_SLOT_VIA_FORMS = new RegExp(`${D}${SP1}vaga${SP1}via${SP1}forms`, 'i');
const RE_SLOT_X_DE_Y = new RegExp(`${D}${SP1}de${SP1}${D}`, 'i');
// Lookahead negativo `(?!${SP0}/${SP0}\d)` em ambas: sem ele, "Vagas
// Disponíveis: 1/4" casava só o "1" e ignorava o "/4" (mesma classe de bug já
// documentada abaixo pro caso "grupo de 5 pessoas" vs slotsGroupSize) — a
// forma "N/M" precisa cair em slotsLabeledNumericPair, não ser resolvida aqui
// como valor único (achado real, dado D:/teste.json, 2026-07-13).
const RE_SLOT_TOTAL = new RegExp(`vagas?${SP1}(?:totais|total)${SP0}${SEP}${SP0}${D}(?!${SP0}/${SP0}\\d)`, 'i');
const RE_SLOT_OPEN = new RegExp(`vagas?${SP1}(?:dispon[ií]veis|dispon[ií]vel|abertas|aberta)${SP0}${SEP}${SP0}${D}(?!${SP0}/${SP0}\\d)`, 'i');
// "1 vaga / grupo de 5 pessoas": vaga(s) aberta(s) seguida de tamanho do grupo (total).
const RE_SLOT_GROUP_SIZE = new RegExp(`${D}${SP1}vagas?${SP0}/${SP0}grupo${SP1}de${SP1}${D}${SP1}pessoas?`, 'i');
const RE_SLOT_LABELED = new RegExp(`${LINE}${BULLETS}(?:vagas(?:${SP1}dispon[ií]veis)?|jogadores)${SP0}${SEP}${SP0}${D}(?!${SP0}/)`, 'iu');
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

type SlotPairMeaning = 'open' | 'filled' | 'generic';
type SlotPairQualifierPosition = 'before' | 'after' | 'conflicting';

function slotsFromNumericPair(
  first: number,
  second: number,
  meaning: SlotPairMeaning,
  qualifierPosition: SlotPairQualifierPosition = 'before',
): SlotsResult {
  const ambiguous = (): SlotsResult => ({
    total: Math.max(first, second),
    open: null,
    ambiguity: { first, second, source: 'x_slash_y' },
  });
  if (meaning === 'generic' || qualifierPosition === 'conflicting') return ambiguous();

  const total = qualifierPosition === 'before' ? second : first;
  const count = qualifierPosition === 'before' ? first : second;
  if (total < 1 || count < 0 || count > total) return ambiguous();
  return meaning === 'open'
    ? { total, open: count, ambiguity: null }
    : { total, open: total - count, ambiguity: null };
}

function classifySlotPairLine(
  line: string,
  pairIndex: number,
  pairLength: number,
): { meaning: SlotPairMeaning; position: SlotPairQualifierPosition } {
  const before = normalize(line.slice(0, pairIndex));
  const after = normalize(line.slice(pairIndex + pairLength));
  const openSignal = /\b(?:disponiveis?|abertas?|livres?|restantes?|sobrando)\b/;
  const filledSignal = /\b(?:ocupadas?|preenchidas?|preenchidos?|inscritos?|ocupados?)\b/;
  const beforeOpen = openSignal.test(before);
  const afterOpen = openSignal.test(after);
  const beforeFilled = filledSignal.test(before);
  const afterFilled = filledSignal.test(after);
  const hasOpen = beforeOpen || afterOpen;
  const hasFilled = beforeFilled || afterFilled;
  if (!hasOpen && !hasFilled) return { meaning: 'generic', position: 'before' };
  if (hasOpen && hasFilled) return { meaning: 'generic', position: 'conflicting' };
  const onBothSides = (beforeOpen && afterOpen) || (beforeFilled && afterFilled);
  let position: SlotPairQualifierPosition = 'after';
  if (onBothSides) position = 'conflicting';
  else if (beforeOpen || beforeFilled) position = 'before';
  return { meaning: hasOpen ? 'open' : 'filled', position };
}

function slotsLabeledNumericPair(text: string): SlotsResult | null {
  // Matcher estrutural por linha: anúncios reais fecham Markdown depois do
  // separador, omitem ":", usam Nº/N° e até põem o par antes de "Vagas".
  // Vincular label + par na mesma linha evita depender dessa decoração.
  for (const line of text.split(/\r?\n/)) {
    if (!/(?:vagas?|lugares?|jogadores?)/i.test(line)) continue;
    const pair = /(\d{1,3})[^\S\r\n]{0,3}\/[^\S\r\n]{0,3}(\d{1,3})/.exec(line);
    if (!pair) continue;
    const first = Number.parseInt(pair[1], 10);
    const second = Number.parseInt(pair[2], 10);
    if (first > 100 || second > 100) continue;
    const semantic = classifySlotPairLine(line, pair.index, pair[0].length);
    return slotsFromNumericPair(first, second, semantic.meaning, semantic.position);
  }
  return null;
}

function slotsGroupSize(cleaned: string): SlotsResult | null {
  // "1 vaga / grupo de 5 pessoas": open = vagas abertas, total = tamanho do grupo.
  const m = RE_SLOT_GROUP_SIZE.exec(cleaned);
  if (!m) return null;
  const open = Number.parseInt(m[1], 10);
  const total = Number.parseInt(m[2], 10);
  return (total >= 1 && total <= 20 && open >= 0 && open <= total)
    ? { total, open, ambiguity: null }
    : null;
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
  const first = Number.parseInt(m[1], 10);
  const second = Number.parseInt(m[2], 10);
  return slotsFromNumericPair(first, second, 'generic');
}

function slotsNVagas(text: string): SlotsResult | null {
  const m = RE_SLOT_N_VAGAS.exec(text) ?? RE_SLOT_VAGAS_LABEL.exec(text);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return { total: n, open: n, ambiguity: null };
}

// Achado do mantenedor (2026-07-16): "Vagas disponíveis: 3" sem nenhuma
// menção a total vira {total:null, open:3} em toda a cascata abaixo — draft
// ficava pendente de slots_total mesmo com vaga aberta clara. Convenção real
// de mesa de RPG sem grupo declarado: 5 jogadores. Só entra quando total
// nunca foi decidido (null) E open foi (evita mascarar ambiguidade real).
const DEFAULT_SLOTS_TOTAL_WHEN_ONLY_OPEN = 5;

function extractSlots(
  text: string,
  labelAliases?: { open?: string[]; total?: string[] },
): SlotsResult {
  const cleaned = text.replaceAll('*', '');
  // Ordem: padrões explícitos primeiro; "mesa em andamento" (sem padrão explícito)
  // cai no fallback null/null (idêntico ao default) — DEB-048-16.
  const result = slotsViaForms(cleaned)
    ?? slotsXdeY(cleaned)
    // slotsGroupSize ANTES de slotsTotalOpen: "vagas disponíveis: 1 vaga /
    // grupo de 5 pessoas" bate no RE_SLOT_OPEN de slotsTotalOpen primeiro
    // (retorna {total:null, open:1} e a cascata para, "grupo de 5" nunca é
    // lido) — achado em teste real ponta a ponta, 2026-07-07.
    ?? slotsGroupSize(cleaned)
    ?? slotsLabeledNumericPair(text)
    ?? slotsTotalOpen(cleaned)
    ?? slotsLabeled(cleaned)
    ?? slotsSlashVagas(text)
    ?? slotsNVagas(text)
    ?? slotsViaLabel(text, labelAliases)
    ?? { total: null, open: null, ambiguity: null };

  if (result.total == null && result.open != null && result.ambiguity == null) {
    // Achado Codex (2026-07-16, PR #170): default fixo de 5 abaixo de `open`
    // publicava total menor que as vagas abertas anunciadas (ex.: "vagas
    // disponíveis: 8" virava total:5), e normalizeSlots clampava slots_open
    // pro total depois, escondendo vagas reais. Só usa o default quando ele
    // já cobre o open lido; senão o open é o próprio total (sem preenchidas
    // conhecidas, mesa inteira ainda aberta).
    const total = result.open <= DEFAULT_SLOTS_TOTAL_WHEN_ONLY_OPEN
      ? DEFAULT_SLOTS_TOTAL_WHEN_ONLY_OPEN
      : result.open;
    return { ...result, total };
  }
  return result;
}

// TC.8/DEB-052-01: fallback por rótulo — pega o valor de labels do template da
// comunidade (decorados são limpos por cleanLabelLine) e extrai o número. Cobre
// variações que as regexes ancoradas em linha perdiam ("» Vagas disponíveis: 5").
function slotsViaLabel(
  text: string,
  labelAliases?: { open?: string[]; total?: string[] },
): SlotsResult | null {
  // Rótulo decide a semântica. Sem qualificador, X/Y permanece ambíguo.
  const openLabelValue = extractLabelValue(text, [
    'vagas disponiveis', 'vagas disponíveis', 'vagas abertas', ...(labelAliases?.open ?? []),
  ]);
  const filledLabelValue = extractLabelValue(text, [
    'vagas ocupadas', 'vagas preenchidas', 'jogadores inscritos', 'jogadores atuais',
  ]);
  const value = openLabelValue ?? filledLabelValue ?? extractLabelValue(text, [
    'vagas', 'vagas totais', 'nº de vagas', 'n de vagas',
    'numero de vagas', 'número de vagas', 'lugares', 'jogadores', ...(labelAliases?.total ?? []),
  ]);
  if (!value) return null;
  const slash = /(\d+)\s{0,3}\/\s{0,3}(\d+)/.exec(value);
  if (slash) {
    const first = Number.parseInt(slash[1], 10);
    const second = Number.parseInt(slash[2], 10);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
    let meaning: SlotPairMeaning = 'generic';
    if (openLabelValue) meaning = 'open';
    else if (filledLabelValue) meaning = 'filled';
    return slotsFromNumericPair(first, second, meaning);
  }
  const single = /(\d{1,3})/.exec(value);
  if (!single) return null;
  const n = Number.parseInt(single[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // número único sob rótulo "disponíveis" = vagas abertas (total desconhecido)
  if (openLabelValue) return { total: null, open: n, ambiguity: null };
  if (filledLabelValue) return { total: null, open: null, ambiguity: null };
  return { total: n, open: n, ambiguity: null };
}

// Extrai dia da semana do texto
// Achado do mantenedor (2026-07-16): "Dias e horários da mesa: A decidir com
// os jogadores!" marcava start_time como "a definir" (ausência silenciosa já
// tratada como sentinela — ver extractSchedules), mas day_of_week ficava
// `null`, que a UI trata como pendência real de seleção, não como "a
// definir" já resolvido. `to_define` é o sentinela real do form (ver
// draftFormUtils.ts DraftDayOfWeek/VALID_DAYS) — precisa ser setado
// explicitamente, `null` sozinho não basta.
// Achado Sonar (PR #170): 1 regex com 4 alternativas estourava complexidade
// (59 > 20 permitido) — split em array testado com .some(), sem alternância
// aninhada, mesma cobertura.
const DAY_TO_DEFINE_PATTERNS = [
  /\b(?:a\s+)?(?:decidir|combinar|definir)\s+com\s+os?\s+jogadores?\b/,
  /\bdias?\s+(?:e\s+hor[aá]rios?\s+)?a\s+(?:decidir|combinar|definir)\b/,
  /\bhor[aá]rios?\s+a\s+(?:decidir|combinar|definir)\b/,
  /\bdia\s+a\s+(?:decidir|combinar|definir)\b/,
];

function extractDayOfWeek(text: string, labelAliases: string[] = []): string | null {
  const days: Record<string, string> = {
    segunda: 'segunda', 'segunda-feira': 'segunda',
    terça: 'terça', 'terça-feira': 'terça', terca: 'terça',
    quarta: 'quarta', 'quarta-feira': 'quarta',
    quinta: 'quinta', 'quinta-feira': 'quinta',
    sexta: 'sexta', 'sexta-feira': 'sexta',
    sábado: 'sábado', sabado: 'sábado',
    domingo: 'domingo',
  };
  const learnedLabelValue = labelAliases.length > 0 ? extractLabelValue(text, labelAliases) : null;
  const scope = learnedLabelValue ?? text;
  const lower = scope.toLowerCase();
  for (const [key, value] of Object.entries(days)) {
    if (lower.includes(key)) return value;
  }
  if (DAY_TO_DEFINE_PATTERNS.some((re) => re.test(lower))) return 'to_define';
  return null;
}

// Extrai horário do texto: "19h", "19:00", "às 20h30"
function extractStartTime(text: string, labelAliases: string[] = []): string | null {
  const learnedLabelValue = labelAliases.length > 0 ? extractLabelValue(text, labelAliases) : null;
  const target = learnedLabelValue ?? text;
  const match = /\b(\d{1,2})[hH:](\d{0,2})\b/.exec(target)
    ?? /\bàs\s{1,3}(\d{1,2})h(\d{0,2})/i.exec(target);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = (match[2] || '00').padStart(2, '0');
    return `${h}:${m}`;
  }
  return null;
}

/**
 * Extrai dia da semana e horário de TODOS os timestamps Discord <t:UNIX:FORMATO>
 * válidos no texto (fuso América/São Paulo, não UTC). Campo `day_of_week`/
 * `start_time` do form é singular (1 mesa = 1 horário recorrente); quando o
 * texto cita 2+ timestamps com dia OU horário diferentes (caso real —
 * "Ravenloft: Curse of Strahd" em `D:\teste.json` cita Terça 20:00 quinzenal
 * E Sábado 18:00 quinzenal, dias alternados da mesma campanha), não escolhe o
 * primeiro silenciosamente: marca `ambiguous: true` pra revisão humana decidir
 * qual usar (ou registrar os dois manualmente), igual ao padrão de
 * `_slots_ambiguity`/`_price_ambiguity`.
 */
function extractDiscordTimestamp(text: string): { dayOfWeek: string; startTime: string; ambiguous: boolean } | null {
  const pattern = /<t:(\d+):([a-zA-Z]+)>/g;
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const found: { dayOfWeek: string; startTime: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const unix = Number.parseInt(match[1], 10);
    if (!Number.isFinite(unix) || unix <= 0) continue;
    const date = new Date(unix * 1000);
    if (Number.isNaN(date.getTime())) continue;

    const parts = formatter.formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? null;
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    if (!weekday) continue;
    // Intl 'long' devolve "segunda-feira"; o canônico do projeto (extractDayOfWeek)
    // é a forma curta "segunda". Normalizar removendo o sufixo "-feira".
    const dayOfWeek = weekday.toLowerCase().replace(/-feira$/, '');
    found.push({ dayOfWeek, startTime: `${hour}:${minute}` });
  }

  if (found.length === 0) return null;
  const distinct = new Set(found.map((f) => `${f.dayOfWeek}|${f.startTime}`));
  return { ...found[0], ambiguous: distinct.size > 1 };
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
  // Retorno no formato do enum Postgres real: `+18` (sinal ANTES) — `18+`
  // estourava 500 no sync (achado do mantenedor 2026-07-08).
  // Achado do mantenedor (2026-07-16): "Faixa Etária: 20+" não casava nenhum
  // padrão (enum só vai até +18) e ficava null — qualquer N ≥ 18 com sinal
  // "+"/"maiores de" é tratado como +18 (teto do enum, não existe faixa
  // adulta mais restritiva que isso no catálogo).
  // Achado Sonar (PR #170): alternância única com 3 ramos estourava
  // complexidade de regex (22 > 20 permitido) — 3 testes separados no mesmo
  // número (1[89]|[2-9]\d), sem alternância aninhada, mantêm a leitura igual.
  const AGE_18_PLUS_NUM = '(?:1[89]|[2-9]\\d)';
  if (
    new RegExp(`\\+\\s?${AGE_18_PLUS_NUM}\\b`).test(lower) ||
    new RegExp(`\\b${AGE_18_PLUS_NUM}\\s?\\+`).test(lower) ||
    new RegExp(`\\bmaiores\\s{1,3}de\\s{1,3}${AGE_18_PLUS_NUM}\\b`).test(lower)
  ) return '+18';
  if (/\+\s?16\b|\b16\s?\+|\bmaiores\s{1,3}de\s{1,3}16\b/.test(lower)) return '+16';
  if (/\+\s?14\b|\b14\s?\+|\bmaiores\s{1,3}de\s{1,3}14\b/.test(lower)) return '+14';
  if (/\+\s?12\b|\b12\s?\+|\bmaiores\s{1,3}de\s{1,3}12\b/.test(lower)) return '+12';
  if (/\+\s?10\b|\b10\s?\+|\bmaiores\s{1,3}de\s{1,3}10\b/.test(lower)) return '+10';
  if (/\bclassifica[cç][aã]o\s{1,3}livre\b/.test(lower)) return 'livre';
  if (/\blivre\s{1,3}para\s{1,3}todos\b/.test(lower)) return 'livre';
  return null;
}

function extractExperienceLevel(text: string): TableDraftExperienceLevel | null {
  const lower = normalize(text);
  const hasNewPlayerSignal = ['iniciante', 'iniciantes', 'novato', 'novatos', 'primeira mesa', 'primeiro rpg']
    .some((signal) => lower.includes(signal));
  const acceptsNewPlayers = [
    'bem vindo',
    'bem vinda',
    'bem vindos',
    'bem vindas',
    'aceito',
    'aceita',
    'aceitos',
    'aceitas',
    'permitido',
    'permitida',
    'permitidos',
    'permitidas',
    'sem experiencia',
    'nao precisa experiencia',
  ].some((signal) => lower.includes(signal));
  if (hasNewPlayerSignal && acceptsNewPlayers) {
    return 'iniciante';
  }
  if (['todos os niveis', 'qualquer nivel', 'todos bem vindos'].some((signal) => lower.includes(signal))) return 'todos';
  if (['veterano', 'veterana', 'veteranos', 'veteranas', 'experiente', 'experientes', 'experiencia obrigatoria', 'nao recomendado para iniciante', 'nao recomendada para iniciante'].some((signal) => lower.includes(signal))) {
    return 'veterano';
  }
  if (['intermediario', 'intermediaria', 'intermediarios', 'intermediarias', 'alguma experiencia', 'experiencia media'].some((signal) => lower.includes(signal))) return 'intermediario';
  return null;
}

function extractTableLevel(text: string): TableDraftTableLevel | null {
  const lower = normalize(text);
  if (['mesa iniciante', 'mesa para iniciante', 'mesa para iniciantes', 'aventura iniciante', 'aventura para iniciante', 'aventura para iniciantes', 'campanha iniciante', 'campanha para iniciante', 'campanha para iniciantes', 'complexidade: iniciante', 'complexidade iniciante'].some((signal) => lower.includes(signal))) {
    return 'iniciante';
  }
  if (['complexidade: avancado', 'complexidade avancado', 'complexidade: avancada', 'complexidade avancada', 'complexidade: alta', 'complexidade alta', 'mesa avancado', 'mesa avancada', 'mesa desafiadora', 'mesa dificil', 'aventura avancada', 'aventura desafiadora', 'aventura dificil', 'campanha avancada', 'campanha desafiadora', 'campanha dificil'].some((signal) => lower.includes(signal))) {
    return 'avancado';
  }
  if (['complexidade: intermediario', 'complexidade intermediario', 'complexidade: intermediaria', 'complexidade intermediaria', 'mesa intermediaria', 'mesa intermediario', 'aventura intermediaria', 'aventura intermediario', 'campanha intermediaria', 'campanha intermediario'].some((signal) => lower.includes(signal))) {
    return 'intermediario';
  }
  return null;
}

type RequirementExtraction = { value: boolean | null; ambiguous: boolean };

/**
 * Extrai requisito técnico via TEXTO como tri-state: "necessário ter PC" vira
 * `true`; "PC recomendável, não obrigatório" vira `false`; sem menção textual
 * fica `null` (decidido depois por inferência estrutural de VTT/plataforma —
 * ver extractTechnicalRequirements/parseDiscordAnnouncement, achado do
 * mantenedor 2026-07-16: citar "Discord"/VTT sozinho não bastava aqui, mas
 * VTT/Discord detectados por catálogo agora inferem PC/microfone quando o
 * texto não decidiu nada).
 *
 * Frases negativas/opcionais são removidas antes de procurar sinal positivo,
 * evitando que "não é necessário ter PC" também case o trecho interno
 * "necessário ter PC". Se o anúncio traz sinais positivos e negativos
 * distintos pro mesmo item, não decide: `ambiguous=true` leva o draft à revisão.
 */
function extractTechnicalRequirement(
  text: string,
  subjectPattern: string,
  qualityPattern?: string,
): RequirementExtraction {
  const source = normalize(text);
  const negativePatterns = [
    new RegExp(String.raw`\bnao\s+(?:(?:e|sendo)\s+)?(?:necessari[oa]|obrigatori[oa]|exigid[oa])\s+(?:ter|possuir|usar)?\s*(?:um|uma)?\s*(?:${subjectPattern})\b`, 'gi'),
    new RegExp(String.raw`\bnao\s+precisa(?:m)?\s+(?:ter|possuir|usar)?\s*(?:um|uma)?\s*(?:${subjectPattern})\b`, 'gi'),
    new RegExp(String.raw`\b(?:${subjectPattern})\b[^.\n;]{0,32}\b(?:opcional|dispensavel|nao\s+obrigatori[oa])\b`, 'gi'),
    new RegExp(String.raw`\b(?:recomendavel|recomendo|desejavel|preferencia\s+por)\b[^.\n;]{0,32}\b(?:${subjectPattern})\b`, 'gi'),
  ];

  let positiveScope = source;
  let hasNegative = false;
  for (const pattern of negativePatterns) {
    positiveScope = positiveScope.replace(pattern, () => {
      hasNegative = true;
      return ' ';
    });
  }

  const positivePatterns = [
    new RegExp(String.raw`\b(?:necessari[oa]|obrigatori[oa]|exigid[oa])\s+(?:ter|possuir|usar)?\s*(?:um|uma)?\s*(?:${subjectPattern})\b`, 'i'),
    new RegExp(String.raw`\b(?:${subjectPattern})\b[^.\n;]{0,24}\b(?:necessari[oa]|obrigatori[oa]|exigid[oa])\b`, 'i'),
    new RegExp(String.raw`\b(?:precisa|precisam|deve|devem|tem\s+que|ter\s+que)\s+(?:ter|possuir|usar)?\s*(?:um|uma)?\s*(?:${subjectPattern})\b`, 'i'),
    new RegExp(String.raw`\b(?:requisito|exigencia)\b[^.\n;]{0,32}\b(?:${subjectPattern})\b`, 'i'),
    new RegExp(String.raw`\b(?:somente|apenas)\s+(?:via|por|com)?\s*(?:um|uma)?\s*(?:${subjectPattern})\b`, 'i'),
    ...(qualityPattern
      ? [new RegExp(String.raw`\b(?:${subjectPattern})\b[^.\n;]{0,16}\b(?:${qualityPattern})\b`, 'i')]
      : []),
  ];
  const hasPositive = positivePatterns.some((pattern) => pattern.test(positiveScope));

  if (hasPositive && hasNegative) return { value: null, ambiguous: true };
  if (hasPositive) return { value: true, ambiguous: false };
  if (hasNegative) return { value: false, ambiguous: false };
  return { value: null, ambiguous: false };
}

function extractTechnicalRequirements(text: string): {
  pc: RequirementExtraction;
  camera: RequirementExtraction;
  microphone: RequirementExtraction;
} {
  return {
    pc: extractTechnicalRequirement(text, 'pc|computador|notebook'),
    camera: extractTechnicalRequirement(text, 'camera|webcam', 'ligad[ao]|abert[ao]|ativad[ao]|funcionando'),
    microphone: extractTechnicalRequirement(text, 'mic|microfone', String.raw`bom|audivel|ligad[ao]|ativad[ao]|funcionando|com\s+qualidade`),
  };
}

/** Fase C (spec 058): normaliza lista de texto livre separada por `/`, `,` ou "e"/"ou". */
function splitFreeTextList(value: string): string[] | null {
  const parts = value
    .split(/\s*(?:\/|,| e | ou )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}


// Dominios reais de contato/inscricao vistos no corpus (D:\teste.json).
const KNOWN_CONTACT_URL_PATTERNS = [
  /discord(?:app)?\.com\/invite\//i,
  /discord\.gg\//i,
  /forms\.gle\//i,
  /docs\.google\.com\/forms\//i,
  /typeform\.com\//i,
  /wa\.me\//i,
  /chat\.whatsapp\.com\//i,
  /t\.me\//i,
  /mesaquest\.com\.br\//i,
  /linktr\.ee\//i,
];

function isKnownContactUrl(url: string): boolean {
  return KNOWN_CONTACT_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function countChar(value: string, char: string): number {
  let count = 0;
  for (const current of value) {
    if (current === char) count += 1;
  }
  return count;
}

function trimTrailingUrlWrappers(url: string): string {
  let trimmed = url.replace(/[.,;:]+$/g, '');
  let previous = '';
  while (previous !== trimmed) {
    previous = trimmed;
    if (trimmed.endsWith(')') && countChar(trimmed, '(') < countChar(trimmed, ')')) {
      trimmed = trimmed.slice(0, -1);
    }
    if (trimmed.endsWith(']') && countChar(trimmed, '[') < countChar(trimmed, ']')) {
      trimmed = trimmed.slice(0, -1);
    }
  }
  return trimmed;
}

function extractRawHttpUrls(text: string): string[] {
  const urls: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const httpIndex = text.indexOf('http://', cursor);
    const httpsIndex = text.indexOf('https://', cursor);
    const indexes = [httpIndex, httpsIndex].filter((index) => index >= 0);
    if (indexes.length === 0) break;
    const start = Math.min(...indexes);
    let end = start;
    while (end < text.length && !isUrlDelimiter(text[end])) {
      end += 1;
    }
    urls.push(text.slice(start, end));
    cursor = end;
  }
  return urls;
}

function isUrlDelimiter(char: string): boolean {
  return char === '<' || char === '>' || char === '"' || char === "'" || char.trim() === '';
}

const CONTACT_CONTEXT_LINE_RE = /\b(contato|inscri[cç][aã]?[õo]?[eos]*|candidatura|interesse|ticket|link\s+de\s+contato)\b/i;

/**
 * true se a URL aparece numa linha com sinal textual de contato/inscrição
 * ("Contato:", "Inscrição:", "Link de candidatura: <url>"). Usado pro
 * fallback de `extractContactUrl` distinguir URL genuína de contato de link
 * incidental (setting page, playlist, review) que só por estar solta no
 * texto acabava virando contact_url — achado CodeRabbit PR #144.
 */
function urlHasContactContext(text: string, url: string): boolean {
  return text.split(/\r?\n/).some((line) => line.includes(url) && CONTACT_CONTEXT_LINE_RE.test(line));
}

/**
 * Extrai URL de contato (discord invite, forms, MesaQuest, etc.). Cascata: com
 * 2+ URLs no texto, prioriza domínio de contato/inscrição CONHECIDO sobre
 * qualquer outra (site institucional, link de "diferenciais", playlist) — sem
 * isso, a primeira URL do texto vence só por ordem de aparição, que pode ser
 * um link de referência em vez do canal de inscrição real (caso real: "Heróis
 * de Thylea" em D:\teste.json cita site institucional, link de reviews E link
 * de candidatura no mesmo anúncio, em ordens variadas). Com 0 ou 1 URL
 * conhecida, comportamento é o mesmo de antes (pega a única disponível).
 *
 * `confident: false` sinaliza fallback sem domínio conhecido NEM contexto de
 * linha de contato — URL genuinamente incerta (pode ser link não relacionado
 * a contato), que o caller deve marcar pra revisão em vez de aceitar como
 * `ready` (achado CodeRabbit PR #144: qualquer URL sintaticamente válida
 * virava contact_url mesmo sem nenhum sinal de que era canal de inscrição).
 */
function extractContactUrl(text: string, labelAliases: string[] = []): { url: string; confident: boolean } | null {
  const allMatches = extractRawHttpUrls(text).map(trimTrailingUrlWrappers);
  if (allMatches.length === 0) return null;
  const learnedLabelValue = labelAliases.length > 0 ? extractLabelValue(text, labelAliases) : null;
  const learnedUrl = learnedLabelValue
    ? extractRawHttpUrls(learnedLabelValue).map(trimTrailingUrlWrappers)[0] ?? null
    : null;
  if (learnedUrl) return { url: learnedUrl, confident: true };
  const known = allMatches.find(isKnownContactUrl);
  if (known) return { url: known, confident: true };
  const withContext = allMatches.find((url) => urlHasContactContext(text, url));
  if (withContext) return { url: withContext, confident: true };
  return { url: allMatches[0], confident: false };
}

function extractContactDiscord(text: string): string | null {
  const mentionPattern = /<#\d+>|<@!?\d+>/;
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
  // Heading markdown (`#`..`######`) também precisa cair aqui: `## Sinopse`
  // sem isso nunca normaliza pra `sinopse`, e extractLabelValue cai no
  // fallback de body inteiro sem stop de continuação (achado ao corrigir
  // review dos bots na PR #128 — descrição engolindo cabeçalho seguinte).
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^[\s▬•\-–—»«►▶◄●○◆◇■□▪▫☆★✦✧➤➥➔→·|]+/u, '')
    .replace(/^[\p{Extended_Pictographic}️\s]+/u, '')
    .replace(/^[\s▬•\-–—»«►▶◄●○◆◇■□▪▫☆★✦✧➤➥➔→·|]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLabelKey(value: string): string {
  return normalize(value).replace(/\s+/g, ' ').trim();
}

export function splitLabelLine(line: string): { key: string; value: string } | null {
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

const BARE_LABEL_STOP_KEYS = new Set([
  'sistema',
  'jogo',
  'rpg',
  'mesa',
  'titulo',
  'nome da mesa',
  'aventura',
  'vagas',
  'vagas disponiveis',
  'vagas abertas',
  'dias e horarios da mesa',
  'horario',
  'data',
  'valor',
  'preco',
  'plataforma',
  'plataformas',
  'local do jogo',
  'faixa etaria',
  'classificacao',
  'ambientacao',
  'cenario',
  'estilo',
  'contato',
  'inscricao',
  'mestre',
  'gm',
  'narrador',
  'dm',
]);

function isBareLabelStopLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  const cleaned = cleanLabelLine(trimmed).replace(/^#{1,6}\s+/, '').trim();
  return cleaned.length > 0 && BARE_LABEL_STOP_KEYS.has(normalizeLabelKey(cleaned));
}

function shouldStopLabelContinuation(line: string): boolean {
  if (splitLabelLine(line)) return true;
  if (isBareLabelStopLine(line)) return true;
  const lower = line.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

// Coleta linhas de continuação de um rótulo. Por padrão para na 1ª linha vazia
// (com valor já coletado) ou novo rótulo — certo pra campo curto (Sistema,
// Vagas, Plataforma). `multiParagraph` atravessa linhas vazias (parágrafos)
// e só para em novo rótulo real ou fim do texto — necessário pra "Sinopse"/
// "Descrição", que são naturalmente multi-parágrafo (linha vazia separa
// parágrafo, não marca fim do campo).
function collectLabelContinuation(lines: string[], startIdx: number, firstValue: string, multiParagraph = false): string[] {
  const values: string[] = [];
  if (firstValue) values.push(firstValue);

  for (let j = startIdx; j < lines.length; j++) {
    const next = lines[j].trim();
    if (!next) {
      if (multiParagraph) {
        // preserva a quebra de parágrafo no valor final, mas só se já há
        // conteúdo (evita linha em branco solta no início do valor)
        if (values.length > 0) values.push('');
        continue;
      }
      if (values.length > 0) break;
      continue;
    }
    if (shouldStopLabelContinuation(next)) break;
    values.push(next);
  }
  // remove linhas vazias no fim (podem sobrar se o texto termina em branco)
  while (values.at(-1) === '') values.pop();
  return values;
}

function extractLabelValue(
  text: string,
  labels: string[],
  opts?: { keepParenthetical?: boolean; multiParagraph?: boolean },
): string | null {
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

    const values = collectLabelContinuation(lines, continuationStart, firstValue ?? '', opts?.multiParagraph);

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
// `#` fica de fora deste marcador (mesmo estando em SEPARATOR_LINE_CHARS pra
// linha 100% decorativa acima): heading markdown (`## Sinopse`, `### Titulo`)
// é estrutura, não decoração solta — precisa sobreviver até
// isBareLabelStopLine reconhecer o próximo cabeçalho como fim de continuação
// multi-parágrafo (achado ao corrigir review dos bots na PR #128 —
// descrição engolindo o cabeçalho/seção seguinte).
const LEADING_MARKER_CHARS = SEPARATOR_LINE_CHARS.replace('#', '');
const LEADING_MARKER_RE = new RegExp(`^[${LEADING_MARKER_CHARS}]+\\s*`);
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
const RAW_DISCORD_TOKEN_RE = /<@[!&]?\d+>|<#\d+>|<t:\d+:[tTdDfFR]>/g;

function shouldRemoveContactUrl(rawUrl: string, contactUrl: string | null): boolean {
  const url = trimTrailingUrlWrappers(rawUrl);
  return url === contactUrl || isKnownContactUrl(url);
}

function removeKnownRawUrls(line: string, contactUrl: string | null): string {
  let cleaned = line;
  for (const raw of extractRawHttpUrls(line)) {
    if (!shouldRemoveContactUrl(raw, contactUrl)) continue;
    const url = trimTrailingUrlWrappers(raw);
    cleaned = cleaned.replace(raw, raw.slice(url.length));
  }
  return cleaned;
}

function removeKnownMarkdownContactLinks(line: string, contactUrl: string | null): string {
  let output = '';
  let cursor = 0;
  while (cursor < line.length) {
    const labelStart = line.indexOf('[', cursor);
    if (labelStart < 0) {
      output += line.slice(cursor);
      break;
    }
    const labelEnd = line.indexOf('](', labelStart);
    if (labelEnd < 0) {
      output += line.slice(cursor);
      break;
    }
    const urlStart = labelEnd + 2;
    const urlEnd = line.indexOf(')', urlStart);
    if (urlEnd < 0) {
      output += line.slice(cursor);
      break;
    }
    const rawUrl = line.slice(urlStart, urlEnd);
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      output += line.slice(cursor, urlEnd + 1);
      cursor = urlEnd + 1;
      continue;
    }
    output += line.slice(cursor, labelStart);
    if (!shouldRemoveContactUrl(rawUrl, contactUrl)) {
      output += line.slice(labelStart, urlEnd + 1);
    }
    cursor = urlEnd + 1;
  }
  return output;
}

function removeKnownContactUrlsFromDescription(text: string, contactUrl: string | null): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const originalTrimmed = line.trim();
      const withoutMarkdownLinks = removeKnownMarkdownContactLinks(line, contactUrl);
      const withoutUrls = removeKnownRawUrls(withoutMarkdownLinks, contactUrl);
      const withoutBrokenMarkdown = withoutUrls !== withoutMarkdownLinks
        ? withoutUrls
          .replace(/\[[^\]]+\]\(\s*[)\]]*\)?/g, '')
          .replace(/\s+\[[^\]]+\]$/g, '')
        : withoutUrls;
      const trimmed = withoutBrokenMarkdown.trim();
      const parsed = splitLabelLine(trimmed);
      if (trimmed !== originalTrimmed && parsed && parsed.value.trim().length === 0) return '';
      return /^[)\].,;:]+$/.test(trimmed) ? '' : trimmed;
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

// Labels que o parser já extrai pra campo próprio em algum lugar (título,
// sistema, dia/horário/vagas/preço/tipo/modalidade via regex sobre fullText,
// plataformas, estilo, cenário, contato/host). Linha `label: valor` reconhecida
// aqui é removida da description por já virar dado estruturado em outro campo.
// Achado do mantenedor (2026-07-10): "Nível atual: Nível 13" (sem campo próprio
// no form) estava sendo removido pela versão anterior (que removia QUALQUER
// `label: valor`), perdendo a informação sem ela sobrar em lugar nenhum. Só
// remove o que tem destino confirmado; label desconhecido fica na description.
const FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS = new Set([
  'mesa', 'titulo', 'título', 'nome da mesa', 'aventura',
  'sistema', 'jogo', 'rpg', 'sistema de jogo', 'sistema utilizado',
  'plataforma', 'plataformas', 'local do jogo',
  'estilo', 'indicado',
  'ambientacao', 'ambientação', 'cenario', 'cenário',
  'dia', 'dia local', 'horario', 'horário', 'data', 'data e horario', 'data e horário',
  'vagas', 'vagas abertas', 'vagas disponiveis', 'vagas disponíveis', 'numero de vagas', 'número de vagas',
  'preco', 'preço', 'valor', 'tipo', 'modalidade', 'frequencia', 'frequência',
  'contato', 'discord', 'link', 'inscricao', 'inscrição', 'candidatura',
  'mestre', 'gm', 'narrador', 'dm', 'classificacao', 'classificação', 'faixa etaria', 'faixa etária',
].map(normalizeLabelKey));

function buildFallbackDescription(body: string): string | null {
  // T11.1 (fix real, achado ao validar contra os 3 datasets D:\teste*.json):
  // a versão anterior só removia linha se a chave estivesse na allowlist
  // BARE_LABEL_STOP_KEYS (pensada pra "label sozinho, sem valor, marca fim
  // de continuação") — deixava vazar QUALQUER label:valor real fora dessa
  // lista pequena (ex.: "Nível:", "Local:", "Data & Horário:", "Vagas
  // Disponíveis:" normalizam pra chaves que não estão na allowlist e
  // sobreviviam inteiras dentro da description). Fix T11.1: passou a remover
  // qualquer linha que `splitLabelLine` reconheça como par `label: valor` COM
  // VALOR NÃO VAZIO — mas isso também descartava labels reais sem campo
  // próprio (ex. "Nível atual"), perdendo informação. Fix 2026-07-10: só
  // remove quando a chave está em FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS
  // (campo com destino confirmado); label reconhecido mas não mapeado
  // permanece na description, preservando o dado. Sub-título narrativo real
  // (ex.: "A Expedição:" seguido do texto na linha seguinte, caso real "The
  // Witherwild") também bate a sintaxe `chave:` com valor vazio — só rótulo
  // de campo de verdade vem com o valor colado na mesma linha.
  const cleaned = body
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      const parsed = splitLabelLine(trimmed);
      if (parsed && parsed.value.trim().length > 0) {
        return !FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS.has(parsed.key);
      }
      return !isBareLabelStopLine(trimmed);
    })
    .join('\n')
    .trim();
  return cleaned || null;
}

// Achado do mantenedor (2026-07-10): description final preservava markdown
// estrutural cru — heading (`### O Sistema:`) e blockquote (`> *frase*`) do
// Discord sobrevivendo ao texto exibido. `stripDecorativeMarkup` já sabe
// limpar isso mas só era usado em título/system hint. Aqui só o PREFIXO de
// linha (heading `#{1,6}` ou blockquote `>`) é removido — preserva `#`/`>`
// soltos no meio de frase (hashtag, "maior que") e toda pontuação de frase
// normal, que a versão de título não precisa preservar.
const LINE_PREFIX_MARKDOWN_RE = /^[^\S\n]{0,3}(?:#{1,6}|>)[^\S\n]*/gm;

// Achado 2026-07-15: caractere nulo (0x00) em texto colado do Discord
// sobrevive em string JS mas quebra serialização JSONB no Postgres
// ("invalid input syntax for type json") em qualquer insert/update
// subsequente do draft. Remove na entrada do parser, antes de extrair
// qualquer campo (title/description/hints).
// eslint-disable-next-line no-control-regex -- remoção intencional do byte nulo
const NULL_BYTE_RE = /\x00/g;

export function stripNullBytes(text: string): string {
  return text.replace(NULL_BYTE_RE, '');
}

// Achado Codex (PR #168): stripNullBytes só cobre string_raw — embeds/
// attachments do Discord (objetos/arrays aninhados) também podem carregar
// 0x00 em campos de texto (description, field.value, filename) e quebram o
// mesmo jsonb::INSERT. Sanitiza recursivamente qualquer valor antes de virar
// JSON persistido.
export function sanitizeJsonValue<T>(value: T): T {
  if (typeof value === 'string') {
    return stripNullBytes(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeJsonValue(val);
    }
    return result as T;
  }
  return value;
}

export function cleanDescriptionText(text: string): string {
  return text
    .replace(RAW_DISCORD_TOKEN_RE, '')
    .replace(LINE_PREFIX_MARKDOWN_RE, '')
    .replace(/\s*\[(?:form|forms|formul[aá]rio|inscri[cç][aã]o|link)\]\s*/gi, ' ')
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
// Faixas de controle C0 (\u0000-\u0008, \u000B, \u000C, \u000E-\u001F) filtradas por codigo
// de caractere (nao regex): no-control-regex proibe intervalo de controle em character class
// de regex literal, entao a checagem vira funcao pura em vez de casar via regex.
function isC0ControlChar(code: number): boolean {
  return code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f);
}

function stripC0ControlChars(value: string): string {
  let result = '';
  for (const ch of value) {
    if (!isC0ControlChar(ch.codePointAt(0) ?? -1)) result += ch;
  }
  return result;
}

function stripDecorativeMarkup(value: string): string {
  const ZERO_WIDTH_AND_CONTROL = /[\u200B-\u200F\u202A-\u202E\uFEFF\uFFFD]/g;
  const DECORATIVE_MARKS = /[#*_~`\u25AC\u25AD\u25BA\u25B6\u00BB\u00AB\u2501\u2500\u2503\u2505\u2504\u254D\u2726]+/g;
  const WHITELIST = /[^\p{L}\p{N}\s'&:-]/gu;

  return stripC0ControlChars(value)
    .normalize('NFC')
    // zero-width/BOM/replacement chars (controle C0 ja removido acima)
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

// Palavras curtas PT-BR que ficam minúsculas em title case (exceto na 1ª posição).
const TITLE_CASE_LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os', 'para', 'com']);

// Achado do mantenedor (2026-07-10): títulos em CAPS LOCK ("GRADIENTE
// DESCENDENTE 4") sobrevivem crus do Discord. Caso real ("teste.json"): título
// vem PARCIALMENTE em caixa-alta ("GRADIENTE DESCENDENTE 4 - Variáveis
// Implícitas" — 1ª parte gritada, 2ª já em title case correto), então checar
// a proporção de maiúsculas do título INTEIRO (1ª versão) diluía o sinal e
// deixava a parte gritada intacta. Fix: avalia CADA PALAVRA isoladamente —
// palavra com 4+ letras 100% maiúscula (sem dígito, sem minúscula) vira title
// case; palavra que já tem minúscula ou tem dígito (2D6, D20, D&D, 5e'14)
// fica intocada, preservando siglas curtas soltas tipo "RPG" (3 letras).
// Achado CodeRabbit (PR #144): stopword após pontuação de cláusula (":", ".",
// "!", "?", "-") é início de nova cláusula, não meio de frase — "Vampiro: A
// Máscara" tinha o "A" rebaixado pra minúsculo por só checar `index > 0`, sem
// considerar que a palavra anterior fechava uma cláusula com ":".
const CLAUSE_END_RE = /[:.!?-]$/;

function normalizeTitleCapitalization(value: string): string {
  const words = value.split(' ');
  return words
    .map((word, index) => {
      if (!word) return word;
      const letters = word.replace(/[^\p{L}]/gu, '');
      if (!letters) return word;
      // token com dígito (2D6, D20, 5e'14) ou já contém minúscula real (D&D) — preserva
      if (/\d/.test(word) || /\p{Ll}/u.test(word)) return word;
      const upperLetters = word.replace(/[^\p{Lu}]/gu, '');
      if (upperLetters.length !== letters.length) return word;
      // sigla curta solta (RPG, GM) fica intocada — só normaliza palavra de
      // 4+ letras (limite empírico pra não confundir sigla real com stopword
      // gritada); stopword PT-BR curta (DE/DA/DO/E/A/O) sempre vira minúscula
      // mesmo com <4 letras, pois artigo/preposição não é sigla — exceto no
      // início de cláusula (índice 0 OU depois de pontuação de frase).
      const lower = word.toLocaleLowerCase('pt-BR');
      const isStopword = TITLE_CASE_LOWERCASE_WORDS.has(lower);
      if (letters.length < 4 && !isStopword) return word;
      const isClauseStart = index === 0 || CLAUSE_END_RE.test(words[index - 1] ?? '');
      if (!isClauseStart && isStopword) return lower;
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    })
    .join(' ');
}

function normalizeTitle(value: string | null): string | null {
  if (!value) return null;
  const cleaned = stripDecorativeMarkup(value.replace(/^["“”']|["“”']$/g, '').trim());
  const trademarkCleaned = cleanTrademark(cleaned);
  return trademarkCleaned ? normalizeTitleCapitalization(trademarkCleaned) : null;
}

// Penalidade fixa por sinal de ambiguidade detectado durante o parse — um
// campo "preenchido" que na verdade veio de heurística conflitante não deve
// contar como sinal pleno de confiança. Cada ambiguidade citada em `_notes`/
// `_slots_ambiguity`/`_price_ambiguity`/`_homebrew_suspect` desconta um passo
// fixo; nunca deixa o draft bater 100% quando há alguma.
const AMBIGUITY_PENALTY = 0.15;

// Calcula confiança com base nos campos preenchidos, descontada por ambiguidade
// real detectada no parse (não é só "campo != null" — um valor extraído por
// heurística conflitante não é sinal pleno de confiança).
function calcConfidence(table: DiscordTableDraftTable): number {
  const fields: Array<keyof DiscordTableDraftTable> = [
    'title', 'system_name', 'type', 'modality', 'price_type',
    'slots_total', 'day_of_week', 'start_time', 'description',
  ];
  const filled = fields.filter((f) => table[f] != null).length;
  const base = filled / fields.length;

  const ambiguityCount = [
    table._slots_ambiguity != null,
    table._price_ambiguity === true,
    table._schedule_ambiguity === true,
    table._homebrew_suspect === true,
  ].filter(Boolean).length;

  const penalized = Math.max(0, base - ambiguityCount * AMBIGUITY_PENALTY);
  return Math.round(penalized * 100) / 100;
}

// T-G1: tiers de confiança para gates comportamentais (thresholds sincronizados com confidenceColor no frontend)
export type ConfidenceTier = 'muito_alta' | 'alta' | 'media' | 'baixa';

export function classifyConfidence(score: number): ConfidenceTier {
  if (score >= 0.85) return 'muito_alta';
  if (score >= 0.65) return 'alta';
  if (score >= 0.4) return 'media';
  return 'baixa';
}

// T-G2: sinais de ambiguidade adicionais.
// Achado do mantenedor (2026-07-10): antes marcava QUALQUER URL fora da
// allowlist curta (KNOWN_CONTACT_URL_PATTERNS, ~10 domínios) como suspeita —
// site pessoal de GM real ("dm.yanbraga.com/join"), extraído com confiança
// alta do próprio anúncio, sempre bloqueava o draft de virar 'ready' (422
// "contact_url:suspicious"). Fix: só é suspeito quando a URL está malformada
// (sem esquema http/https, sem domínio válido) — allowlist deixa de ser gate
// de bloqueio e vira só um sinal de prioridade/confiança em outros lugares
// que ainda usem isKnownContactUrl diretamente.
export function isSuspiciousUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(parsed.hostname);
  } catch {
    return true;
  }
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
 * menção solta de "próprio/autoral" no corpo.
 * @param labelAliasesSystem DEB-052-02: rótulos extras aprendidos pro campo
 * `system_name` (achado CodeRabbit PR #144) — sem isso, um anúncio com rótulo
 * de sistema não-fixo (ex. "Jogo do dia:") nunca acha o hint aqui, e um
 * sistema autoral/próprio anunciado sob esse rótulo escapa do descarte. */
function getAnnouncementSystemHint(message: ImportRawMessage, labelAliasesSystem?: string[]): string | null {
  const threadName = stripNullBytes(message.discord_thread_name ?? '');
  const rawBody = stripNullBytes(message.content_raw ?? '');
  const body = stripSeparatorLines(rawBody.trim() || extractBodyFromEmbeds(message.embeds ?? []));
  if (!body.trim()) return null;
  const explicitSystem = normalizeTitle(extractLabelValue(body, [
    'sistema', 'jogo', 'rpg', 'sistema de jogo', 'sistema utilizado', ...(labelAliasesSystem ?? []),
  ], { keepParenthetical: true }));
  const threadParts = splitThreadName(threadName || body.split('\n')[0] || 'Mesa sem título');
  const hint = explicitSystem ?? threadParts.systemHint;
  return hint ? hint.split(/[\r\n]/)[0].trim() || null : null;
}

/** DEB-048-27: true se o sistema do anúncio é autoral/próprio (→ descartar). */
export function classifyHomebrew(message: ImportRawMessage, labelAliasesSystem?: string[]): HomebrewClass {
  const hint = getAnnouncementSystemHint(message, labelAliasesSystem);
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
 * @param labelAliases DEB-052-02: rótulos extras aprendidos por campo (via
 *                   correção humana, `loadActiveLabelAliases`), somados à
 *                   allowlist fixa antes de `extractLabelValue`. Sem isso,
 *                   cada variação de rótulo humano ("sistema utilizado:")
 *                   precisaria virar exceção codificada.
 */
export function parseDiscordAnnouncement(
  message: ImportRawMessage,
  systems: SystemEntry[] = [],
  replyContext?: string,
  /** Fase A/B/C (spec 058): bancos de referência opcionais pra VTT/comunicação. */
  platforms?: { vtt?: MatchEntry[]; communication?: MatchEntry[]; scenarios?: MatchEntry[] },
  labelAliases?: Record<string, string[]>,
): ImportTableDraft | null {
  // Achado 2026-07-15: mensagem do Discord com caractere nulo (byte 0x00,
  // provável de colagem/emoji corrompido) sobrevivia até virar description/
  // title no draft e quebrava toda serialização JSONB subsequente (correction,
  // learning feedback) com "invalid input syntax for type json" — Postgres
  // aceita 0x00 dentro de string JSON escapada, mas rejeita ao extrair/
  // re-inserir como texto. Sanitiza na entrada, antes de qualquer extração.
  const threadName = stripNullBytes(message.discord_thread_name ?? '');
  const rawBody = stripNullBytes(message.content_raw ?? '');
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
  const homebrew = classifyHomebrew(message, labelAliases?.system_name);
  if (homebrew === 'discard') {
    return null;
  }
  const fullText = `${threadName}\n${body}`.trim();

  // Título e dica de sistema (a partir do nome do thread)
  const threadParts = splitThreadName(threadName || body.split('\n')[0] || 'Mesa sem título');
  const explicitTitle = normalizeTitle(extractLabelValue(body, [
    'mesa', 'titulo', 'título', 'nome da mesa', 'aventura', ...(labelAliases?.title ?? []),
  ]));
  const explicitSystem = normalizeTitle(extractLabelValue(body, [
    'sistema', 'jogo', 'rpg', 'sistema de jogo', 'sistema utilizado', ...(labelAliases?.system_name ?? []),
  ]));
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
  const systemCandidates = buildSystemCandidates(systemHint, systems, systemId);

  // Campos extraídos do corpo
  const modality = extractModality(body) ?? 'online';
  const type = extractType(fullText) ?? (threadName ? 'campanha' : null);
  const { priceType, priceValue, ambiguous: priceAmbiguous } = extractPrice(body, [
    ...(labelAliases?.price_type ?? []),
    ...(labelAliases?.price_value ?? []),
  ]);
  const { total: slotsTotal, open: slotsOpen, ambiguity: slotsAmbiguity } = extractSlots(body, {
    open: labelAliases?.slots_open,
    total: labelAliases?.slots_total,
  });
  // T-C1: Discord timestamp (preferível a texto incidental)
  const discordTs = extractDiscordTimestamp(body);
  const dayOfWeek = discordTs?.dayOfWeek ?? extractDayOfWeek(body, labelAliases?.day_of_week);
  const startTime = discordTs?.startTime ?? extractStartTime(body, labelAliases?.start_time);
  const scheduleAmbiguous = discordTs?.ambiguous === true;

  // T-C2: Google Forms URL (prioridade sobre URLs genéricas)
  const rawUrls = extractRawHttpUrls(body).map(trimTrailingUrlWrappers);
  const googleFormsUrl = rawUrls.find((url) => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.startsWith('https://forms.gle/') || lowerUrl.startsWith('http://forms.gle/');
  })
    ?? rawUrls.find((url) => {
      const lowerUrl = url.toLowerCase();
      return lowerUrl.startsWith('https://docs.google.com/forms/') || lowerUrl.startsWith('http://docs.google.com/forms/');
    })
    ?? null;
  const rawContactUrlMatch = extractContactUrl(body, labelAliases?.contact_url);
  const contactUrl = googleFormsUrl ?? rawContactUrlMatch?.url ?? null;
  // Google Forms sempre confiável (detecção por domínio dedicado); URL genérica
  // sem domínio conhecido nem contexto de linha de contato fica incerta.
  const contactUrlConfident = googleFormsUrl != null || (rawContactUrlMatch?.confident ?? true);

  const explicitContactDiscord = extractContactDiscord(body);
  let hostDiscordId = extractHostDiscordId(body);

  // DEB-048-26: contato = AUTOR do Discord quando não há contato explícito.
  // Quem publicou o anúncio é o contato padrão. Precedência: forms/url/menção
  // explícita > autor (fallback). Substitui a heurística T-C3 por frase-gatilho.
  // Correção (achado do mantenedor, 2026-07-07): discord_author_name é o NICKNAME
  // de exibição do servidor (não é @username nem é pesquisável/mencionável fora
  // dele) — usar o ID (snowflake, sempre resolve via menção <@id> em qualquer
  // servidor) como valor de contato, nunca o nome. Nome só serve de label.
  const authorContact = message.discord_author_id ?? null;
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
  // "Sinopse da História"/"Sinopse da historia" é variante real (achado em
  // "Além do Escuro Norte", D:\teste [part 2].json) — normalizeLabelKey exige
  // igualdade exata, então só "sinopse" nao batia e o fallback devolvia o
  // body INTEIRO (Sistema/Estilo/Data/Plataformas/Regras dentro da descrição).
  const rawDescription = extractLabelValue(
    body,
    [
      'descricao', 'descrição', 'sinopse', 'sinopse da historia', 'sinopse da história', 'proposta',
      ...(labelAliases?.description ?? []),
    ],
    { multiParagraph: true },
  ) ?? buildFallbackDescription(body);
  const descriptionSource = rawDescription ? removeKnownContactUrlsFromDescription(rawDescription, contactUrl) : null;
  const description = descriptionSource ? cleanDescriptionText(descriptionSource) || null : null;

  // Fase C (spec 058): cadência explícita no texto ("semanal"/"quinzenal"/"mensal"/
  // "avulsa") tem prioridade sobre o fallback de deriveFrequency. Achado da simulação
  // real: quando cadência é citada mas `type` está null, também confirma type=campanha
  // (regra: só campanha tem cadência recorrente).
  const explicitFrequency = extractExplicitFrequency(fullText);
  const resolvedType = type ?? (explicitFrequency ? 'campanha' : null);

  // Fase C: VTT/plataforma de comunicação — mesmo motor de matching do sistema.
  // Achado do mantenedor (2026-07-14): "Plataforma(s)" e "Local do Jogo" são labels
  // DISTINTOS no template real da comunidade ("Local do Jogo: Servidor próprio no
  // Discord" + "Plataformas: Roll20 com a extensão BetterR20" no mesmo anúncio) —
  // tratá-los como sinônimo fazia extractLabelValue parar no 1º que aparecesse no
  // texto (Local do Jogo), descartando o valor real de VTT (Roll20) sem nunca
  // chegar a comparar contra o catálogo. "Local do jogo" só serve de fallback
  // quando não há label "Plataforma(s)" dedicado.
  const platformsLabelValue = extractLabelValue(body, ['plataforma', 'plataformas'])
    ?? extractLabelValue(body, ['local do jogo']);
  const vttMatch = platforms?.vtt?.length
    ? findPlatformMatch(platformsLabelValue ?? fullText, platforms.vtt)
    : null;
  const communicationMatch = platforms?.communication?.length
    ? findPlatformMatch(platformsLabelValue ?? fullText, platforms.communication)
    : null;

  // Fase C: classificação indicativa (enum fixo, regex livre no corpo inteiro).
  const ageRating = extractAgeRating(fullText);
  const experienceLevel = extractExperienceLevel(fullText);

  const tableLevel = extractTableLevel(fullText);
  // Fase C: cenário/ambientação e estilos — sempre extraídos juntos (mesmo componente
  // de UI, SettingStylesField). Sem banco de referência — texto livre normalizado.
  const settingStylesLabelValue = extractLabelValue(body, ['estilo', 'indicado']);
  const settingStyles = settingStylesLabelValue ? splitFreeTextList(settingStylesLabelValue) : null;
  const settingName = extractLabelValue(body, ['ambientacao', 'ambientação', 'cenario', 'cenário']);
  const scenarioMatch = settingName && platforms?.scenarios?.length
    ? findPlatformMatch(settingName, platforms.scenarios)
    : null;
  const rawScenarioHint = settingName && !scenarioMatch ? settingName : null;

  // Achado do mantenedor (2026-07-16): a regra antiga (só texto explícito tipo
  // "necessário ter PC" contava) deixava passar caso óbvio — anúncio com VTT
  // (Roll20/Foundry/etc) citava só "Ter um computador para usar o roll20" e o
  // parser não marcava requires_pc; Discord como plataforma de voz nunca
  // marcava requires_microphone mesmo sendo pré-requisito estrutural de VC.
  // VTT/plataforma detectados (vttMatch/communicationMatch, já resolvidos
  // acima) agora inferem o requisito por si só — texto explícito continua
  // tendo prioridade (positivo/negativo/ambíguo do texto nunca é sobrescrito).
  const technicalRequirements = extractTechnicalRequirements(fullText);
  const isDiscordCommunication = communicationMatch?.name?.toLowerCase() === 'discord';
  const requiresPc = technicalRequirements.pc.value ?? (vttMatch ? true : null);
  const requiresCamera = technicalRequirements.camera.value;
  const requiresMicrophone = technicalRequirements.microphone.value ?? (isDiscordCommunication ? true : null);

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
  if (priceAmbiguous) missingFields.push('price_type:ambiguous');
  if (scheduleAmbiguous) missingFields.push('day_of_week:multiple_schedules');
  if (technicalRequirements.pc.ambiguous) missingFields.push('requires_pc:ambiguous');
  if (technicalRequirements.camera.ambiguous) missingFields.push('requires_camera:ambiguous');
  if (technicalRequirements.microphone.ambiguous) missingFields.push('requires_microphone:ambiguous');

  // T-G2: ambiguidades adicionais
  if (contactUrl && isSuspiciousUrl(contactUrl)) {
    missingFields.push('contact_url:suspicious');
  }
  // Achado CodeRabbit (PR #144): domínio desconhecido sem contexto de linha de
  // contato (não é "Contato:"/"Inscrição:", só a única URL solta no anúncio)
  // pode ser link não relacionado (site institucional, playlist, review) —
  // marca pra revisão em vez de aceitar como contact_url confiável.
  if (contactUrl && !contactUrlConfident) {
    missingFields.push('contact_url:unconfirmed');
  }

  const table: DiscordTableDraftTable = {
    title: title || threadName || null,
    system_name: systemName,
    system_id: systemId,
    raw_system_hint: rawSystemHint,
    _system_source_hint: systemHint,
    _system_candidates: systemCandidates.length > 0 ? systemCandidates : null,
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
    contact_discord_explicit: explicitContactDiscord !== null,
    contact_url: contactUrl,
    host_discord_id: hostDiscordId,
    scenario_id: scenarioMatch?.id ?? null,
    raw_scenario_hint: rawScenarioHint,
    vtt_platform_id: vttMatch?.id ?? null,
    communication_platform_id: communicationMatch?.id ?? null,
    age_rating: ageRating,
    setting_name: settingName,
    setting_styles: settingStyles,
    experience_level: experienceLevel,
    table_level: tableLevel,
    requires_pc: requiresPc,
    requires_camera: requiresCamera,
    requires_microphone: requiresMicrophone,
    session_zero_free: sessionZeroFree,
    cover_url: null,
    cover_url_source: cover?.url ?? null,
    cover_quality: cover?.quality ?? null,
    _slots_ambiguity: slotsAmbiguity,
    _price_ambiguity: priceAmbiguous,
    _schedule_ambiguity: scheduleAmbiguous,
    _homebrew_suspect: homebrew === 'review' ? true : null,
    _raw_evidence: rawEvidence,
    _notes: [
      ...(matchedSystem?.notes ?? []),
      ...(rawEvidence?.role_mentions?.map((mention) => `Role mencionada: ${mention}`) ?? []),
      ...attachmentNotes,
      ...(rawEvidence?.embeds?.map((embed) => `Embed: ${embed.title ?? embed.url ?? 'sem titulo'}`) ?? []),
      ...(priceAmbiguous ? ['Preço ambíguo: texto cita gratuidade e cobrança sem padrão de período promocional reconhecido — revisar manualmente.'] : []),
      ...(scheduleAmbiguous ? ['Múltiplos horários detectados: texto cita 2+ dias/horários diferentes — revisar manualmente qual usar.'] : []),
      ...(technicalRequirements.pc.ambiguous ? ['Requisito de PC contraditório — revisar manualmente.'] : []),
      ...(technicalRequirements.camera.ambiguous ? ['Requisito de câmera contraditório — revisar manualmente.'] : []),
      ...(technicalRequirements.microphone.ambiguous ? ['Requisito de microfone contraditório — revisar manualmente.'] : []),
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
