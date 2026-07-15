// Helper puro e testavel para resolucao de sugestoes de sistemas (Spec 018).
// Normaliza nomes de sistemas e pontua candidatos do catalogo para evitar
// redundancia (alias/edicao/duplicata) antes de criar um sistema novo.
//
// Sem dependencias externas: comparacao local por igualdade normalizada,
// match de base + token de edicao e similaridade Levenshtein.

export interface NormalizedSystemName {
  /** Nome original recebido. */
  raw: string;
  /** Forma normalizada completa (inclui tokens de edicao). */
  normalized: string;
  /** Nome base normalizado sem tokens/palavras de edicao nem sufixo generico. */
  base: string;
  /** Tokens base visiveis, sem artigos iniciais e sufixos genericos. */
  baseTokens: string[];
  /** Tokens canonicos para comparacao tolerante por base/siglas, sem traducao inventada. */
  canonicalTokens: string[];
  /** Chaves de comparacao tolerantes: compacta, sigla e variacao &/and/n. */
  matchKeys: string[];
  /** Tokens de edicao detectados, ex.: ['5a', '2024'], ['1.3'], ['2e']. */
  editionTokens: string[];
  /** Slug do nome base. */
  slug: string;
}

export interface CandidateSystemInput {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string | null;
  path_slug: string | null;
  node_type: string;
  parent_id: string | null;
}

export interface CandidateAliasInput {
  system_id: string;
  alias: string;
}

export type CandidateReason =
  | 'name_exact'
  | 'name_pt_exact'
  | 'alias_exact'
  | 'base_match'
  | 'base_plus_edition'
  | 'base_plus_qualifier'
  | 'existing_child_match'
  | 'hierarchy_parent'
  | 'fuzzy_similar';

export interface SystemCandidate {
  system_id: string;
  name: string;
  path_slug: string | null;
  node_type: string;
  parent_id?: string | null;
  score: number;
  reasons: CandidateReason[];
}

export type RecommendedAction =
  | 'merge_existing'
  | 'create_alias'
  | 'create_child'
  | 'create_system';

export interface CandidateResult {
  candidates: SystemCandidate[];
  recommended_action: RecommendedAction;
  analysis: {
    base: string;
    edition_tokens: string[];
    suggested_child_name: string | null;
    suggested_child_type: 'edition' | 'variant';
    has_edition_context: boolean;
    has_qualifier_context: boolean;
  };
}

const EDITION_WORDS = new Set([
  'revised',
  'remaster',
  'remastered',
  'edition',
  'edicao',
  'ed',
  'anniversary',
  'aniversario',
  'versao',
  'version',
]);

const COMPACT_GENERIC_SUFFIX = new Set(['rpg', 'ttrpg']);
const ROLEPLAYING_SUFFIX = new Set(['roleplaying', 'roleplay']);
const LEADING_ARTICLES = new Set(['the', 'o', 'a', 'os', 'as']);

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isEditionToken(token: string): boolean {
  return (
    /^(?:19|20)\d{2}$/.test(token) || // ano: 2024
    /^\d{1,2}(?:e|ed)$/.test(token) || // edicao: 5e, 5ed, 2e
    /^\d{1,2}a$/.test(token) || // ordinal PT apos remover acento: 5a (de 5ª)
    /^\d+\.\d+e?$/.test(token) || // versao pontuada: 1.3, 5.5e
    /^v\d+(?:\.\d+)?$/.test(token) // v2, v2.1
  );
}

function canonicalizeEditionToken(token: string): string {
  if (/^\d{1,2}a$/.test(token)) return `${token.slice(0, -1)}e`;
  if (/^\d{1,2}ed$/.test(token)) return `${token.slice(0, -2)}e`;
  if (/^\d+\.\d+e$/.test(token)) return token.slice(0, -1);
  return token;
}

