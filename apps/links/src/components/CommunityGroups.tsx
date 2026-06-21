// Ilha: lista os grupos comunitários aprovados. Busca a API na mesma origem.
// Reusa estados do design system compartilhado (@artificio/ui): Loading/Empty/Error/Modal.
// UX-1: gate +18 (Modal + localStorage). UX-2: chips de tag clicáveis p/ filtrar.
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, Modal } from "@artificio/ui";
import ReportButton from "./ReportButton.tsx";

interface ApiGroup {
  name: string;
  slug: string | null;
  description: string | null;
  tags: string[];
  is_adult: boolean;
  logo_url: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; groups: ApiGroup[]; tagLabel: Map<string, string> };

export default function CommunityGroups() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [adultGate, setAdultGate] = useState(() => {
    try { return localStorage.getItem("artificio_adult_gate") === "1"; } catch { return false; }
  });

  const confirmAdult = useCallback(() => {
    try { localStorage.setItem("artificio_adult_gate", "1"); } catch { /* noop */ }
    setAdultGate(true);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    Promise.all([
      fetch("/api/tags", { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/groups?source=community&status=active", { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ])
      .then(([tagBody, groupBody]) => {
        const tagLabel = new Map<string, string>();

        if (tagBody && typeof tagBody === "object" && "data" in tagBody) {
          const td = (tagBody as { data: unknown }).data;
          if (Array.isArray(td)) {
            for (const t of td) {
              if (t && typeof t === "object" && "slug" in t && "label" in t) {
                const slug = String((t as { slug: unknown }).slug);
                const label = String((t as { label: unknown }).label);
                if (slug) tagLabel.set(slug, label);
              }
            }
          }
        }

        let groups: ApiGroup[] = [];
        if (groupBody && typeof groupBody === "object" && "data" in groupBody) {
          const gd = (groupBody as { data: unknown }).data;
          if (Array.isArray(gd)) {
            groups = gd
              .map((g): ApiGroup | null => {
                if (!g || typeof g !== "object") return null;
                const item = g as Record<string, unknown>;
                if (typeof item.name !== "string" || !item.name) return null;
                return {
                  name: item.name,
                  slug: typeof item.slug === "string" ? item.slug : null,
                  description: typeof item.description === "string" ? item.description : null,
                  tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === "string") : [],
                  is_adult: typeof item.is_adult === "boolean" ? item.is_adult : false,
                  logo_url: typeof item.logo_url === "string" ? item.logo_url : null,
                } satisfies ApiGroup;
              })
              .filter((g): g is ApiGroup => g !== null);
          }
        }

        setState({ kind: "ok", groups, tagLabel });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, []);

  const toggleTag = useCallback((slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTag((prev) => (prev === slug ? null : slug));
  }, []);

  if (state.kind === "loading")
    return <LoadingState message="Carregando grupos da comunidade…" variant="inline" />;
  if (state.kind === "error")
    return <ErrorState title="Não foi possível carregar" message="Tente recarregar a página." variant="inline" />;
  if (state.groups.length === 0)
    return (
      <EmptyState
        title="Ainda não há grupos da comunidade"
        message="Seja o primeiro a sugerir um grupo abaixo."
        variant="inline"
      />
    );

  const hasAdult = state.groups.some((g) => g.is_adult);

  const filtered = selectedTag
    ? state.groups.filter((g) => g.tags.includes(selectedTag))
    : state.groups;

  const renderChips = (g: ApiGroup) => (
    <span className="chips">
      {g.is_adult && <span className="chip chip-adult">+18</span>}
      {g.tags.slice(0, 3).map((t) => (
        <button
          key={t}
          className={`chip${selectedTag === t ? " chip-active" : ""}`}
          onClick={(e) => toggleTag(t, e)}
          type="button"
        >
          {state.tagLabel.get(t) ?? t}
        </button>
      ))}
    </span>
  );

  return (
    <div>
      {hasAdult && !adultGate && (
        <Modal
          open
          title="Conteúdo +18"
          description="Há grupos com conteúdo adulto nesta seção. Confirma ter 18 anos ou mais?"
          onClose={confirmAdult}
          footer={<button className="artificio-button" style={{ background: "var(--brand)", color: "#fff", border: "none" }} onClick={confirmAdult}>Confirmo ter 18+</button>}
        >
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--artificio-muted, #6b7280)" }}>Ao confirmar, você poderá ver todos os grupos, incluindo os marcados como +18.</p>
        </Modal>
      )}
      {selectedTag && (
        <p className="filter-bar">
          Filtro: <span className="chip chip-active">{state.tagLabel.get(selectedTag) ?? selectedTag}</span>
          <button className="chip" onClick={() => setSelectedTag(null)} type="button">
            ✕ limpar
          </button>
        </p>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum grupo com esta tag"
          message="Tente limpar o filtro ou sugerir um novo grupo."
          variant="inline"
        />
      ) : (
        <div className="cards">
          {filtered.map((g) => (
            <div className="card-wrapper" key={g.slug ?? g.name}>
            <a
              className={`card${g.is_adult && !adultGate ? " card-adult" : ""}`}
              href={g.slug ? `/grupo/${g.slug}` : "#"}
            >
              {g.is_adult && !adultGate && (
                <span className="adult-overlay">
                  <p>+18</p>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmAdult(); }}>Ver</button>
                </span>
              )}
              <img
                className="logo"
                src={g.logo_url || "/placeholder.svg"}
                alt={`Logo do grupo ${g.name}`}
                width={104}
                height={104}
                loading="lazy"
                decoding="async"
              />
              <span className="body">
                <span className="name">{g.name}</span>
                {(g.tags.length > 0 || g.is_adult) && renderChips(g)}
                {g.description && <span className="desc">{g.description}</span>}
              </span>
            </a>
            {g.slug && <ReportButton slug={g.slug} groupName={g.name} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
