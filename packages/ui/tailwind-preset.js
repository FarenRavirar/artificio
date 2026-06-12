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
        },
      },
      borderRadius: {
        ui: "8px",
      },
      boxShadow: {
        ui: "0 1px 2px rgba(2, 7, 64, 0.08)",
      },
      fontFamily: {
        display: ["Oswald", "Arial Narrow", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
};
