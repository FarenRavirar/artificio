import { useCallback, useState, useEffect, useRef } from 'react';
import { Termo } from '../types/glossario';
import api from '../services/api';
import { sanitizeInlineText, sanitizeTermForUi } from '../utils/textSanitizer';

export type AtualizacaoTermoPayload = Partial<{
  name_en: string;
  name_pt: string;
  nucleus: 'oficial' | 'sugestao' | 'artificio';
  status: 'pendente' | 'verificado' | 'rejeitado';
  source_type: 'sistema' | 'cenario';
  system_id: string | null;
  edition_id: string | null;
  scenario_id: string | null;
  category_id: string | null;
  book_reference: string | null;
  page_reference: string | null;
  additional_info: string | null;
}>;

export function useGlossario() {
  const [dados, setDados] = useState<Termo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSearchRef = useRef('');

  const readTotalCount = (res: { headers: Record<string, unknown> }): number => {
    const raw = res.headers['x-total-count'];
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Refetch manual (botão "recarregar"): reseta loading/erro de forma síncrona.
  const carregarDados = useCallback(() => {
    setLoading(true);
    setError(null);

    api.get('/terms', { params: { limit: 60 } })
      .then((res) => {
        const payload = Array.isArray(res.data) ? res.data : [];
        setDados(payload.map((item: Termo) => sanitizeTermForUi(item)));
        setTotalCount(readTotalCount(res));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar termos:', err);
        setError('O servidor de termos está offline ou inacessível.');
        setLoading(false);
      });
  }, []);

  // Carga inicial: IIFE async inline; loading já inicia true e o setState só
  // ocorre após o await (não-síncrono no corpo do effect).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get('/terms', { params: { limit: 60 } });
        if (!active) return;
        const payload = Array.isArray(res.data) ? res.data : [];
        setDados(payload.map((item: Termo) => sanitizeTermForUi(item)));
        setTotalCount(readTotalCount(res));
      } catch (err) {
        if (!active) return;
        console.error('Erro ao carregar termos:', err);
        setError('O servidor de termos está offline ou inacessível.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const buscar = useCallback(async (query: string) => {
    const normalizedQuery = sanitizeInlineText(query);
    if (!normalizedQuery) return [];

    lastSearchRef.current = normalizedQuery;
    setSearching(true);
    try {
      const { data } = await api.get('/terms', {
        params: { search: normalizedQuery, limit: 80 },
      });
      if (lastSearchRef.current !== normalizedQuery) return [];
      const payload = Array.isArray(data) ? data : [];
      const sanitized = payload.map((item: Termo) => sanitizeTermForUi(item));
      setDados(sanitized);
      return sanitized;
    } catch (err) {
      console.error('Erro ao buscar termos:', err);
      setError('A busca está temporariamente indisponível.');
      return [];
    } finally {
      if (lastSearchRef.current === normalizedQuery) setSearching(false);
    }
  }, []);

  const editarTermo = async (id: string | number, payload: AtualizacaoTermoPayload) => {
    const { data } = await api.patch(`/terms/${id}`, payload);
    setDados((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
          ? sanitizeTermForUi({ ...item, ...data } as Termo)
          : item
      )
    );
  };

  const excluirTermo = async (id: string | number) => {
    await api.delete(`/terms/${id}`);
    setDados((prev) => prev.filter((item) => String(item.id) !== String(id)));
  };

  return { dados, totalCount, buscar, loading: loading || searching, error, recarregar: carregarDados, editarTermo, excluirTermo };
}
