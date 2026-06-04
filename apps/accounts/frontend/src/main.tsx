import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("return") ?? "https://beta.artificiorpg.com";
}

function App() {
  const returnUrl = getReturnUrl();
  const googleUrl = new URL("/api/auth/google", window.location.origin);
  googleUrl.searchParams.set("return", returnUrl);

  return (
    <main className="accounts-page">
      <section className="accounts-panel" aria-labelledby="login-title">
        <div className="accounts-brand">
          <span aria-hidden="true" className="accounts-mark">
            A
          </span>
          <span>Artificio G1</span>
        </div>
        <h1 id="login-title">Entrar</h1>
        <p>Use sua conta Google para acessar os modulos do Artificio.</p>
        <a className="accounts-login" href={googleUrl.toString()}>
          Entrar com Google
        </a>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
