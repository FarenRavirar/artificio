import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { brandLogoNavy, brandLogoNeg, applyFavicon, applyTheme, ThemeIcon, useTheme } from "@artificio/ui";
import type { User } from "@artificio/auth";
import { useSession, getAccountsOrigin, logout } from "@artificio/auth/client";
import { BRAND_TAGLINE_FREE, BRAND_ORIGIN, BRAND_DOMAIN } from "@artificio/config";
import "./styles.css";

applyFavicon();
applyTheme();

const PORTAL_URL = BRAND_ORIGIN;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

// getSafeReturnUrl: valida e canonicaliza a URL de retorno.
// CodeQL (github-advanced-security) sinaliza location.replace() com valor de query param
// como XSS (High) e URL redirect (Medium). Falso positivo: isAllowedReturnUrl (protocolo
// https + hostname *.artificiorpg.com) já bloqueia javascript:/data: e domínios externos.
// A canonicalizacao via url.toString() e defesa-em-profundidade: normaliza a URL (remove
// porta default, ordena querystring etc.) antes de entrar em location.replace().
function getSafeReturnUrl(): string {
  const params = new URLSearchParams(globalThis.location.search);
  const value = params.get("return");
  if (!value) return PORTAL_URL;

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      (url.hostname === BRAND_DOMAIN || url.hostname.endsWith(`.${BRAND_DOMAIN}`))
    ) {
      return url.toString();
    }
  } catch {
    // URL invalida ou protocolo nao-https → fallback seguro
  }

  return PORTAL_URL;
}

function LoginView() {
  const [checkingSession, setCheckingSession] = useState(true);
  const returnUrl = getSafeReturnUrl();
  const { theme } = useTheme();
  const logo = theme === "dark" ? brandLogoNeg : brandLogoNavy;
  const googleUrl = new URL("/api/auth/google", globalThis.location.origin);
  googleUrl.searchParams.set("return", returnUrl);

  useEffect(() => {
    const controller = new AbortController();

    async function redirectIfAlreadySignedIn() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.ok) {
          globalThis.location.replace(returnUrl);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Falha ao verificar sessao:", error);
      }

      if (!controller.signal.aborted) {
        setCheckingSession(false);
      }
    }

    void redirectIfAlreadySignedIn();

    return () => {
      controller.abort();
    };
  }, [returnUrl]);

  return (
    <section className="accounts-panel" aria-labelledby="login-title">
      <a className="accounts-brand" href={PORTAL_URL}>
        <img
          alt={logo.alt}
          className="accounts-brand-logo"
          height={logo.height}
          src={logo.src}
          width={logo.width}
        />
      </a>
      <p className="accounts-kicker">Login único Artifício RPG</p>
      <h1 id="login-title">Entrar</h1>
      <p className="accounts-subtitle">Use sua conta Google para acessar os projetos do Artifício.</p>
      {checkingSession ? (
        <div className="accounts-checking" role="status">
          <span className="accounts-spinner" aria-hidden="true" />
          Validando sessão...
        </div>
      ) : (
        <a className="accounts-login" href={googleUrl.toString()}>
          <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
            <path
              fill="#FFC107"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#FF3D00"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#4CAF50"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.97 7.3V4.96H.96a9 9 0 0 0 0 8.09l3.01-2.33Z"
            />
            <path
              fill="#1976D2"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          Entrar com Google
        </a>
      )}
      <div className="accounts-divider" aria-hidden="true" />
      <p className="accounts-note">
        {BRAND_TAGLINE_FREE}
      </p>
    </section>
  );
}

