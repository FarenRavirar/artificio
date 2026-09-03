// Preset Tailwind Artifício RPG — paleta real da marca (D064 supera D040 no laranja).
// Laranja = acento; navy/charcoal = texto/superfície escura. Paridade com src/tokens.ts
// é travada por scripts/check-token-parity.mjs.
export default {
  theme: {
    extend: {
      colors: {
        artificio: {
          ink: "#020740",
          muted: "#5A6172",
          line: "#E3E5EC",
          surface: "#FFFFFF",
          canvas: "#F6F7FA",
          charcoal: "#0F1014",
          brand: "#FF5722",
          "brand-deep": "#E64A19",
          bronze: "#9C6B43",
          focus: "#E64A19",
          // Semânticos (B11) — acento ancora no mesas; "*-text" = AA sobre claro (bug B7).
          success: "#10B981",
          "success-text": "#15803D",
          warning: "#F59E0B",
          // amber 800 (era #A16207): 4.42:1 reprovava AA sobre o fundo real do
          // badge de warning; #854D0E mede 6.16:1. Ver tokens.ts.
          "warning-text": "#854D0E",
          danger: "#EF4444",
          "danger-text": "#B91C1C",
          info: "#38BDF8",
          "info-text": "#1D4ED8",
        },
      },
      // Raio: aponta para os tokens em vez de repetir o valor (spec 100). `ui`
      // continua existindo por compatibilidade e vale o mesmo que `md`.
      borderRadius: {
        ui: "var(--radius-md)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        ui: "0 1px 2px rgba(2, 7, 64, 0.08)",
      },
      // Pilha canônica, idêntica a styles.css e tokens.ts (spec 100 T1.2): era a
      // quarta declaração divergente da família de corpo, sem "Segoe UI" nem
      // Roboto — as duas faces que de fato renderizam em Windows e Android,
      // já que nenhum app carrega a Inter.
      fontFamily: {
        display: ["Oswald", "Arial Narrow", "Roboto Condensed", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "Segoe UI", "Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Régua tipográfica da Camada 2 — os mesmos degraus dos `.artificio-text-*`.
      fontSize: {
        display: ["28px", { lineHeight: "1.2" }],
        title: ["20px", { lineHeight: "1.25" }],
        section: ["16px", { lineHeight: "1.25" }],
        body: ["16px", { lineHeight: "1.5" }],
        support: ["14px", { lineHeight: "1.43" }],
        label: ["13px", { lineHeight: "1.3" }],
      },
    },
  },
};
