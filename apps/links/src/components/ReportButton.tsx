import { useState, type FormEvent } from "react";
import { Button } from "@artificio/ui";

// REASONS é constante interna (hardcoded, tipada, não payload externo).
// .map no render é seguro — não viola regra de normalização de dado externo.
const REASONS: { value: string; label: string }[] = [
  { value: "convite_quebrado", label: "Convite quebrado / expirado" },
  { value: "conteudo_improprio", label: "Conteúdo impróprio" },
  { value: "grupo_inativo", label: "Grupo inativo" },
  { value: "outro", label: "Outro" },
];

function getXsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)xsrf_token=([^;]*)/);
  return match ? match[1] : null;
}

async function postReport(slug: string, reason: string, note: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = getXsrfToken();
  if (token) headers["x-xsrf-token"] = token;
  // encodeURIComponent é defesa em profundidade: slugs são gerados por slugify()
  // (apenas [a-z0-9-]) e o servidor revalida com slugify() antes de usar. Na prática
  // nenhum caractere unsafe chega aqui, mas o encode evita injeção de path caso a
  // invariante do slugify seja violada por regressão futura.
  return fetch(`/api/groups/${encodeURIComponent(slug)}/report`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason, note: note || undefined }),
    credentials: "include",
  });
}

interface Props {
  slug: string;
  groupName: string;
}

export default function ReportButton({ slug, groupName }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeModal() {
    setOpen(false);
    setReason("");
    setNote("");
    setDone(false);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Selecione um motivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postReport(slug, reason, note);
      if (!res.ok) {
        if (res.status === 429) {
          setError("Limite de denúncias atingido. Tente mais tarde.");
        } else if (res.status === 400) {
          setError("Dados inválidos. Verifique o motivo.");
        } else {
          setError("Não foi possível enviar. Tente novamente.");
        }
        return;
      }
      setDone(true);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ position: "relative" }}>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
        style={{ fontSize: "0.8rem", color: "var(--artificio-brand, #FF5722)", cursor: "pointer", userSelect: "none" }}
        title="Reportar grupo"
      >
        Reportar
      </span>

      {open && (
        <div
          role="dialog"
          aria-label={`Reportar ${groupName}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{
              background: "var(--color-surface, #fff)",
              color: "var(--color-fg, #0B1220)",
              padding: "1.5rem",
              borderRadius: "8px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 4px 24px rgba(0,0,0,.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <>
                <h3 style={{ margin: "0 0 .5rem" }}>Denúncia enviada</h3>
                <p style={{ fontSize: "0.9rem", margin: 0 }}>
                  Obrigado! A moderação vai analisar.
                </p>
                <div style={{ marginTop: "1rem" }}>
                  <Button variant="secondary" onClick={closeModal}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <h3 style={{ margin: "0 0 .75rem" }}>Reportar "{groupName}"</h3>
                <label style={{ display: "block", marginBottom: ".75rem", fontSize: "0.9rem" }}>
                  Motivo
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.currentTarget.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: ".25rem",
                      padding: ".4rem .5rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border, #ccc)",
                      background: "var(--color-surface, #fff)",
                      color: "var(--color-fg, #0B1220)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="">Selecione…</option>
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "block", marginBottom: ".75rem", fontSize: "0.9rem" }}>
                  Descrição (opcional)
                  <textarea
                    value={note}
                    maxLength={1000}
                    rows={3}
                    onChange={(e) => setNote(e.currentTarget.value)}
                    placeholder="Detalhes adicionais…"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: ".25rem",
                      padding: ".4rem .5rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border, #ccc)",
                      background: "var(--color-surface, #fff)",
                      color: "var(--color-fg, #0B1220)",
                      fontSize: "0.9rem",
                      resize: "vertical",
                    }}
                  />
                </label>
                {error && (
                  <p style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0 0 .5rem" }}>
                    {error}
                  </p>
                )}
                <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
                  <Button variant="ghost" type="button" disabled={busy} onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
