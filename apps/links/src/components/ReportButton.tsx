import { useState, useEffect, type FormEvent } from "react";
import { Button, Field, Modal, Select, Textarea } from "@artificio/ui";

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

const FORM_ID = "report-form";

export default function ReportButton({ slug, groupName }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [undo, setUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeModal() {
    setOpen(false);
    setReason("");
    setNote("");
    setDone(false);
    setUndo(false);
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
      setUndo(true);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function onUndo() {
    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = getXsrfToken();
      if (token) headers["x-xsrf-token"] = token;
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/report`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(String(res.status));
      closeModal();
    } catch {
      setError("Não foi possível desfazer.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(false), 5000);
    return () => clearTimeout(timer);
  }, [undo]);

  const fieldError = error && !reason ? error : undefined;
  const formError = error && reason ? error : null;

  return (
    <>
      <button
        type="button"
        className="report-trigger"
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        title="Reportar grupo"
      >
        Reportar
      </button>

      <Modal
        open={open && !done}
        title={`Reportar "${groupName}"`}
        onClose={closeModal}
        footer={
          <>
            {formError && (
              <span className="artificio-field-error" role="alert">{formError}</span>
            )}
            <Button variant="ghost" type="button" disabled={busy} onClick={closeModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form={FORM_ID} disabled={busy}>
              {busy ? "Enviando…" : "Enviar"}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} noValidate>
          <Field label="Motivo" error={fieldError}>
            <Select
              value={reason}
              onChange={(e) => { setReason(e.currentTarget.value); setError(null); }}
              invalid={!!fieldError}
              disabled={busy}
            >
              <option value="">Selecione…</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição (opcional)">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder="Detalhes adicionais…"
              maxLength={1000}
              rows={3}
              disabled={busy}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={open && done}
        title="Denúncia enviada"
        onClose={closeModal}
        footer={
          <>
            {undo && (
              <Button variant="danger" onClick={onUndo} disabled={busy}>
                {busy ? "Desfazendo…" : "Desfazer"}
              </Button>
            )}
            <Button variant="secondary" onClick={closeModal}>
              Fechar
            </Button>
          </>
        }
      >
        <span className="artificio-modal-description">
          {error ?? "Obrigado! A moderação vai analisar."}
        </span>
      </Modal>
    </>
  );
}
