import { useState, useEffect, useMemo } from "react";
import { LoadingState } from "@artificio/ui";

interface Group {
  slug: string;
  name: string;
  description?: string;
  category?: string;
}

function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return typeof g.slug === "string" && typeof g.name === "string";
}

const CATEGORY_LABELS: Record<string, string> = {
  artificio: "Do Artifício RPG",
  tematicos: "Temáticos",
  parceiros: "Parceiros",
  comunidade: "Comunidade",
};

export function LinksSearch() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/groups?source=community&status=active", { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((body: unknown) => {
        if (body && typeof body === "object" && "data" in body) {
          const rows = (body as { data: unknown }).data;
          if (Array.isArray(rows)) {
            setGroups(rows.filter(isGroup));
            return;
          }
        }
        setGroups([]);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [retryKey]);

  const categoryKeys = useMemo(
    () => [...new Set(groups.map((g) => g.category).filter(Boolean))] as string[],
    [groups],
  );

  const byCategory = selectedCategory
    ? groups.filter((g) => g.category === selectedCategory)
    : groups;

  const filtered = query.trim()
    ? byCategory.filter(
        (g) =>
          g.name.toLowerCase().includes(query.toLowerCase()) ||
          (g.description ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : byCategory;

  return (
    <div>
      <div className="relative mb-6">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar grupos..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-3 pl-10 pr-4 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--brand)]"
          autoFocus
        />
      </div>

      <div className="chips mb-4">
        <button
          type="button"
          className={`chip ${selectedCategory ? "" : "chip-active"}`}
          onClick={() => setSelectedCategory(null)}
        >
          Todos os grupos
        </button>
        {categoryKeys.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`chip ${selectedCategory === cat ? "chip-active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {(() => {
        if (loading) return <LoadingState message="Carregando grupos..." variant="inline" />;
        if (error) return (
          <p className="text-[var(--state-danger-fg)]">
            Erro ao carregar grupos.{" "}
            <button
              onClick={() => { setError(false); setLoading(true); setRetryKey((k) => k + 1); }}
              className="text-[var(--brand)] hover:underline"
            >
              Tentar novamente
            </button>
          </p>
        );
        if (filtered.length === 0) {
          const querySuffix = query ? ` para "${query}"` : "";
          const categorySuffix = selectedCategory ? ` na categoria "${CATEGORY_LABELS[selectedCategory] ?? selectedCategory}"` : "";
          return (
            <p className="text-[var(--muted)]">
              {query || selectedCategory
                ? `Nenhum grupo encontrado${querySuffix}${categorySuffix}.`
                : "Nenhum grupo disponível."}
            </p>
          );
        }
        return (
          <ul className="space-y-3">
            {filtered.map((g) => (
              <li key={g.slug}>
                <a
                  href={`/grupo/${g.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-4 transition-colors hover:border-[var(--brand)]/30"
                >
                  <span className="font-semibold text-[var(--text)]">{g.name}</span>
                  {g.description ? (
                    <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{g.description}</p>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        );
      })()}
    </div>
  );
}
