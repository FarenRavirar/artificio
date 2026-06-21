import { useState, useEffect } from "react";

interface Group {
  slug: string;
  name: string;
  description?: string;
  category?: string;
}

export function LinksSearch() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/groups?source=community&status=active", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const filtered = query.trim()
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(query.toLowerCase()) ||
          (g.description ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : groups;

  return (
    <div>
      <div className="relative mb-6">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar grupos..."
          className="w-full rounded-lg border border-white/10 bg-[#0F1A2E] py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#FF5722]"
          autoFocus
        />
      </div>

      {loading ? (
        <p className="text-white/50">Carregando grupos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/50">
          {query ? `Nenhum grupo encontrado para "${query}".` : "Nenhum grupo disponível."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => (
            <li key={g.slug}>
              <a
                href={`/grupo/${g.slug}`}
                className="block rounded-lg border border-white/10 bg-[#10203a]/80 p-4 transition-colors hover:border-[#FF5722]/30"
              >
                <span className="font-semibold text-white">{g.name}</span>
                {g.description ? (
                  <p className="mt-1 text-sm text-white/50 line-clamp-2">{g.description}</p>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