function buildMatchKeys(tokens: string[]): string[] {
  if (tokens.length === 0) return [];
  const keys = new Set<string>();
  const compact = tokens.join('');
  if (compact) keys.add(compact);

  const compactWithN = tokens.map((token) => (token === 'and' ? 'n' : token)).join('');
  if (compactWithN) keys.add(compactWithN);

  const canUseAcronym = tokens.includes('and') || tokens.some((token) => token.length === 1);
  if (canUseAcronym) {
    const acronym = tokens.map((token) => (token === 'and' ? 'n' : token[0] ?? '')).join('');
    if (acronym.length > 1) keys.add(acronym);
  }

  return [...keys];
}

function trimContextTokens(tokens: string[]): string[] {
  const out = [...tokens];
  while (out.length > 1 && LEADING_ARTICLES.has(out[0])) {
    out.shift();
  }
  while (out.length > 1 && COMPACT_GENERIC_SUFFIX.has(out[out.length - 1])) {
    out.pop();
  }
  if (out.length > 2 && ['game', 'games'].includes(out[out.length - 1]) && ROLEPLAYING_SUFFIX.has(out[out.length - 2])) {
    out.pop();
  }
  while (out.length > 1 && ROLEPLAYING_SUFFIX.has(out[out.length - 1])) {
    out.pop();
  }
  return out;
}

