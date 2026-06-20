// Ilha: form de sugestão de grupo. Só logado (SSO). Reusa @artificio/auth (useSession/authFetch/
// redirectToLogin) e os primitivos compartilhados @artificio/ui. Validação client-side (UX-4).
import { useState, type FormEvent } from "react";
import { useSession, authFetch, redirectToLogin } from "@artificio/auth/client";
import {
  Button,
  Field,
  TextInput,
  Textarea,
  Panel,
  LoadingState,
  SuccessState,
} from "@artificio/ui";

// Espelha server/lib/og.ts (allowlist de host). Só pré-valida no cliente; backend revalida.
function validInvite(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "chat.whatsapp.com") return /^[A-Za-z0-9]{8,40}$/.test(u.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
    if (h === "whatsapp.com" || h === "www.whatsapp.com") {
      const [seg, code = ""] = u.pathname.replace(/^\/+/, "").split("/");
      return seg === "channel" && /^[A-Za-z0-9]{8,40}$/.test(code);
    }
    return false;
  } catch {
    return false;
  }
}

export default function SuggestForm() {
  const { user, loading } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invite, setInvite] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <LoadingState message="Verificando sua sessão…" variant="inline" />;

  if (!user)
    return (
      <Panel tone="subtle">
        <p>Entre com sua conta Artifício para sugerir um grupo.</p>
        <Button variant="primary" onClick={() => redirectToLogin()}>
          Entrar para sugerir
        </Button>
      </Panel>
    );

  if (done)
    return (
      <SuccessState
        title="Sugestão enviada!"
        message="Sua sugestão vai para a moderação. Quando aprovada, aparece aqui na lista."
        variant="inline"
      />
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr("Informe o nome do grupo (mín. 2 caracteres).");
    if (!validInvite(invite))
      return setErr("Link inválido. Use um convite chat.whatsapp.com ou whatsapp.com/channel.");
    setBusy(true);
    try {
      const res = await authFetch("/api/groups/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, invite_url: invite }),
      });
      if (res.status === 429) {
        setErr("Você atingiu o limite de envios. Tente novamente mais tarde.");
        return;
      }
      if (!res.ok) {
        const raw = await res.json().catch(() => null);
        const body =
          typeof raw === "object" && raw !== null && "error" in raw && typeof raw.error === "string"
            ? (raw as { error: string })
            : null;
        setErr(body?.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel tone="subtle" header={<strong>Sugerir um grupo</strong>}>
      <form onSubmit={onSubmit} noValidate>
        <Field id="g-name" label="Nome do grupo" required>
          <TextInput
            id="g-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Ex.: Mesas de Curitiba"
          />
        </Field>
        <Field id="g-desc" label="Descrição" hint="Opcional — uma frase sobre o grupo.">
          <Textarea
            id="g-desc"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
        <Field
          id="g-invite"
          label="Link de convite"
          required
          hint="Cole o convite chat.whatsapp.com/… ou whatsapp.com/channel/…"
          error={err ?? undefined}
        >
          <TextInput
            id="g-invite"
            value={invite}
            maxLength={200}
            invalid={Boolean(err)}
            onChange={(e) => setInvite(e.currentTarget.value)}
            placeholder="https://chat.whatsapp.com/…"
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Enviando…" : "Enviar sugestão"}
        </Button>
      </form>
    </Panel>
  );
}
