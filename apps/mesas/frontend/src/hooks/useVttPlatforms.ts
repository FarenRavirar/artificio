import { useState, useEffect } from 'react';
import { z } from 'zod';

export interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
  sort_order: number;
}

const vttPlatformSchema: z.ZodType<VttPlatform> = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo_filename: z.string().nullable(),
  website_url: z.string().nullable(),
  sort_order: z.number(),
});

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

/**
 * Normaliza a resposta de GET /vtt-platforms — envelope `{ data: [...] }`
 * como devolve a rota (vttPlatforms.ts do backend).
 *
 * B3 (revisão adversarial Fase 4): antes `data.data || []` entrava cru no
 * estado e o consumo novo do editor (WherePart) herdava o risco de ler
 * `slug`/`id` de item malformado. Mesmo padrão do useSystemsCatalog: schema
 * mínimo + TypeError, com a assinatura pública do hook preservada
 * (`{ platforms, loading, error }` — o erro vira a mensagem exibida).
 */
export const normalizeVttPlatformsResponse = (json: unknown): VttPlatform[] => {
  const data = asRecord(json).data;
  if (!Array.isArray(data)) {
    throw new TypeError('Resposta de plataformas VTT em formato inesperado.');
  }
  return data.map((raw) => {
    const parsed = vttPlatformSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TypeError('Resposta de plataformas VTT em formato inesperado.');
    }
    return parsed.data;
  });
};

/**
 * Hook para buscar lista de plataformas VTT ativas
 * Usado no formulário de criação de mesa e no editor de anúncio (WherePart)
 */
export function useVttPlatforms() {
  const [platforms, setPlatforms] = useState<VttPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/v1/vtt-platforms');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar plataformas VTT');
        }

        const json: unknown = await response.json();
        setPlatforms(normalizeVttPlatformsResponse(json));
      } catch (err) {
        console.error('[useVttPlatforms] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  return { platforms, loading, error };
}
