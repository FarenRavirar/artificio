export interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  logo_filename?: string | null;
  website_url: string | null;
}

/**
 * Payload da rota de catálogo é `unknown` até aqui (regra pétrea de
 * normalização do `AGENTS.md`). O código anterior fazia `json.data || []` e
 * mandava direto ao estado: uma resposta `200` com `{"data": {}}` — objeto, não
 * array — passava pelo `||` e só estourava no `platforms.map(...)` do render,
 * derrubando a seção inteira de edição em vez de mostrar erro (achado de
 * review, PR #307). Item sem `id`/`name` é descartado, não renderizado torto.
 */
export function normalizePlatforms(payload: unknown): VttPlatform[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  const out: VttPlatform[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string') continue;
    out.push({
      id: p.id,
      name: p.name,
      slug: typeof p.slug === 'string' ? p.slug : '',
      logo_filename: typeof p.logo_filename === 'string' ? p.logo_filename : null,
      website_url: typeof p.website_url === 'string' ? p.website_url : null,
    });
  }
  return out;
}
