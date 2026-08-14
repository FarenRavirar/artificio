/**
 * Normaliza a forma de um payload de termo antes de qualquer uso. Complementa
 * `sanitizeTermForUi` (`utils/textSanitizer.ts`), que trata o CONTEÚDO hostil
 * mas já recebe um `Termo` tipado e assume que a forma está correta — os dois
 * são necessários, em ordem: primeiro a forma, depois o texto.
 */
/** Campo opcional de texto: ausente/malformado some do objeto, não vira `''`. */
function textoOpcional(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Campo opcional que o backend pode devolver explicitamente `null`. */
function textoNulavel(v: unknown): string | null | undefined {
  if (typeof v === 'string') return v;
  if (v === null) return null;
  return undefined;
}

/** Só os valores do domínio passam; qualquer outro vira `undefined`. */
function umDe<T extends string>(v: unknown, permitidos: readonly T[]): T | undefined {
  return typeof v === 'string' && (permitidos as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

const NUCLEOS = ['oficial', 'sugestao', 'artificio'] as const;
const STATUS = ['pendente', 'verificado', 'rejeitado'] as const;
const SOURCE_TYPES = ['sistema', 'cenario'] as const;

export function normalizeTermo(v: unknown): Termo | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const id = typeof r.id === 'string' || typeof r.id === 'number' ? r.id : '';
  // Sem `id` o termo não serve como `key` de lista nem como alvo das ações de
  // aprovar/rejeitar da tela de revisão.
  if (id === '') return null;
  const texto = (k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '');

  // Allowlist explícita, sem spread do payload: `{ ...r }` copiava para o estado
  // React qualquer chave que o servidor mandasse, e o `as Termo` calava o
  // compilador sobre campos que nunca foram validados — `nucleus`, `status` e
  // `source_type` são uniões fechadas que chegavam com string arbitrária e
  // saíam renderizadas na tela de revisão (achado de review, PR #261).
  return {
    id,
    name_en: texto('name_en'),
    name_pt: texto('name_pt'),
    nome_en: textoOpcional(r.nome_en),
    nome_pt: textoOpcional(r.nome_pt),
    validacao: textoOpcional(r.validacao),
    referencia: textoOpcional(r.referencia),
    category_name: textoOpcional(r.category_name),
    subcategory_name: textoOpcional(r.subcategory_name),
    system_name: textoOpcional(r.system_name),
    edition_name: textoOpcional(r.edition_name),
    scenario_name: textoOpcional(r.scenario_name),
    subcategoria: textoOpcional(r.subcategoria),
    categoria: textoOpcional(r.categoria),
    informacao: textoOpcional(r.informacao),
    additional_info: textoOpcional(r.additional_info),
    book_reference: textoNulavel(r.book_reference),
    page_reference: textoNulavel(r.page_reference),
    source_type: umDe(r.source_type, SOURCE_TYPES),
    system_id: textoNulavel(r.system_id),
    edition_id: textoNulavel(r.edition_id),
    scenario_id: textoNulavel(r.scenario_id),
    category_id: textoNulavel(r.category_id),
    // Valor fora do domínio some em vez de virar rótulo: a tela de revisão
    // imprime `term.nucleus` cru, e `statusLabel[term.status]` faz lookup por
    // string. Undefined cai no fallback já existente ('—'); string arbitrária
    // vazaria o payload para o render.
    nucleus: umDe(r.nucleus, NUCLEOS),
    status: umDe(r.status, STATUS),
    added_by: textoOpcional(r.added_by),
    added_by_name: textoOpcional(r.added_by_name),
    vote_score: typeof r.vote_score === 'number' && Number.isFinite(r.vote_score)
      ? r.vote_score
      : undefined,
    // Timestamps ficam `undefined` quando não vêm utilizáveis; `formatarData`
    // já trata a ausência com '—'. Ver nota em `social.ts` sobre por que string
    // vazia é pior que ausência aqui.
    created_at: textoOpcional(r.created_at),
    updated_at: textoOpcional(r.updated_at),
    last_changed_at: textoNulavel(r.last_changed_at),
  };
}

export function normalizeTermos(v: unknown): Termo[] {
  if (!Array.isArray(v)) return [];
  const out: Termo[] = [];
  for (const item of v) {
    const termo = normalizeTermo(item);
    if (termo) out.push(termo);
  }
  return out;
}

export interface Termo {
  id: string | number;
  name_en: string; // Nova v2
  name_pt: string; // Nova v2
  nome_en?: string; // Legada v1 (opcional)
  nome_pt?: string; // Legada v1 (opcional)
  validacao?: string;
  referencia?: string;
  category_name?: string; // Nova v2
  subcategory_name?: string; // Nova v2 (subcategoria derivada da árvore)
  system_name?: string; // Nova v2
  edition_name?: string; // Nova v2
  scenario_name?: string; // Nova v2
  subcategoria?: string; // Legada v1
  categoria?: string; // Legada v1
  informacao?: string; // Legada v1
  additional_info?: string; // Nova v2
  book_reference?: string | null;
  page_reference?: string | null;
  source_type?: 'sistema' | 'cenario';
  system_id?: string | null;
  edition_id?: string | null;
  scenario_id?: string | null;
  category_id?: string | null;
  nucleus?: 'oficial' | 'sugestao' | 'artificio';
  status?: 'pendente' | 'verificado' | 'rejeitado';
  added_by?: string;
  added_by_name?: string; // Extraído via JOIN
  vote_score?: number;
  created_at?: string;
  updated_at?: string;
  last_changed_at?: string | null;
}
