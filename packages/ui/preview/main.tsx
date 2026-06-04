import React from "react";
import { createRoot } from "react-dom/client";
import { Footer, Header } from "../src";
import "../src/styles.css";
import "./preview.css";

const loggedUser = {
  id: "u-preview",
  email: "ana@example.com",
  name: "Ana Artifice",
  role: "admin" as const,
  avatar: null,
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="preview-shell">
      <section>
        <h1>Deslogado</h1>
        <Header sessionOverride={{ user: null, loading: false }} />
      </section>
      <section>
        <h1>Logado</h1>
        <Header sessionOverride={{ user: loggedUser, loading: false }} />
      </section>
      <Footer />
    </main>
  </React.StrictMode>,
);
