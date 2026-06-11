import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = () => {
    setLoading(true);
    setError(null);

    api.get('/terms')
      .then((res) => {
        const payload = Array.isArray(res.data) ? res.data : [];
        setDados(payload.map((item: Termo) => sanitizeTermForUi(item)));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar termos:', err);
        setError('O servidor de termos está offline ou inacessível.');
        setLoading(false);
      });
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const fuse = useMemo(() => {
    if (dados.length === 0) return null;
    return new Fuse(dados, {
      keys: ['name_en', 'name_pt', 'nome_en', 'nome_pt'], // Aceita novos e antigos
      threshold: 0.05,
      distance: 100,
      minMatchCharLength: 2,
      findAllMatches: true,
      ignoreLocation: true,
      shouldSort: false,
    });
  }, [dados]);

  const buscar = (query: string) => {
    if (!fuse) return [];

    const normalizedQuery = sanitizeInlineText(query);
    if (!normalizedQuery) return [];

    return fuse.search(normalizedQuery).map((result) => result.item);
  };

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

  return { dados, buscar, loading, error, recarregar: carregarDados, editarTermo, excluirTermo };
}