export function normalizeSystemName(raw: unknown): NormalizedSystemName {
  const original = typeof raw === 'string' ? raw : '';

  const cleaned = stripAccents(original)
    .toLowerCase()
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .replace(/[™®©]/g, ' ') // TM, R, C
    .replace(/\((?:tm|r|c)\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9.\s-]/g, ' ') // mantem ponto (versoes) e hifen
    .replace(/\b(?:tm|registered)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized = cleaned;
  const tokens = normalized
    .split(/[\s-]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

  const editionTokens: string[] = [];
  const baseTokens: string[] = [];

  for (const token of tokens) {
    const compactSystemEdition = token.match(/^([a-z]{2,})(\d{1,2})$/);
    if (compactSystemEdition) {
      baseTokens.push(compactSystemEdition[1]);
      editionTokens.push(`${compactSystemEdition[2]}e`);
    } else if (isEditionToken(token)) {
      editionTokens.push(canonicalizeEditionToken(token));
    } else if (EDITION_WORDS.has(token)) {
      // palavra de edicao: descartada da base, nao vira token util
    } else {
      baseTokens.push(token);
    }
  }

  const trimmedBaseTokens = trimContextTokens(baseTokens);

  const base = trimmedBaseTokens.join(' ').trim();
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalTokens = trimmedBaseTokens;
  const matchKeys = buildMatchKeys(trimmedBaseTokens);

  return { raw: original, normalized, base, baseTokens: trimmedBaseTokens, canonicalTokens, matchKeys, editionTokens, slug };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function sharesMatchKey(a: NormalizedSystemName, b: NormalizedSystemName): boolean {
  if (a.base && a.base === b.base) return true;
  const bKeys = new Set(b.matchKeys);
  for (const key of a.matchKeys) {
    if (bKeys.has(key)) return true;
  }
  return false;
}

function prefixLength(prefix: string[], value: string[]): number {
  if (prefix.length === 0 || prefix.length >= value.length) return 0;
  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== value[index]) return 0;
  }
  return prefix.length;
}

interface ScoredMatch {
  score: number;
  reasons: CandidateReason[];
}

function aliasBelongsToCanonicalSystem(
  alias: NormalizedSystemName,
  canonical: NormalizedSystemName,
): boolean {
  if (sharesMatchKey(alias, canonical)) return true;
  const acronym = canonical.baseTokens
    .map((token) => (token === 'and' ? 'n' : token[0] ?? ''))
    .join('');
  return acronym.length > 1 && alias.matchKeys.includes(acronym);
}

type NormalizedAliasCandidate = {
  value: NormalizedSystemName;
  uniqueOwner: boolean;
};

function scoreOne(
  suggestion: NormalizedSystemName,
  system: CandidateSystemInput,
  aliasesNormalized: NormalizedAliasCandidate[],
): ScoredMatch | null {
  const fields: Array<{
    value: NormalizedSystemName;
    reason: CandidateReason;
    weight: number;
    trustedForExtension: boolean;
  }> = [];

  const canonicalSystem = normalizeSystemName(system.name);
  fields.push({ value: canonicalSystem, reason: 'name_exact', weight: 1.0, trustedForExtension: true });
  if (system.name_pt) {
    fields.push({ value: normalizeSystemName(system.name_pt), reason: 'name_pt_exact', weight: 1.0, trustedForExtension: true });
  }
  for (const alias of aliasesNormalized) {
    fields.push({
      value: alias.value,
      reason: 'alias_exact',
      weight: 0.98,
      trustedForExtension: alias.uniqueOwner || aliasBelongsToCanonicalSystem(alias.value, canonicalSystem),
    });
  }

  let best: ScoredMatch | null = null;
  const consider = (candidate: ScoredMatch) => {
    if (!best || candidate.score > best.score) best = candidate;
  };

  for (const field of fields) {
    // 1. Igualdade normalizada completa.
    if (suggestion.normalized && suggestion.normalized === field.value.normalized) {
      consider({ score: field.weight, reasons: [field.reason] });
      continue;
    }
    if (!field.trustedForExtension) continue;
    // 2. Mesma base.
    if (suggestion.base && sharesMatchKey(suggestion, field.value)) {
      const exactBase = suggestion.base === field.value.base;
      if (suggestion.editionTokens.length > 0) {
        const fieldEditions = new Set(field.value.editionTokens);
        const exactEdition = fieldEditions.size > 0
          && field.value.editionTokens.length === suggestion.editionTokens.length
          && suggestion.editionTokens.every((token) => fieldEditions.has(token));
        const compatibleEdition = fieldEditions.size > 0
          && field.value.editionTokens.every((token) => suggestion.editionTokens.includes(token));
        if (fieldEditions.size > 0 && !compatibleEdition) continue;
        const canonicalField = field.reason !== 'alias_exact';
        let score = 0.85;
        if (exactEdition && canonicalField) score = 0.99;
        else if (compatibleEdition && canonicalField) score = 0.95;
        else if (exactBase && field.reason === 'alias_exact') score = 0.92;
        else if (exactBase) score = 0.9;
        consider({ score, reasons: ['base_plus_edition'] });
      } else {
        consider({ score: 0.9, reasons: ['base_match'] });
      }
      continue;
    }
    // 3. Base existente + qualificador textual (ex.: The One Ring Strider Mode).
    const extraPrefixLength = prefixLength(field.value.canonicalTokens, suggestion.canonicalTokens);
    if (extraPrefixLength > 0) {
      consider({ score: 0.78, reasons: ['base_plus_qualifier'] });
      continue;
    }
    // 4. Similaridade aproximada da base.
    if (suggestion.base && field.value.base) {
      const ratio = similarity(suggestion.base, field.value.base);
      if (ratio >= 0.82) {
        consider({ score: round2(Math.min(ratio, 0.8)), reasons: ['fuzzy_similar'] });
      }
    }
  }

  return best;
}

function titleCaseToken(token: string): string {
  if (/^\d/.test(token)) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function inferChildName(suggestion: NormalizedSystemName, best: SystemCandidate | undefined, systems: CandidateSystemInput[]): string | null {
  if (suggestion.editionTokens.length > 0) {
    const bestSystem = best ? systems.find((item) => item.id === best.system_id) : undefined;
    const consumed = new Set(bestSystem ? editionTokensForSystem(bestSystem) : []);
    const remaining = suggestion.editionTokens.filter((token) => !consumed.has(token));
    return (remaining.length > 0 ? remaining : suggestion.editionTokens).join(' ');
  }
  if (!best || !best.reasons.includes('base_plus_qualifier')) return null;
  const system = systems.find((item) => item.id === best.system_id);
  if (!system) return null;
  const systemNames = [normalizeSystemName(system.name)];
  if (system.name_pt) systemNames.push(normalizeSystemName(system.name_pt));
  for (const field of systemNames) {
    const count = prefixLength(field.canonicalTokens, suggestion.canonicalTokens);
    if (count <= 0) continue;
    const extra = suggestion.baseTokens.slice(count);
    if (extra.length > 0) return extra.map(titleCaseToken).join(' ');
  }
  return null;
}

function editionTokensForSystem(system: CandidateSystemInput): string[] {
  const representations = [system.name, system.name_pt, system.slug, system.path_slug?.split('/').at(-1)]
    .filter((value): value is string => Boolean(value));
  return [...new Set(representations.flatMap((value) => normalizeSystemName(
    value.replace(/\b(\d{1,2})-(\d{1,2}e?)\b/gi, '$1.$2'),
  ).editionTokens))];
}

function childTextMatchScore(system: CandidateSystemInput, suggestion: NormalizedSystemName): number {
  const representations = [system.name, system.name_pt]
    .filter((value): value is string => Boolean(value));
  let score = 0;
  for (const representation of representations) {
    const child = normalizeSystemName(representation);
    if (child.baseTokens.length === 0) continue;
    const index = suggestion.baseTokens.findIndex((token, start) => (
      child.baseTokens.every((childToken, offset) => suggestion.baseTokens[start + offset] === childToken)
    ));
    if (index >= 0) score = Math.max(score, 80 + child.baseTokens.length * 2 - index);
  }
  return score;
}

function findHierarchicalDescendantMatch(
  parentCandidate: SystemCandidate | undefined,
  suggestion: NormalizedSystemName,
  systems: CandidateSystemInput[],
): { candidate: SystemCandidate; complete: boolean } | null {
  if (!parentCandidate) return null;
  let current = systems.find((system) => system.id === parentCandidate.system_id);
  if (!current) return null;
  const consumed = new Set(editionTokensForSystem(current));
  let matchedDescendant: CandidateSystemInput | null = null;
  let matchedTextualChild = false;
  const visited = new Set<string>();
  while (!visited.has(current.id)) {
    visited.add(current.id);
    const nextEditionToken = suggestion.editionTokens.find((token) => !consumed.has(token));
    const rankedChildren = systems
      .filter((system) => system.parent_id === current?.id)
      .map((system) => {
        const editions = editionTokensForSystem(system);
        const editionScore = nextEditionToken && editions.includes(nextEditionToken) ? 100 : 0;
        const textScore = childTextMatchScore(system, suggestion);
        return { system, score: Math.max(editionScore, textScore), textScore };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.system.name.localeCompare(right.system.name));
    if (!rankedChildren[0] || rankedChildren[1]?.score === rankedChildren[0].score) break;
    const child = rankedChildren[0].system;
    matchedTextualChild ||= rankedChildren[0].textScore > 0;
    matchedDescendant = child;
    for (const token of editionTokensForSystem(child)) consumed.add(token);
    current = child;
  }
  if (!matchedDescendant) return null;
  const complete = suggestion.editionTokens.every((token) => consumed.has(token))
    && (suggestion.editionTokens.length > 0 || matchedTextualChild);
  return {
    complete,
    candidate: {
      system_id: matchedDescendant.id,
      name: matchedDescendant.name,
      path_slug: matchedDescendant.path_slug,
      node_type: matchedDescendant.node_type,
      parent_id: matchedDescendant.parent_id,
      score: complete ? 0.99 : 0.96,
      reasons: [complete ? 'existing_child_match' : 'hierarchy_parent'],
    },
  };
}

function emptyAnalysis(suggestion: NormalizedSystemName): CandidateResult['analysis'] {
  return {
    base: suggestion.base,
    edition_tokens: suggestion.editionTokens,
    suggested_child_name: suggestion.editionTokens.length > 0 ? suggestion.editionTokens.join(' ') : null,
    suggested_child_type: 'edition',
    has_edition_context: suggestion.editionTokens.length > 0,
    has_qualifier_context: false,
  };
}

function indexAliases(aliases: CandidateAliasInput[]): Map<string, NormalizedAliasCandidate[]> {
  const normalized = aliases.map((alias) => ({ ...alias, value: normalizeSystemName(alias.alias) }));
  const owners = new Map<string, Set<string>>();
  for (const alias of normalized) {
    if (!alias.value.normalized) continue;
    const ids = owners.get(alias.value.normalized) ?? new Set<string>();
    ids.add(alias.system_id);
    owners.set(alias.value.normalized, ids);
  }
  const bySystem = new Map<string, NormalizedAliasCandidate[]>();
  for (const alias of normalized) {
    const list = bySystem.get(alias.system_id) ?? [];
    list.push({
      value: alias.value,
      uniqueOwner: (owners.get(alias.value.normalized)?.size ?? 0) === 1,
    });
    bySystem.set(alias.system_id, list);
  }
  return bySystem;
}

function collectCandidates(
  suggestion: NormalizedSystemName,
  systems: CandidateSystemInput[],
  aliasesBySystem: Map<string, NormalizedAliasCandidate[]>,
): SystemCandidate[] {
  const scored: SystemCandidate[] = [];
  for (const system of systems) {
    const match = scoreOne(suggestion, system, aliasesBySystem.get(system.id) ?? []);
    if (!match || match.score < 0.5) continue;
    scored.push({
      system_id: system.id,
      name: system.name,
      path_slug: system.path_slug,
      node_type: system.node_type,
      parent_id: system.parent_id,
      score: round2(match.score),
      reasons: match.reasons,
    });
  }
  return scored;
}

/**
 * Pontua os candidatos do catalogo contra o nome sugerido. Funcao pura:
 * recebe os arrays do catalogo ja carregados e nao toca em banco.
 */
export function scoreSystemCandidates(
  suggestionName: unknown,
  systems: CandidateSystemInput[],
  aliases: CandidateAliasInput[],
  limit = 5,
): CandidateResult {
  const suggestion = normalizeSystemName(suggestionName);

  const aliasesBySystem = indexAliases(aliases);
  const scored = collectCandidates(suggestion, systems, aliasesBySystem);

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const candidates = scored.slice(0, Math.max(0, limit));

  const best = candidates[0];
  const hierarchyMatch = findHierarchicalDescendantMatch(best, suggestion, systems);
  const effectiveParent = hierarchyMatch && !hierarchyMatch.complete ? hierarchyMatch.candidate : best;
  const analysis = emptyAnalysis(suggestion);
  analysis.has_qualifier_context = Boolean(best?.reasons.includes('base_plus_qualifier'));
  analysis.suggested_child_name = inferChildName(suggestion, effectiveParent, systems) ?? analysis.suggested_child_name;
  const bestSystem = effectiveParent ? systems.find((system) => system.id === effectiveParent.system_id) : undefined;
  analysis.suggested_child_type = bestSystem?.node_type === 'edition' ? 'variant' : 'edition';
  const hierarchyCandidate = hierarchyMatch?.candidate ?? null;
  const finalCandidates = hierarchyCandidate
    ? [
      hierarchyCandidate,
      ...candidates.filter((candidate) => candidate.system_id !== hierarchyCandidate.system_id),
    ].slice(0, Math.max(0, limit))
    : candidates;

  let recommended_action: RecommendedAction;
  if (hierarchyMatch?.complete) {
    recommended_action = 'merge_existing';
  } else if (!best) {
    recommended_action = 'create_system';
  } else if (best.reasons.includes('base_plus_edition') || best.reasons.includes('base_plus_qualifier')) {
    recommended_action = 'create_child';
  } else if (best.score >= 0.97) {
    recommended_action = 'merge_existing';
  } else if (best.score >= 0.7) {
    recommended_action = 'create_alias';
  } else {
    recommended_action = 'create_system';
  }

  return { candidates: finalCandidates, recommended_action, analysis };
}
