import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { ResultCard } from "../components/ResultCard";
import type { Termo } from "../types/glossario";
import api from "../services/api";
import { sanitizeTermForUi } from "../utils/textSanitizer";

function isTermo(value: unknown): value is Termo {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  const hasId = typeof t.id === "string" || typeof t.id === "number";
  const hasNameEn = typeof t.name_en === "string" || typeof t.nome_en === "string";
  const hasNamePt = typeof t.name_pt === "string" || typeof t.nome_pt === "string";
  return hasId && (hasNameEn || hasNamePt);
}

export function BuscaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<Termo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const q = searchParams.get("q") || "";
  const mounted = useRef(false);
  const ignoreRef = useRef(false);

  const buscar = useCallback((query: string) => {
    ignoreRef.current = false;
    const ignore = () => ignoreRef.current;

    if (!query.trim()) {
      setResults([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);

    api
      .get("/terms", { params: { search: query, limit: 60 } })
      .then((res) => {
        if (ignore()) return;
        const payload = Array.isArray(res.data) ? res.data : [];
        setResults(payload.filter(isTermo).map((item) => sanitizeTermForUi(item)));
      })
      .catch(() => {
        if (ignore()) return;
        setError(true);
      })
      .finally(() => {
        if (ignore()) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    void Promise.resolve().then(() => buscar(q));
    return () => {
      ignoreRef.current = true;
    };
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
        {(() => {
          if (loading) return <p className="text-muted">Buscando...</p>;
          if (error) return <p className="text-red-600">Erro ao buscar. Tente novamente.</p>;
          if (results.length > 0) return (
            <ul className="space-y-3">
              {results.map((termo: Termo) => (
                <li key={termo.id}>
                  <ResultCard termo={termo} />
                </li>
              ))}
            </ul>
          );
          if (q) return <p className="text-muted">Nenhum termo encontrado para "{q}".</p>;
          return <p className="text-muted">Digite um termo para buscar.</p>;
        })()}
      </div>
    </div>
  );
}
