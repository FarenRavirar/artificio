import { useState, useEffect } from 'react';
import { z } from 'zod';
import { readEnvelopeData } from '../utils/apiEnvelope';

export interface CommunicationPlatform {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  sort_order: number;
  // Requisitos implicados (migration_162, spec 096 R3): alimentam a
  // auto-marcação "com o porquê" no editor (WherePart, T5.3).
  implies_pc: boolean;
  implies_microphone: boolean;
  implies_camera: boolean;
}

const communicationPlatformSchema: z.ZodType<CommunicationPlatform> = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  website_url: z.string().nullable(),
  sort_order: z.number(),
  implies_pc: z.boolean(),
  implies_microphone: z.boolean(),
  implies_camera: z.boolean(),
});

/**
 * Normaliza a resposta de GET /communication-platforms — envelope
 * `{ data: [...] }` como devolve a rota (communicationPlatforms.ts do
 * backend).
 *
 * Fase 5 (spec 096, T5.2): antes `data.data || []` entrava cru no estado e o
 * consumo novo do editor (WherePart) herdava o risco de ler id/flag de item
 * malformado. Mesmo padrão do useVttPlatforms (B3, revisão adversarial
 * Fase 4): schema mínimo + TypeError, com a assinatura pública do hook
 * preservada (`{ platforms, loading, error }` — o erro vira a mensagem
 * exibida).
 */
export const normalizeCommunicationPlatformsResponse = (json: unknown): CommunicationPlatform[] => {
  const data = readEnvelopeData(
    json,
    'Resposta de plataformas de comunicação em formato inesperado.',
  );
  return data.map((raw) => {
    const parsed = communicationPlatformSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TypeError('Resposta de plataformas de comunicação em formato inesperado.');
    }
    return parsed.data;
  });
};

/**
 * Hook para buscar lista de plataformas de comunicação ativas
 * Usado no formulário de criação/edição de mesa e no editor de anúncio
 * (WherePart)
 */
export function useCommunicationPlatforms() {
  const [platforms, setPlatforms] = useState<CommunicationPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/v1/communication-platforms');

        if (!response.ok) {
          throw new Error('Erro ao buscar plataformas de comunicação');
        }

        const json: unknown = await response.json();
        setPlatforms(normalizeCommunicationPlatformsResponse(json));
      } catch (err) {
        console.error('[useCommunicationPlatforms] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  return { platforms, loading, error };
}
