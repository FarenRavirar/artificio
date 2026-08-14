/**
 * Normaliza a forma de um payload de termo antes de qualquer uso. Complementa
 * `sanitizeTermForUi` (`utils/textSanitizer.ts`), que trata o CONTEÚDO hostil
 * mas já recebe um `Termo` tipado e assume que a forma está correta — os dois
 * são necessários, em ordem: primeiro a forma, depois o texto.
 */
export function normalizeTermo(v: unknown): Termo | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const id = typeof r.id === 'string' || typeof r.id === 'number' ? r.id : '';
  // Sem `id` o termo não serve como `key` de lista nem como alvo das ações de
  // aprovar/rejeitar da tela de revisão.
  if (id === '') return null;
  const texto = (k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '');
  return {
    ...(r as Partial<Termo>),
    id,
    name_en: texto('name_en'),
    name_pt: texto('name_pt'),
  } as Termo;
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