function ContaView() {
  const { user, loading } = useSession();
  const { theme } = useTheme();
  const [showSecrets, setShowSecrets] = useState(false);
  const [accountUser, setAccountUser] = useState<User | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const logo = theme === "dark" ? brandLogoNeg : brandLogoNavy;

  useEffect(() => {
    setAccountUser(user);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      const loginUrl = new URL("/login", getAccountsOrigin());
      loginUrl.searchParams.set("return", globalThis.location.href);
      globalThis.location.replace(loginUrl.toString());
    }
  }, [loading, user]);

  const handleLogout = useCallback(() => {
    logout(PORTAL_URL);
  }, []);

  const handleAvatarChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarStatus("Use PNG, JPG ou WebP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarStatus("A imagem precisa ter ate 2 MB.");
      return;
    }

    setAvatarBusy(true);
    setAvatarStatus(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/account/avatar", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAvatarStatus(readAccountError(body, "Nao foi possivel trocar a foto."));
        return;
      }
      const nextUser = readUserFromBody(body);
      if (nextUser) setAccountUser(nextUser);
      setAvatarStatus("Foto atualizada.");
    } catch {
      setAvatarStatus("Erro ao enviar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!accountUser) return;
    if (deleteConfirm !== accountUser.email) {
      setDeleteStatus("Digite seu e-mail para confirmar.");
      return;
    }

    setDeleteBusy(true);
    setDeleteStatus(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteConfirm }),
      });
      if (response.ok) {
        globalThis.location.assign(PORTAL_URL);
        return;
      }
      const body: unknown = await response.json().catch(() => ({}));
      setDeleteStatus(readAccountError(body, "Nao foi possivel excluir a conta."));
    } catch {
      setDeleteStatus("Erro de rede ao excluir a conta.");
    } finally {
      setDeleteBusy(false);
    }
  }, [accountUser, deleteConfirm]);

  if (loading || !accountUser) {
    return (
      <section className="accounts-panel">
        <p className="accounts-subtitle">Carregando...</p>
      </section>
    );
  }

  return (
    <section className="accounts-panel" aria-labelledby="conta-title">
      <a className="accounts-brand accounts-brand-compact" href={PORTAL_URL} aria-label="Voltar ao Artifício RPG">
        <img
          alt={logo.alt}
          className="accounts-brand-logo"
          height={logo.height}
          src={logo.src}
          width={logo.width}
        />
      </a>
      <div className="accounts-account-header">
        {accountUser.avatar ? (
          <img src={accountUser.avatar} alt="" className="accounts-avatar" width="72" height="72" />
        ) : (
          <div className="accounts-avatar accounts-avatar-fallback">
            {accountUser.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
          </div>
        )}
        <div className="accounts-account-copy">
          <p className="accounts-kicker">Conta Artifício</p>
          <h1 id="conta-title">Sua conta</h1>
          <p className="accounts-user-name">{accountUser.name}</p>
          {accountUser.email ? <p className="accounts-user-email">{accountUser.email}</p> : null}
        </div>
      </div>
      <section className="accounts-tool-panel" aria-labelledby="avatar-title">
        <div>
          <h2 id="avatar-title">Foto de perfil</h2>
          <p className="accounts-help">PNG, JPG ou WebP ate 2 MB.</p>
        </div>
        <label className="accounts-login accounts-login-secondary accounts-file-button">
          {avatarBusy ? "Enviando..." : "Trocar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            disabled={avatarBusy}
          />
        </label>
        {avatarStatus ? (
          <output className={avatarStatus.includes("atualizada") ? "accounts-status accounts-status-success" : "accounts-status accounts-status-error"}>
            {avatarStatus}
          </output>
        ) : null}
      </section>
      {accountUser.role === 'admin' && (
        <section className="accounts-admin-panel" aria-label="Administração">
          <button
            className="accounts-login accounts-login-secondary"
            type="button"
            onClick={() => setShowSecrets(!showSecrets)}
          >
            {showSecrets ? 'Ocultar' : 'Gerenciar segredos de admin'}
          </button>
          {showSecrets && <AdminSecretsPanel />}
        </section>
      )}
      <div className="accounts-actions">
        <button className="accounts-login accounts-login-secondary" type="button" onClick={handleLogout}>
          Sair
        </button>
        <a className="accounts-login" href={PORTAL_URL}>
          Voltar ao Portal
        </a>
      </div>
      <section className="accounts-danger-zone" aria-labelledby="delete-title">
        <h2 id="delete-title">Excluir conta</h2>
        <p className="accounts-help">
          Remove seu login do Artifício e encerra a sessão. Para confirmar, digite seu e-mail.
        </p>
        <div className="accounts-field">
          <label htmlFor="delete-confirm">E-mail da conta</label>
          <input
            id="delete-confirm"
            type="email"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder={accountUser.email}
            autoComplete="off"
          />
        </div>
        <button
          className="accounts-login accounts-login-danger"
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleteBusy || deleteConfirm !== accountUser.email}
        >
          {deleteBusy ? "Excluindo..." : "Excluir minha conta"}
        </button>
        {deleteStatus ? <output className="accounts-status accounts-status-error">{deleteStatus}</output> : null}
      </section>
    </section>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("invalid_file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function readAccountError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const error = (body as { error: unknown }).error;
  if (error === "media_storage_unavailable") return "Armazenamento de imagem indisponivel.";
  if (error === "invalid_avatar") return "Imagem invalida.";
  if (error === "confirmation_required") return "Confirmacao invalida.";
  return typeof error === "string" ? error : fallback;
}

function readUserFromBody(body: unknown): User | null {
  const value =
    body && typeof body === "object" && "user" in body
      ? (body as { user: unknown }).user
      : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<User>;
  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.name !== "string" ||
    (record.role !== "user" && record.role !== "admin")
  ) {
    return null;
  }
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    avatar: typeof record.avatar === "string" ? record.avatar : null,
  };
}

function AdminSecretsPanel() {
  const [deepseekValue, setDeepseekValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = deepseekValue.trim();
    if (!trimmed) {
      setStatusMsg('Informe a chave da API.');
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/admin/secrets/deepseek_api_key', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: trimmed }),
      });
      if (res.ok) {
        setDeepseekValue('');
        setStatusMsg('Chave salva com sucesso.');
      } else {
        // Payload externo: extrair `error` só se for string (REV-022).
        const data: unknown = await res.json().catch(() => ({}));
        const errMsg =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Erro ao salvar.';
        setStatusMsg(errMsg);
      }
    } catch {
      setStatusMsg('Erro de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="accounts-secrets">
      <h2>Segredos de admin</h2>
      <div className="accounts-field">
        <label htmlFor="deepseek-api-key">
          Chave da API DeepSeek
        </label>
        <input
          id="deepseek-api-key"
          type="password"
          value={deepseekValue}
          onChange={e => setDeepseekValue(e.target.value)}
          placeholder="sk-..."
        />
      </div>
      <button
        className="accounts-login"
        type="button"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvando...' : 'Salvar chave'}
      </button>
      {statusMsg && (
        <output className={statusMsg.includes('sucesso') ? 'accounts-status accounts-status-success' : 'accounts-status accounts-status-error'}>
          {statusMsg}
        </output>
      )}
      <p className="accounts-help">
        A chave é armazenada cifrada e nunca é exibida após ser salva. Disponível para consumo serviço-a-serviço
        pelos módulos da plataforma.
      </p>
    </div>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const path = globalThis.location.pathname;

  return (
    <main className="accounts-page">
      <button
        className="accounts-theme-toggle"
        type="button"
        aria-label="Alternar tema"
        title="Alternar tema"
        onClick={toggleTheme}
      >
        <ThemeIcon theme={theme} />
      </button>
      {path === "/conta" ? <ContaView /> : <LoginView />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
