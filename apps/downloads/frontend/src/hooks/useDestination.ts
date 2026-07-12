import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const destinationSchema = z.object({ external_url: z.string() });

// DEB-073-02 (spec 073) — resolve id opaco de destino (download_destination)
// para a URL externa real, sem depender do slug do material.
export function useDestination(destinationId: string | undefined) {
  return useQuery<string | null>({
    queryKey: ['downloads', 'destination', destinationId],
    enabled: Boolean(destinationId),
    queryFn: async () => {
      const response = await apiGet(`/api/v1/destinations/${destinationId}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Falha ao resolver destino: HTTP ${response.status}`);
      }
      const json = await response.json();
      return destinationSchema.parse(json).external_url;
    },
  });
}
