/**
 * Logica pura da mescla de feedback de desenvolvimento (Spec 024).
 *
 * Integra TODAS as infos dos secundarios no destino: une console/network errors
 * (com dedup e cap) e acumula um snapshot completo de cada secundario em
 * `merged_sources` (titulo, descricao, contato/e-mail, screenshot, rota, etc.),
 * util para investigacao e retorno futuro. Funcao pura/testavel; a persistencia
 * e a transacao ficam na rota.
 */

export const MAX_MERGE_SOURCES = 50;
export const MAX_MERGED_ERRORS = 100;

export interface MergeableFeedback {
  id: string;
  kind: string;
  title: string;
  description: string;
  contact_email: string | null;
  screenshot_url: string | null;
  page_url: string | null;
  route_path: string | null;
  environment: string | null;
  created_at: Date | string;
  console_errors: unknown[];
  network_errors: unknown[];
  merged_sources: unknown[];
}

export interface MergeResult {
  console_errors: unknown[];
  network_errors: unknown[];
  merged_sources: unknown[];
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unionDedup(...lists: unknown[][]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const list of lists) {
    for (const item of list) {
      let key: string;
      try {
        key = JSON.stringify(item);
      } catch {
        key = String(item);
      }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_MERGED_ERRORS) return out;
    }
  }
  return out;
}

function snapshot(source: MergeableFeedback): Record<string, unknown> {
  return {
    id: source.id,
    kind: source.kind,
    title: source.title,
    description: source.description,
    contact_email: source.contact_email,
    screenshot_url: source.screenshot_url,
    page_url: source.page_url,
    route_path: source.route_path,
    environment: source.environment,
    created_at: source.created_at instanceof Date ? source.created_at.toISOString() : source.created_at,
    console_errors: toArray(source.console_errors),
    network_errors: toArray(source.network_errors),
    merged_at: new Date().toISOString(),
  };
}

export function buildMerge(primary: MergeableFeedback, sources: MergeableFeedback[]): MergeResult {
  const console_errors = unionDedup(
    toArray(primary.console_errors),
    ...sources.map((s) => toArray(s.console_errors)),
  );
  const network_errors = unionDedup(
    toArray(primary.network_errors),
    ...sources.map((s) => toArray(s.network_errors)),
  );
  const merged_sources = [
    ...toArray(primary.merged_sources),
    ...sources.map((s) => snapshot(s)),
  ];

  return { console_errors, network_errors, merged_sources };
}
