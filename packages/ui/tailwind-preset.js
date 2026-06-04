// Preset Tailwind Artifício RPG — paleta real da marca (D038).
// Laranja = acento; navy/charcoal = texto/superfície escura. Ver src/tokens.ts.
export default {
  theme: {
    extend: {
      colors: {
        artificio: {
          ink: "#10103A",
          muted: "#5A6172",
          line: "#E3E5EC",
          surface: "#FFFFFF",
          canvas: "#F6F7FA",
          charcoal: "#0F1014",
          brand: "#FC9054",
          "brand-deep": "#E0712F",
          bronze: "#9C6B43",
          focus: "#E0712F",
        },
      },
      borderRadius: {
        ui: "8px",
      },
      boxShadow: {
        ui: "0 1px 2px rgba(16, 16, 58, 0.08)",
      },
      fontFamily: {
        display: ["Oswald", "Arial Narrow", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
};
