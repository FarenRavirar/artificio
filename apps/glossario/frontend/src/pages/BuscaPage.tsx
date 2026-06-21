import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { ResultCard } from "../components/ResultCard";
import type { Termo } from "../types/glossario";
import api from "../services/api";
import { sanitizeTermForUi } from "../utils/textSanitizer";

export function BuscaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<Termo[]>([]);
  const [loading, setLoading] = useState(false);
  const q = searchParams.get("q") || "";

  const buscar = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/terms", { params: { search: query, limit: 60 } });
      const payload = Array.isArray(res.data) ? res.data : [];
      setResults(payload.map((item: Termo) => sanitizeTermForUi(item)));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q) buscar(q);
  }, [q, buscar]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Buscar Termos</h1>
      <SearchBar
        onSearch={(value) => {
          setSearchParams(value ? { q: value } : {});
        }}
      />
      <div className="mt-4">
        {loading ? (
          <p className="text-muted">Buscando...</p>
        ) : results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((termo: Termo) => (
                <li key={termo.id}>
                  <ResultCard termo={termo} />
                </li>
              ))}
            </ul>
        ) : q ? (
          <p className="text-muted">Nenhum termo encontrado para "{q}".</p>
        ) : (
          <p className="text-muted">Digite um termo para buscar.</p>
        )}
      </div>
    </div>
  );
}
