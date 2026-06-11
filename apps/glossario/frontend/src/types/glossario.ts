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
